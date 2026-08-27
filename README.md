# 📱 opencode-termux

**[opencode](https://opencode.ai) CLI native di Termux/Android — tanpa proot, tanpa root, plus agent & tools otomatis.**

[![npm](https://img.shields.io/npm/v/@nemoobc/opencode-termux?color=cb3837&logo=npm)](https://www.npmjs.com/package/@nemoobc/opencode-termux)
[![release](https://img.shields.io/github/v/release/nemoobc/opencode-termux?color=3B82F6)](https://github.com/nemoobc/opencode-termux/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/nemoobc/opencode-termux/test.yml?label=test&color=22C55E)](.github/workflows/test.yml)
[![platform](https://img.shields.io/badge/platform-Android%20%7C%20Termux-3DDC84)](#)
[![arch](https://img.shields.io/badge/arch-arm64-blue)](#)
[![sync upstream](https://img.shields.io/badge/sync-upstream%20otomatis-C9A227)](.github/workflows/sync-upstream.yml)
[![license](https://img.shields.io/badge/license-MIT-green)](#)

---

## 🙏 **Attribution & Terima Kasih**

### **Source Asli: opencode-ai (anomalyco)**
**opencode-termux HANYA membungkus & menyesuaikan binary resmi opencode-ai** agar jalan native di Termux/Android.

| Komponen | Source | Credit |
|----------|--------|--------|
| **Core CLI** | [opencode-ai](https://github.com/anomalyco/opencode) | 🏆 **FULL CREDIT** |
| **Agent System** | opencode-ai | 🏆 **FULL CREDIT** |
| **LLM Integration** | opencode-ai | 🏆 **FULL CREDIT** |
| **Architecture** | opencode-ai | 🏆 **FULL CREDIT** |
| **Musl Loader Build** | opencode-termux (custom) | nemoobc |
| **Termux Adaptation** | opencode-termux | nemoobc |
| **Agent Ecosystem** | opencode-termux (extended) | nemoobc |
| **Offline Installer** | opencode-termux | nemoobc |
| **Automation (CI/CD)** | opencode-termux | nemoobc |

> **opencode-ai** adalah upstream asli — semua inovasi fundamental, arsitektur agent, integrasi LLM, dan core CLI berasal dari **tim opencode-ai (anomalyco)**. Kami hanya menambal agar jalan di Termux (musl libc, Bionic compat, DNS patch) dan menambah ekosistem agent/automation.

🔗 **Upstream:** https://github.com/anomalyco/opencode  
📦 **npm:** https://www.npmjs.com/package/opencode-ai  
📖 **Docs:** https://opencode.ai  

---

## 🤖 **Agent & Tools Otomatis (Sekali Install, Siap Pakai)**

| Agent | Mode | Fungsi |
|-------|------|--------|
| **autodev** | primary | **Developer otonom universal multi-bahasa** — full lifecycle: audit → test → monitor → fix → compact |
| **termux-coder** | primary | Coding assistant paham Termux (PATH, pkg, tanpa root, storage HP) |
| **apk-builder** | primary | Spesialis build APK Android: payload, align, sign, release |
| **tester** | subagent | Jalankan seluruh test suite (UI + mesin) + laporan pass/fail |
| **fixer** | subagent | Loop perbaikan otomatis: uji → analisis → fix minimal → uji ulang (max 5x) |

| Command | Fungsi | Agent |
|---------|--------|-------|
| `/coder full` | **Full lifecycle otomatis: audit → test → monitor → fix → compact** | **autodev** |
| `/coder audit` | Scan project lengkap: struktur, deps, security, style, arch | autodev |
| `/coder test` | Jalankan semua test per bahasa (unit, integration, coverage) | autodev |
| `/coder monitor` | Start daemon: file watch, CI status, perf baseline, log tail | autodev |
| `/coder fix` | Auto-fix failure loop (max 5 iterasi per bug) | autodev |
| `/coder compact` | Optimasi: dead code, format, deps, bundle, perf | autodev |
| `/orchestrator full` | Koordinator tahapan dengan state persistence & resume | orchestrator |
| `/test` | Seluruh test suite + laporan detail | tester |
| `/fix` | Loop perbaiki tes gagal sampai hijau | fixer |
| `/build-apk` | Build APK lengkap lewat agent apk-builder | apk-builder |
| `/release` | Bump versi → tag → release → bersihkan | apk-builder |

**Config default ikut terpasang:** model gratis `opencode/x-preview-f-free` — **tanpa API key**.

---

## 🔄 **Sync Upstream Otomatis**

Workflow GitHub mengecek [opencode-ai](https://github.com/anomalyco/opencode) baru setiap **6 jam** — begitu ada versi baru, paket ini otomatis menyesuaikan:

```
┌─────────────────────────────────────────────────────────────┐
│  sync-upstream.yml (cron 0 */6 * * *)                        │
├─────────────────────────────────────────────────────────────┤
│  1. Cek npm registry: opencode-ai latest version            │
│  2. Kalau baru: bump opencodeUpstream + version patch       │
│  3. Anti-bentrok: cek tag GitHub & npm registry             │
│  4. Commit + tag vX.Y.Z + push                              │
│  5. Trigger release.yml (build 6 artefak)                   │
│  6. Kalau NPM_TOKEN ada: npm publish otomatis               │
└─────────────────────────────────────────────────────────────┘
```

**Commit memakai identitas nemoobc** — riwayat bersih, traceable.

---

## 🏗️ **Arsitektur: Kenapa Paket Ini Ada?**

Installer resmi `opencode-ai` gagal di Termux karena:
1. Tidak mengenali `process.platform === "android"`
2. Tidak menyediakan build untuk **Bionic libc** (Termux pakai Bionic, bukan glibc)

**Solusi opencode-termux — tanpa trik aneh:**

```
opencode-termux (Node shim)
   └─ vendor/ld-musl.so          ← musl libc custom build untuk Termux*
        └─ vendor/opencode       ← binary resmi opencode-linux-arm64-musl
             ⤳ LD_LIBRARY_PATH → libstdc++ / libgcc_s (dari Alpine)
```

\* Path `/etc/resolv.conf` & `/etc/hosts` dipatch saat kompilasi menuju `$PREFIX/etc/` sehingga **DNS jalan tanpa root**.

**Auto-heal:** Kalau `postinstall` terlewat (mis. `--ignore-scripts`), binary dipasang otomatis saat pertama kali jalan.

---

## 📦 **Paket Rilis (6 Artefak — Semua Versi Terpreservasi)**

Setiap rilis (via `release.yml` → `scripts/build-release.sh`) menghasilkan **6 artefak**:

| File | Format | Target | Deskripsi |
|------|--------|--------|-----------|
| `nemoobc-opencode-termux-{v}.tgz` | `.tgz` | npm | Package untuk `npm install -g` |
| `opencode-termux-{v}-aarch64.tar.gz` | `.tar.gz` | Termux ARM64 | **Offline bundle lengkap** (vendor musl + binary + source) |
| `opencode-termux-{v}-x86_64.tar.gz` | `.tar.gz` | Emulator/x64 | Offline bundle x64 |
| `opencode-agents-and-config.zip` | `.zip` | Manual | Agents + commands + config saja (bebas versi) |
| `opencode-termux-installer.sh` | `.sh` | Universal | **POSIX sh installer** (tanpa Node, offline-capable) |
| `SHA256SUMS.txt` | `.txt` | Verify | Checksum sha256 semua file di atas |

> 💡 **Philosophy:** Semua artefak berbundle **versioned** di nama (kecuali
> `installer.sh` & `agents-and-config.zip` yang deliberately bebas versi agar
> gampang ditimpa pada update). History tidak hilang — versi lama tetap di GitHub Releases & npm registry.

---

## 🚀 **Instalasi Cepat**

### **Online (npm — Recommended)**
```bash
pkg update && pkg install nodejs-lts tar
npm install -g @nemoobc/opencode-termux
opencode-termux --version
```

> ⚠️ Warning `install-scripts`? Izinkan sekali:
> ```bash
> npm config set allow-scripts=@nemoobc/opencode-termux --location=user
> npm rebuild -g @nemoobc/opencode-termux
> ```

### **Offline (Tanpa Node.js / Tanpa Internet)**
```bash
# 1. Download 2 file dari GitHub Releases:
#    - opencode-termux-installer.sh
#    - opencode-termux-{v}-aarch64.tar.gz
#    - SHA256SUMS.txt (opsional, untuk verifikasi)

# 2. Taruh di folder yang sama, verifikasi:
sha256sum -c SHA256SUMS.txt

# 3. Jalankan installer (POSIX sh, no Node):
sh opencode-termux-installer.sh
```

### **Instalasi Per-Artefak**

Semua file diunduh dari **[GitHub Releases](https://github.com/nemoobc/opencode-termux/releases)** (ganti `{v}` dengan versi, contoh `1.20.3`).

| # | Artefak | Cara Install / Pakai |
|---|---------|----------------------|
| 1 | `nemoobc-opencode-termux-{v}.tgz` | Paket npm. `npm install -g ./nemoobc-opencode-termux-{v}.tgz` (atau simpan lalu `npm install -g @nemoobc/opencode-termux`) |
| 2 | `opencode-termux-{v}-aarch64.tar.gz` | **Bundle offline arm64.** Taruh di folder sama dengan installer lalu `sh opencode-termux-installer.sh` (atau ekstrak manual: `tar xzf opencode-termux-{v}-aarch64.tar.gz -C ~/.local/lib/opencode-termux --strip-components=1`) |
| 3 | `opencode-termux-{v}-x86_64.tar.gz` | Sama seperti #2, tapi untuk emulator/PC **x64**. Bisa dijalankan manual: `./vendor/ld-musl.so ./vendor/opencode --version` |
| 4 | `opencode-agents-and-config.zip` | **Agent + command + config saja.** Ekstrak ke `~/.config/opencode/`: `unzip opencode-agents-and-config.zip -d ~/.config/opencode` (tidak menimpa `opencode.json` yang sudah ada) |
| 5 | `opencode-termux-installer.sh` | **Installer universal.** `sh opencode-termux-installer.sh`. Baca bundle `-{arch}.tar.gz` di folder yang sama (offline) atau unduh otomatis dari Releases (online). Target instalasi: Termux → `$PREFIX/{lib,bin}`, selain itu → `~/.local/{lib,bin}` |
| 6 | `SHA256SUMS.txt` | **Verifikasi.** Sebelum install, cek keutuhan: `sha256sum -c SHA256SUMS.txt` (jalankan di folder berisi semua file artefak) |

> **Selalu verifikasi dulu:** `sha256sum -c SHA256SUMS.txt` sebelum mengekstrak/menjalankan artefak apa pun yang diunduh.

### **Via .deb (Termux apt)**
```bash
pkg install ./opencode-termux_{v}_aarch64.deb
```
> ⚠️ Artefak `.deb` dihapus pada rilis v1.20.3 — paket kini fokus **npm + installer.sh + bundle tarball**. Kalau kamu butuh `.deb`, arahkan ke rilis lama.

---

## ✅ **Verifikasi & Diagnostik**

```bash
opencode-termux --version   # Versi binary upstream
opencode-termux doctor      # Diagnosis lengkap environment
opencode-termux version     # Info versi paket + binary
opencode-termux update      # Update binary ke upstream terbaru
```

**Doctor output interpretation:**
| Output | Arti | Tindakan |
|--------|------|----------|
| ✅ semua baris | Sehat | Lanjut pakai |
| ❌ vendor lengkap | Bundle belum ada | `opencode-termux update` |
| ❌ tar tersedia | Utilitas hilang | `pkg install tar` |
| ⚠️ platform bukan android | Di luar Android | Wajar di CI/emulator |

---

## 🎯 **Pemakaian Pertama**

```bash
mkdir -p ~/project-coba && cd ~/project-coba
opencode-termux
```

**Config default** sudah terpasang otomatis dengan **model gratis `opencode/x-preview-f-free`** — tanpa API key.  
Lokasi: `~/.config/opencode/opencode.json` (milik user; installer **tidak pernah menimpa**).

---

## 🧪 **Testing**

```bash
npm test              # Struktur + unit (cepat, tanpa unduhan besar)
npm run test:e2e      # E2E penuh: install bundle + smoke test + subcommand
```

CI GitHub menjalankan:
- Struktur test di setiap push
- **E2E ARM64 sungguhan** (native di runner `ubuntu-24.04-arm` via container Alpine — loader musl prebuilt Termux benar-benar dieksekusi)

---

## 🔒 **Keamanan**

- Tarball binary diverifikasi **sha512** terhadap metadata resmi registry npm
- Unduhan memakai retry + backoff eksponensial (tahan jaringan gemetar)
- gitleaks scan di CI untuk deteksi secrets
- Binary upstream tidak dimodifikasi — hanya dibungkus

---

## 📚 **Dokumentasi Lengkap (Termasuk di Setiap Rilis)**

| File | Deskripsi |
|------|-----------|
| **[INSTALASI.md](docs/INSTALASI.md)** | Panduan end-to-end: persyaratan → install → verifikasi → update/uninstall → troubleshooting → FAQ |
| **[CHANGELOG.md](CHANGELOG.md)** | Riwayat perubahan kumulatif semua versi |
| **[RELEASE-HISTORY.md](RELEASE-HISTORY.md)** | Release notes adaptif semua versi (auto-generated) |
| **prebuilt/README.md** | Cara rebuild musl loader custom |
| **Agent & Command** | `agents/*.md` & `commands/*.md` — docs per agent/command |

---

## 🛠 **Development & Build**

```bash
# Clone & install deps
git clone https://github.com/nemoobc/opencode-termux.git
cd opencode-termux
npm install

# Build semua artefak rilis (6 format)
./scripts/build-release.sh

# Output di ./dist/
ls -la dist/
```

**Scripts tersedia:**
| Script | Fungsi |
|--------|--------|
| `npm run postinstall` | Install bundle vendor (auto dijalankan npm) |
| `npm test` | Struktur + unit test |
| `npm run test:e2e` | E2E test penuh |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | Lint placeholder |
| `./scripts/build-release.sh` | Build 6 artefak rilis |
| `./scripts/generate-release-notes.sh` | Generate release notes adaptive |
| `./scripts/build-install-guide.sh` | Generate panduan instalasi lengkap |

---

## 📦 **Versi & Rilis**

| Link | Deskripsi |
|------|-----------|
| [GitHub Releases](https://github.com/nemoobc/opencode-termux/releases) | **Semua versi** (termasuk lama) + 6 artefak per versi |
| [npm Versions](https://www.npmjs.com/package/@nemoobc/opencode-termux?activeTab=versions) | History versi npm |
| [CHANGELOG.md](CHANGELOG.md) | Perubahan per versi |

**Skema versi:** `paket.opencodeUpstream.patch` — contoh: `1.20.3` (paket v1.20, upstream opencode-ai 1.18.23, patch 3)

---

## 🤝 **Kontribusi**

1. Fork & branch
2. Commit conventional (`feat:`, `fix:`, `docs:`, `chore:`)
3. Push & buat PR
4. CI otomatis jalan (test + build)
5. Review & merge

**Ide kontribusi:**
- Tambah agent/command baru di `agents/` & `commands/`
- Perbaiki docs di `docs/`
- Tambah bahasa support di skills (Rust, PHP, Ruby, dll)
- Optimasi musl loader build
- CI/CD improvement

---

## 📄 **Lisensi**

**MIT License** — bebas pakai, modifikasi, distribusi.

**Binary opencode resmi** dari upstream opencode-ai — paket ini hanya membungkus + menambah agent/automation.

---

## 🔗 **Link Penting**

| Link | Deskripsi |
|------|-----------|
| [GitHub Repo](https://github.com/nemoobc/opencode-termux) | Source code & issues |
| [GitHub Releases](https://github.com/nemoobc/opencode-termux/releases) | **Semua artefak rilis terpreservasi** |
| [npm Package](https://www.npmjs.com/package/@nemoobc/opencode-termux) | Install via npm |
| [opencode-ai (Upstream)](https://github.com/anomalyco/opencode) | **Source asli — credit utama** |
| [opencode.ai Docs](https://opencode.ai) | Dokumentasi upstream |
| [Termux F-Droid](https://f-droid.org/en/packages/com.termux/) | Termux yang benar (bukan Play Store) |

---

**Dibangun dengan ❤️ untuk komunitas Termux/Android**  
**Powered by [opencode-ai](https://github.com/anomalyco/opencode) — terima kasih tim anomalyco!** 🙏