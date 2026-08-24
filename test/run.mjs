#!/usr/bin/env node
/**
 * Test suite @nemoobc/opencode-termux — tanpa dependensi eksternal.
 * Struktur + sintaks + unit resolver + (opsional) E2E penuh.
 * E2E: OCX_E2E=1 npm test  → install bundle x64 + jalankan --version
 */
import fs from "fs"
import path from "path"
import { execFileSync } from "child_process"
import { fileURLToPath } from "url"
import { cmpVer, alpinePkg } from "../lib/alpine.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0, fail = 0
const failures = []
// rantai promise agar test async tetap berurutan & kegagalannya tertangkap
let chain = Promise.resolve()
const t = (name, fn) => {
  chain = chain.then(async () => {
    try { await fn(); console.log(`✅ ${name}`); pass++ }
    catch (e) { console.log(`❌ ${name}\n   └─ ${e.message}`); fail++; failures.push({ name, err: e.message }) }
  })
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg) }
const read = f => fs.readFileSync(path.join(root, f), "utf8")
const json = f => JSON.parse(read(f))

// ===== 1. package.json =====
t("package.json: JSON valid & field wajib", () => {
  const p = json("package.json")
  ok(p.name === "@nemoobc/opencode-termux", "nama paket salah")
  ok(/^\d+\.\d+\.\d+$/.test(p.version), `versi tidak semver: ${p.version}`)
  ok(p.bin && p.bin["opencode-termux"] === "./bin/opencode.js", "bin salah")
  ok(typeof p.opencodeUpstream === "string" && /^\d+\.\d+\.\d+$/.test(p.opencodeUpstream), "opencodeUpstream tidak semver")
  ok(p.scripts && typeof p.scripts.test === "string", "script test hilang")
})
t("package.json: semua entri 'files' ada di disk", () => {
  const files = json("package.json").files
  for (const f of files) ok(fs.existsSync(path.join(root, f)), `"${f}" terdaftar tapi tidak ada`)
})
// upstream terbaru dari registry (kalau jaringan tersedia) untuk uji kesegaran pin
let latestUpstream = null
try {
  latestUpstream = (await (await fetch("https://registry.npmjs.org/opencode-ai/latest")).json()).version
} catch {}
t("package.json: pin upstream == upstream opencode-ai terbaru", () => {
  if (latestUpstream === null) return console.log("   └─ registry tak terjangkau — dilewati")
  ok(json("package.json").opencodeUpstream === latestUpstream,
    `pin ${json("package.json").opencodeUpstream} ≠ upstream ${latestUpstream}`)
})

// ===== 2. sintaks =====
for (const f of ["bin/opencode.js", "install.mjs", "lib/alpine.mjs"]) {
  t(`sintaks: ${f}`, () => execFileSync(process.execPath, ["--check", path.join(root, f)], { stdio: "pipe" }))
}

// ===== 3. agents & commands frontmatter =====
t("agents: setiap file punya frontmatter description+mode+model", () => {
  for (const f of fs.readdirSync(path.join(root, "agents"))) {
    const c = read(`agents/${f}`)
    ok(c.startsWith("---"), `${f}: tanpa frontmatter`)
    ok(/^description:/m.test(c), `${f}: tanpa description`)
    ok(/^mode: (primary|subagent|all)/m.test(c), `${f}: mode tidak valid`)
    ok(/^model: \S+/m.test(c), `${f}: tanpa model`)
    ok(!/\bTODO\b/.test(c), `${f}: mengandung TODO`)
  }
})
t("commands: setiap file punya description & $ARGUMENTS", () => {
  for (const f of fs.readdirSync(path.join(root, "commands"))) {
    const c = read(`commands/${f}`)
    ok(c.startsWith("---"), `${f}: tanpa frontmatter`)
    ok(/^description:/m.test(c), `${f}: tanpa description`)
    ok(/\$ARGUMENTS/.test(c), `${f}: tanpa $ARGUMENTS`)
  }
})

// ===== 4. config =====
t("config/opencode.json: valid, ada $schema & model", () => {
  const c = json("config/opencode.json")
  ok(c.$schema === "https://opencode.ai/config.json", "$schema salah")
  ok(typeof c.model === "string" && c.model.includes("/"), "model tidak berformat provider/id")
})

// ===== 5. workflows =====
t("workflow sync-upstream: publish di-gate hasil sync (anti publish hantu)", () => {
  const y = read(".github/workflows/sync-upstream.yml")
  ok(/outputs:\s*\n\s*synced:/.test(y), "output 'synced' tidak diekspos dari job")
  ok(/echo "synced=(true|false)" >> "?\$\{?GITHUB_OUTPUT\}?"/.test(y), "step sync tidak menulis output synced")
  ok(/if: steps\.sync\.outputs\.synced == 'true'/.test(y), "publish step tidak ter-gate kondisi synced")
  ok(/npm publish/.test(y), "ada langkah publish")
})
t("workflow bersihkan: permission actions + loop delete", () => {
  const y = read(".github/workflows/bersihkan.yml")
  ok(/permissions:\s*\n\s*actions: write/.test(y), "permission actions: write hilang")
  ok(/DELETE/.test(y), "tidak ada panggilan DELETE run gagal")
})

// ===== 6. prebuilt loader =====
t("prebuilt loader: ELF aarch64 & executable", () => {
  const buf = fs.readFileSync(path.join(root, "prebuilt/ld-musl-aarch64-termux.so"))
  ok(buf.length > 0, "file kosong")
  ok(buf.subarray(0, 4).toString() === "\x7fELF", "bukan ELF")
  ok(buf[0x12] === 0xb7, `machine bukan aarch64 (0x${buf[0x12].toString(16)})`)
  ok(fs.statSync(path.join(root, "prebuilt/ld-musl-aarch64-termux.so")).mode & 0o111, "mode tidak executable")
})

// ===== 7. unit resolver Alpine =====
t("cmpVer: urutan versi benar", () => {
  ok(cmpVer("14.2.0-r4", "14.2.0-r5") < 0, "r4 >= r5 ?!")
  ok(cmpVer("14.2.1-r0", "14.2.0-r9") > 0, "patch lebih tinggi harus menang")
  ok(cmpVer("15.0.0-r0", "14.99.99-r9") > 0, "major lebih tinggi harus menang")
  ok(cmpVer("14.2.0-r4", "14.2.0-r4") === 0, "versi sama tidak nol ?!")
})
t("alpinePkg: pilih versi tertinggi dari listing", async () => {
  const fakeListing = '<a href="libgcc-13.2.0-r1.apk">x</a><a href="libgcc-14.2.0-r4.apk">y</a><a href="libgcc-14.2.0-r5.apk">z</a>'
  const fetchFn = async () => ({ text: async () => fakeListing })
  const got = await alpinePkg(fetchFn, "https://x/main/aarch64", "libgcc")
  ok(got === "libgcc-14.2.0-r5.apk", `salah pilih: ${got}`)
})
t("alpinePkg: fallback ke versi pin saat listing gagal", async () => {
  const fetchFn = async () => { throw new Error("jaringan mati") }
  const got = await alpinePkg(fetchFn, "https://x", "libstdc%2B%2B")
  ok(got === "libstdc%2B%2B-14.2.0-r4.apk", `fallback salah: ${got}`)
})
t("alpinePkg (integrasi): listing CDN asli bisa diresolve", async () => {
  const got = await alpinePkg(fetch, "https://dl-cdn.alpinelinux.org/alpine/v3.21/main/x86_64", "libgcc")
  ok(/^libgcc-.+-r\d+\.apk$/.test(got), `format aneh: ${got}`)
  console.log(`   └─ resolved: ${got}`)
})

// ===== 8. git hygiene =====
t("git: tidak ada tarball/artefak build yang ter-track", () => {
  const ls = execFileSync("git", ["ls-files"], { cwd: root }).toString().split("\n").filter(Boolean)
  for (const f of ls) {
    ok(!f.endsWith(".tgz"), `tarball masih di-track: ${f}`)
    ok(!f.startsWith("vendor/"), `vendor masih di-track: ${f}`)
    ok(f !== ".build" && !f.startsWith(".build/"), ".build masih di-track")
  }
})
t("gitignore: mencakup vendor/, .build/, node_modules/, *.tgz", () => {
  const g = read(".gitignore")
  for (const need of ["vendor/", ".build/", "node_modules/", "*.tgz"]) ok(g.includes(need), `.gitignore kurang ${need}`)
})

// ===== 9. E2E opsional =====
if (process.env.OCX_E2E === "1") {
  console.log("\n🔧 mode E2E: instalasi bundle x64 + smoke test…")
  t("e2e: install.mjs selesai tanpa error (OCX_ARCH=x64 OCX_FORCE=1)", () => {
    execFileSync(process.execPath, [path.join(root, "install.mjs")], {
      stdio: "inherit",
      env: { ...process.env, OCX_ARCH: "x64", OCX_FORCE: "1" },
      cwd: root,
    })
  })
  t("e2e: vendor/opencode --version merespons", () => {
    const out = execFileSync(process.execPath, [path.join(root, "bin/opencode.js"), "--version"], {
      encoding: "utf8", env: process.env, cwd: root,
    })
    ok(/\d+\.\d+\.\d+/.test(out), `output tak dikenal: ${out.trim()}`)
    console.log(`   └─ version: ${out.trim()}`)
  })
}

// ===== ringkasan =====
await chain
console.log(`\n${"=".repeat(50)}\nhasil: ${pass} lulus, ${fail} gagal`)
if (fail > 0) {
  console.log("kegagalan:")
  for (const f of failures) console.log(`  • ${f.name} — ${f.err}`)
  process.exit(1)
}
