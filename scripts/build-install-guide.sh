#!/usr/bin/env bash
# build-install-guide.sh — Generate complete installation guide per version
# Usage: ./scripts/build-install-guide.sh <version> <upstream_version>
set -euo pipefail

VER="${1:-$(node -p "require('./package.json').version")}"
UPSTREAM="${2:-$(node -p "require('./package.json').opencodeUpstream")}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Use a template approach - write to temp file with placeholders, then substitute
cat > "/tmp/install-guide-${VER}.md" <<'GUIDEEOF'
# 📥 Panduan Instalasi Lengkap — opencode-termux v{{VER}}

**Versi Paket:** {{VER}}  
**Upstream opencode-ai:** v{{UPSTREAM}}  
**Platform:** Android 9+ ARM64 (Termux F-Droid/GitHub build)  
**Lisensi:** MIT  

> ⚠️ **Penting:** Gunakan Termux dari **F-Droid** atau **GitHub Release** — **bukan Play Store** (versi jadul, tidak kompatibel).

---

## 📋 Daftar Isi
1. [Persyaratan](#1-persyaratan)
2. [Instalasi Online (npm)](#2-instalasi-online-npm-recommended)
3. [Instalasi Offline (Tanpa Node.js)](#3-instalasi-offline-tanpa-nodejs)
4. [Instalasi Via .deb (Termux apt)](#4-instalasi-via-deb-termux-apt)
5. [Verifikasi & Diagnostik](#5-verifikasi--diagnostik)
6. [Pemakaian Pertama](#6-pemakaian-pertama)
7. [Update & Uninstall](#7-update--uninstall)
8. [Troubleshooting](#8-troubleshooting)
9. [FAQ](#9-faq)
10. [File Rilis & Verifikasi Integritas](#10-file-rilis--verifikasi-integritas)

---

## 1️⃣ Persyaratan

| Butuh | Minimum | Cara Cek |
|-------|---------|----------|
| Android | 9 (API 28) | `getprop ro.build.version.sdk` ≥ 28 |
| Arsitektur | ARM64 (aarch64) | `uname -m` → `aarch64` |
| Termux | F-Droid / GitHub build | `pkg list-installed termux-tools` |
| Ruang | ~500 MB bebas | `df -h $HOME \| tail -1` |
| Jaringan | Stabil (installer retry 3x) | - |
| Node.js | ≥ 18 (online install) | `node --version` |

> ⚠️ **ARM32 (armv7/armv8l) belum didukung** — upstream tidak provide binary musl.

---

## 2️⃣ Instalasi Online (npm — Recommended)

### Prasyarat
```bash
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts tar
node --version   # harus ≥ v18
```

### Install
```bash
npm install -g @nemoobc/opencode-termux
```

> ⚠️ **Warning `install-scripts`?** Izinkan sekali:
```bash
npm config set allow-scripts=@nemoobc/opencode-termux --location=user
npm rebuild -g @nemoobc/opencode-termux
```
Lewat warning? Tidak apa — **auto-heal** akan pasang bundle saat pertama jalan.

### Alternatif: npx (tanpa global install)
```bash
npx @nemoobc/opencode-termux --version
```

---

## 3️⃣ Instalasi Offline (Tanpa Node.js / Tanpa Internet)

### Cocok untuk:
- HP tanpa akses internet stabil
- Install massal di banyak device
- Air-gapped environment

### Langkah:
1. **Download 2 file** dari [GitHub Releases v{{VER}}](https://github.com/nemoobc/opencode-termux/releases/tag/v{{VER}}):
   - `opencode-termux-installer.sh` (installer universal POSIX sh)
   - `opencode-termux-{{VER}}-aarch64.tar.gz` (bundle offline ARM64)
   - `SHA256SUMS.txt` (checksum verifikasi)

2. **Taruh di folder yang sama**, verifikasi:
```bash
sha256sum -c SHA256SUMS.txt
```

3. **Jalankan installer:**
```bash
sh opencode-termux-installer.sh
```

### Detail Installer (`opencode-termux-installer.sh`):
- **Murni POSIX sh** — jalan di `sh`, `bash`, `dash`, `busybox sh`
- **Auto-detect arsitektur** (arm64/x86_64)
- **Offline-first** — pakai bundle lokal jika ada, fallback download
- **Checksum SHA256** diverifikasi via `SHA256SUMS.txt`
- **Install ke:** `$PREFIX/lib/opencode-termux` + `$PREFIX/bin/opencode-termux`
- **DNS auto-setup** — `resolv.conf` & `hosts` di `$PREFIX/etc/` (tanpa root)
- **Smoke test** — verifikasi binary jalan sebelum selesai

### Custom Install Location:
```bash
OCX_LIBDIR=/custom/path/lib OCX_BINDIR=/custom/path/bin sh opencode-termux-installer.sh
```

---

## 4️⃣ Instalasi Via .deb (Termux apt)

### Download .deb dari Releases:
```bash
# Atau build lokal:
./scripts/build-all.sh
```

### Install:
```bash
pkg install ./opencode-termux_{{VER}}_aarch64.deb
```

### Isi .deb:
- Binary + vendor di `/data/data/com.termux/files/usr/lib/opencode-termux/`
- Wrapper CLI di `/data/data/com.termux/files/usr/bin/opencode-termux`
- **postinst:** auto-setup DNS + copy agent/command/config ke `~/.config/opencode/`

---

## 5️⃣ Verifikasi & Diagnostik

### Cek Versi
```bash
opencode-termux --version
# Output: 1.18.23 (binary upstream version)
```

### Doctor (Diagnosis Lengkap)
```bash
opencode-termux doctor
```

**Output interpretation:**
| Output | Arti | Tindakan |
|--------|------|----------|
| ✅ semua baris | Sehat | Lanjut pakai |
| ❌ vendor lengkap | Bundle belum ada | `opencode-termux update` |
| ❌ tar tersedia | Utilitas hilang | `pkg install tar` |
| ⚠️ platform bukan android | Di luar Android | Wajar di CI/emulator |
| ⚠️ DNS resolv.conf | Belum terbentuk | Dibuat otomatis saat jalan CLI |

### Subcommand CLI
```bash
opencode-termux update      # Update binary ke upstream terbaru
opencode-termux doctor      # Diagnostik lengkap
opencode-termux version     # Info versi paket + binary
opencode-termux help        # Bantuan
```

---

## 6️⃣ Pemakaian Pertama

```bash
mkdir -p ~/project-coba && cd ~/project-coba
opencode-termux
```

### Config Default (Otomatis Terpasang)
- **Model gratis:** `opencode/x-preview-f-free` — **tanpa API key**
- **Lokasi:** `~/.config/opencode/opencode.json` (milik user; installer **tidak pernah menimpa**)

### Agent & Command Bonus (Auto-installed)
| Command | Fungsi | Agent |
|---------|--------|-------|
| `/test` | Seluruh test suite + laporan | tester |
| `/fix` | Loop perbaiki tes gagal sampai hijau | fixer |
| `/build-apk` | Build APK Android | apk-builder |
| `/release` | Bump versi → tag → release | apk-builder |
| `/coder full` | **Full lifecycle: audit→test→monitor→fix→compact** | **autodev** |
| `/coder audit` | Scan project lengkap | autodev |
| `/coder test` | Jalankan semua test | autodev |
| `/coder monitor` | Start daemon (watch+CI+perf) | autodev |
| `/coder fix` | Auto-fix failure | autodev |
| `/coder compact` | Optimasi kode | autodev |
| `/orchestrator full` | Koordinator tahapan dengan state | orchestrator |

---

## 7️⃣ Update & Uninstall

### Update Binary (ke upstream terbaru)
```bash
opencode-termux update
```

### Update Paket npm (versi baru opencode-termux)
```bash
npm update -g @nemoobc/opencode-termux
```

### Uninstall
```bash
npm uninstall -g @nemoobc/opencode-termux
# Atau jika .deb:
pkg uninstall opencode-termux
```

### Bersihkan Cache (opsional)
```bash
rm -rf ~/.opencode-termux   # cache bundle lokal (jika ada)
```

> 📝 **Config & riwayat** di `~/.config/opencode/` **tidak disentuh** saat uninstall.

---

## 8️⃣ Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `tar: not found` saat install | utilitas tar belum ada | `pkg install tar` lalu `opencode-termux update` |
| `EACCES` / permission denied | Salah kaprah pakai sudo | Termux tak punya root — jangan `sudo`; `npm rebuild -g @nemoobc/opencode-termux` |
| Timeout DNS / host not found | resolv.conf belum terbentuk | Jalankan sekali: `opencode-termux` (dibuat otomatis), cek `$PREFIX/etc/resolv.conf` |
| `Exec format error` | CPU bukan arm64/x64 | Cek `uname -m`; ARM32 tidak didukung |
| Bundle gagal unduh berkali-kali | Jaringan operator bermasalah | Coba WiFi / ganti DNS hotspot; installer retry 3x otomatis |
| `integritas gagal` saat install | Unduhan korup | Jalankan lagi `opencode-termux update` — hash diverifikasi ulang |
| Node error `fetch is not defined` | Node < 18 | `pkg install nodejs-lts` (yang baru) |
| Termux dari Play Store crash/versi jadul | Build Play Store dihentikan | Pindah ke [build F-Droid](https://f-droid.org/en/packages/com.termux/) |

---

## 9️⃣ FAQ

**Butuh root?**  
Tidak. Semua berjalan di ruang user Termux.

**Kenapa tidak pakai proot/chroot seperti lainnya?**  
Bisa saja — tapi overhead I/O proot besar di HP. Paket ini menjalankan binary musl langsung: lebih cepat, lebih hemat baterai.

**Data apa yang disimpan?**  
- `~/.config/opencode/` — config & agent/command kamu  
- `<global-npm>/@nemoobc/opencode-termux/vendor/` — binary + loader (± 200 MB)

**Apakah binary-nya resmi?**  
Ya — diunduh dari npm `opencode-linux-arm64-musl` resmi milik upstream opencode, diverifikasi **sha512** terhadap registry. Paket ini hanya membungkus + menambal loader libc agar ramah Termux.

**Bisa dipakai di emulator/Waydroid/x64?**  
Bisa — jalankan manual dengan:
```bash
OCX_ARCH=x64 OCX_FORCE=1 node install.mjs
```

**Agent AUTODEV fungsinya apa?**  
Developer otonom universal: `/coder full` jalanin **audit → test → monitor → fix → compact** otomatis multi-bahasa (Node, Python, Go, Rust, Java, C++, Shell). Tanpa bertanya, berurutan, sampai selesai.

---

## 🔟 File Rilis & Verifikasi Integritas (v{{VER}})

Semua file tersedia di [GitHub Releases v{{VER}}](https://github.com/nemoobc/opencode-termux/releases/tag/v{{VER}}):

| File | SHA256 | Ukuran | Deskripsi |
|------|--------|--------|-----------|
| opencode-termux-{{VER}}.tgz | `sha256sum` | ~200 KB | NPM package |
| opencode-termux-{{VER}}-aarch64.tar.gz | `sha256sum` | ~180 MB | Offline bundle ARM64 |
| opencode-termux-{{VER}}-x86_64.tar.gz | `sha256sum` | ~180 MB | Offline bundle x64 |
| opencode-termux-installer-{{VER}}.sh | `sha256sum` | ~10 KB | Universal installer (POSIX sh) |
| opencode-termux_{{VER}}_aarch64.deb | `sha256sum` | ~180 MB | Debian package untuk Termux |
| opencode-termux-agents-config-{{VER}}.zip | `sha256sum` | ~50 KB | Agents + commands + config |
| opencode-termux-docs-{{VER}}.zip | `sha256sum` | ~200 KB | Dokumentasi lengkap (offline) |
| opencode-termux-{{VER}}-src.tar.gz | `sha256sum` | ~500 KB | Source code (audit/transparansi) |
| SHA256SUMS.txt | - | - | Semua checksum SHA256 |
| SHA512SUMS.txt | - | - | Semua checksum SHA512 |
| RELEASE-NOTES-{{VER}}.md | - | - | Release notes adaptive |
| INSTALLATION-GUIDE-{{VER}}.md | - | - | File ini |

### Verifikasi Manual:
```bash
# Download SHA256SUMS.txt + file yang mau verifikasi
sha256sum -c SHA256SUMS.txt 2>&1 | grep OK
```

---

## 📚 Dokumentasi Tambahan (Termasuk di Setiap Rilis)

| File | Lokasi | Deskripsi |
|------|--------|-----------|
| INSTALASI.md | docs/INSTALASI.md | Panduan instalasi detail + troubleshooting + FAQ |
| README.md | README.md | Ringkasan project + quick start + attribution |
| CHANGELOG.md | CHANGELOG.md | Riwayat perubahan kumulatif semua versi |
| RELEASE-HISTORY.md | RELEASE-HISTORY.md | History release notes semua versi |
| prebuilt/README.md | prebuilt/README.md | Cara rebuild musl loader custom |

---

## 🙏 Terima Kasih & Attribution

### Source Asli (Upstream) — **opencode-ai**
**opencode** dikembangkan oleh **anomalyco (opencode-ai team)**  
🔗 **Repository:** https://github.com/anomalyco/opencode  
📦 **npm:** https://www.npmjs.com/package/opencode-ai  
📖 **Docs:** https://opencode.ai  

> opencode-termux **hanya membungkus & menyesuaikan** binary resmi opencode-ai agar jalan native di Termux/Android:
> - Custom musl loader (DNS patch ke `$PREFIX/etc/`)
> - Bundling libgcc/libstdc++ dari Alpine
> - Auto-install agent & command ecosystem
> - Offline installer POSIX sh
> 
> **Semua credit core CLI, agent system, LLM integration, arsitektur utama, dan inovasi fundamental milik opencode-ai team.**

### opencode-termux Contributors
- **nemoobc** — Packaging, musl loader build, Termux adaptation, agent ecosystem, automation scripts, CI/CD
- **Community** — Testing, bug reports, feature requests, feedback

### Third Party (Bundled dengan Lisensi Sendiri)
| Component | License | Source |
|-----------|---------|--------|
| musl libc | MIT | https://musl.libc.org |
| Alpine Linux (libgcc, libstdc++) | Apache-2.0 / MIT | https://alpinelinux.org |
| Node.js | MIT | https://nodejs.org |

---

## 📞 Bantuan & Komunitas

- **Issues:** https://github.com/nemoobc/opencode-termux/issues
- **Discussions:** https://github.com/nemoobc/opencode-termux/discussions
- **Email:** 258114617+nemoobc@users.noreply.github.com

---

*Generated automatically for v{{VER}} by `scripts/build-install-guide.sh`*  
*Part of opencode-termux — native opencode CLI for Termux/Android*
GUIDEEOF

# Now substitute the placeholders
sed -i "s/{{VER}}/${VER}/g; s/{{UPSTREAM}}/${UPSTREAM}/g" "/tmp/install-guide-${VER}.md"

# Output to stdout
cat "/tmp/install-guide-${VER}.md"