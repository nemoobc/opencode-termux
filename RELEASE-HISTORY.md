# Riwayat Rilis

---

# v1.20.14 (2026-09-20)
Upstream: opencode v2.0.11

- sync: upstream opencode 2.0.11 (4f9e4eb).
- **Konsistensi versi**: package-lock.json kini ikut di-bump oleh workflow
  sync-upstream (sebelumnya lock terjebak di v2.0.6.1 — npm ci melihat versi
  basi). Detektor baru di `test/run.mjs` mengunci lock.version = package.version.
- **Perbaikan `update`**: `opencode-termux update` pada mode v2 tidak lagi
  men-downgrade pin upstream ke opencode-ai v1 (bug: selalu mengambil latest
  dari registry npm walau paket ini mode opencode v2). Kini versi v2 terbaru
  diambil dari listing opencode.ai dan pin **hanya naik** (cmpVer).
- **FIX TUI cannot-load-serve**: invoke binary via loader langsung merusak
  `/proc/self/exe` sehingga re-exec background server gagal dan TUI tidak
  start. Binary TIDAK di-patch (`patchelf --set-interpreter` terbukti
  merusakkan binary 200MB+ → SIGSEGV bahkan via loader). Solusi: wrapper
  menyalakan server eksplisit via loader SEBELUM TUI jalan (`ensureServer`),
  TUI menemukan server hidup dan tak perlu re-exec. Auto-stop setelah exit
  tetap jalan (hemat RAM/baterai).
  Symlink `libc.musl-*.so.1 → ld-musl.so` ditambah untuk memenuhi DT_NEEDED.
- **FIX args spread**: `spawnSync(loader, [..., args])` → args jadi nested
  array, binary terima empty string → `chdir("")` gagal. Fix: `...args` (spread).
- **FIX CI e2e-x64**: job kekurangan `OCX_FORCE=1` + `OCX_ARCH=x64` sehingga
  install dilewati dan vendor tak terbentuk. Detektor baru mengunci keduanya.

# v1.20.12 (2026-09-20)
Upstream: opencode v2.0.6

**Perubahan besar — pindah ke opencode v2 (patch ELF, bukan invoke loader):**

- **Upstream v2**: binary opencode 2.0.6 dari opencode.ai (v2 tidak ada di npm
  registry) — verifikasi `gzip -t` + ukuran > 50 MiB.
- **Patch ELF**: `PT_INTERP` → `vendor/ld-musl.so` + `RPATH` → `vendor` via
  patchelf (diunduh dari Alpine CDN). Binary jalan langsung — **re-exec server
  background ikut jalan** (masalah utama v1: `spawnSync(loader, ...)` gagal di v2).
- **Wrapper**: eksekusi binary langsung + `cleanEnv()` (bersihkan LD_PRELOAD) +
  `ensureTmp()` (TMPDIR → `$PREFIX/tmp`).
- **Auto-stop server**: TUI yang memulai server → saat exit server ikut mati
  (hemat RAM/baterai); server yang sudah jalan duluan dibiarkan.
- **Anti-shadowing**: `fixShadowing()` — ganti binary mentah `~/.opencode/bin/opencode`
  dengan symlink ke wrapper (cegah error `libtermux-exec-ld-preload.so`).
- **patchElf aman**: cek `--print-interpreter` dulu — skip jika sudah terpatch
  (cegah hang saat `npm rebuild`).
- **Tab = switch agent**: keybind `agent.cycle: tab` (gaya v1) via
  `config/cli.json` — auto-install, tidak menimpa milik user.
- **Tanpa agents/commands/skills bawaan**: dihapus — lingkungan bersih, bebas
  konflik dengan setup sendiri.
- **Sync upstream**: workflow kini cek `@opencode/cli` (npm = sumber v2),
  bukan `opencode-ai` (v1).
- **Bersih-bersih**: hapus `install.ts`, `tsconfig.json`, file `.ts` basi,
  `config/plugins/` (artefak mati), devDependencies TypeScript.

---

# v1.20.11 (2026-09-XX)
Upstream: opencode-ai v1.18.31

- sync: upstream opencode-ai 1.18.31 (ab2ec8c)

---

# v1.20.3 (2026-08-27)
Upstream: opencode-ai v1.18.23

- ci: publish npm via setup-node registry-url — perbaiki auth 'need auth' (7db997b)