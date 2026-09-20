# Riwayat Rilis

---

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