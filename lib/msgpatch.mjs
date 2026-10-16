/**
 * Patch biner opencode v2 (kompilasi Bun) — kelas anchor: pesan /update.
 * Logika /update ter-compile di binary dan tak bisa diarahkan ke npm
 * @nemoobc/opencode-termux — yang bisa diubah: teks errornya, supaya user
 * melihat penunjuk update yang benar.
 *
 * Pelajaran penting (terbukti E2E): mayoritas modul biner di-mark
 * `// @bun @bytecode` — runtime mengeksekusi bytecode; teks sumber di badan
 * binary hanyalah sumber-dump (inert). Patch teks efektif HANYA saat string
 * juga ada di string table bytecode — kasus MSG_PATCHES ✓ (terbukti: `upgrade`
 * mencetak teks patch di runtime). Kelas "export-ke-editor" (tmpdir → home)
 * DIBATALKAN dari tabel: needle-nya cuma ada di sumber-dump (inert terbukti —
 * TUI tetap menulis ke TMPDIR). Solusinya di wrapper: ensureTmp() mengarahkan
 * TMPDIR proses opencode ke $HOME/.cache/opencode/tmp (bin/opencode-termux.js).
 *
 * Terpisah dari bin/opencode-termux.js agar bisa diuji unit (test/run.mjs).
 */
import fs from "fs"
import { createHash } from "crypto"

// [needle, rep] — rep diberi padding spasi sampai panjang = needle supaya
// offset blob binary tidak bergeser (mutation-safe).
export const MSG_PATCHES = [
  ["Could not detect the installation method. Pass --method to choose how to upgrade OpenCode.",
   "Update via npm: npm install -g @nemoobc/opencode-termux"],
  ["Installation method not found",
   "Update via npm (paket termux)"],
  ["update skipped: installation method not found",
   "update: npm i -g @nemoobc/opencode-termux"],
]

/**
 * Terapkan patch ke string biner (latin1 — 1 byte = 1 char).
 * Mengembalikan { out, applied, missing }:
 *  - applied: daftar { rep, n } yang benar-benar diganti
 *  - missing: daftar needle yang tidak ditemukan (anchors drift upstream!)
 *
 * Aturan aman:
 *  - rep lebih panjang dari needle → skip dengan warning (tak bisa muat).
 *  - full === needle (rep sudah identik) → skip — mencegah loop tak berhenti
 *    (`while includes` dengan replace no-op = infinite loop).
 */
export function applyMsgPatches(input, patches = MSG_PATCHES, warn = () => {}) {
  let out = input
  const applied = []
  const missing = []
  for (const [needle, rep] of patches) {
    if (rep.length > needle.length) {
      warn(`patch "${rep.slice(0, 30)}…" lebih panjang dari anchor — dilewati`)
      continue
    }
    if (!out.includes(needle)) {
      // Jejak rep sudah ada = sudah pernah dipatch (marker hilang / tabel
      // bertambah) → bukan drift, jangan dilaporkan missing.
      if (out.includes(rep)) continue
      missing.push(needle)
      continue
    }
    const full = rep + " ".repeat(needle.length - rep.length)
    if (full === needle) continue // sudah sama — tidak ada yang perlu diganti
    let n = 0
    while (out.includes(needle)) {
      out = out.replace(needle, full)
      n++
    }
    applied.push({ rep, n })
  }
  return { out, applied, missing }
}

/**
 * Patch file binary di lokasi `bin`, dengan marker mtime anti-rescan.
 * Mengembalikan { patched, applied, missing } — patched=true bila file ditulis.
 *
 * Alur marker (isi `mtime:sidik-tabel`):
 *  - mtime vendor berubah (update/rebuild) → scan ulang.
 *  - tabel patch berubah (sidik beda, mis. patch baru dirilis) → scan ulang
 *    walau mtime vendor sama.
 *  - file ditulis → mtime berubah LAGI (rename) → marker mencatat mtime BARU
 *    + sidik, supaya run berikutnya tidak scan 195 MB lagi.
 */
export function patchBinaryMessages({ bin, marker, log = () => {}, warn = () => {} }) {
  const st = fs.statSync(bin)
  const all = MSG_PATCHES
  const sig = createHash("sha1").update(JSON.stringify(all)).digest("hex").slice(0, 12)
  let prev = ""
  try { prev = fs.readFileSync(marker, "utf8").trim() } catch {}
  const [pm, ps] = prev.split(":")
  if (pm === String(st.mtimeMs) && ps === sig) return { patched: false, applied: [], missing: [] }

  const input = fs.readFileSync(bin).toString("latin1")
  const { out, applied, missing } = applyMsgPatches(input, all, warn)

  let patched = false
  if (out !== input) {
    const tmp = bin + ".msgpatched"
    fs.writeFileSync(tmp, Buffer.from(out, "latin1"))
    fs.renameSync(tmp, bin)
    fs.chmodSync(bin, 0o755) // pertahankan executable bit
    patched = true
    const nst = fs.statSync(bin)
    fs.writeFileSync(marker, `${nst.mtimeMs}:${sig}`) // mtime BARU + sidik tabel
  } else {
    fs.writeFileSync(marker, `${st.mtimeMs}:${sig}`)
  }
  for (const { rep, n } of applied) log(`patch biner diterapkan ${n}x → ${rep}`)
  for (const needle of missing) warn(`anchor patch tidak ditemukan: "${needle.slice(0, 40)}…" (upstream berubah? perlu update tabel patch)`)
  return { patched, applied, missing }
}
