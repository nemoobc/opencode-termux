# 📱 opencode-termux

**[opencode](https://opencode.ai) CLI native di Termux/Android — tanpa proot, tanpa root, plus agent & tools otomatis.**

Panduan lengkap: persyaratan → instalasi → verifikasi → penggunaan → update/uninstall → troubleshooting → FAQ.

---

## 1️⃣ Persyaratan

| Butuh | Nilai | Cara cek |
|---|---|---|
| Perangkat | Android 9+ **arm64** | `uname -m` di Termux → harus `aarch64` |
| Termux | Build **F-Droid / GitHub** — *bukan* Play Store | lihat [FAQ](#-faq) |
| Ruang | ± 500 MB bebas | `df -h $HOME \| tail -1` |
| Jaringan | Internet stabil | installer punya retry otomatis |

> ⚠️ Perangkat arm32 (`uname -m` → `armv7*`/`armv8l`) **belum didukung** karena
> upstream tidak menyediakan binary musl untuk arsitektur itu.

## 2️⃣ Siapkan Termux

```bash
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts tar
node --version   # harus >= 18
```

## 3️⃣ Instalasi

### Cara utama — npm

```bash
npm install -g @nemoobc/opencode-termux
```

Installer otomatis: mengunduh binary resmi opencode (diverifikasi **sha512**),
menyiapkan loader musl + libstdc++/libgcc, membetulkan DNS tanpa root, lalu
menjalankan smoke test. Selesai dalam ± 1 menit di jaringan normal.

> **Muncul warning `install-scripts`?** Izinkan sekali, lalu ulangi:
> ```bash
> npm config set allow-scripts=@nemoobc/opencode-termux --location=user
> npm rebuild -g @nemoobc/opencode-termux
> ```
> Lewat warning ini? Tidak apa — shim akan memasang bundle sendiri saat
> eksekusi pertama (auto-heal).

### Alternatif — tanpa install global

```bash
npx @nemoobc/opencode-termux --version
```

### Alternatif — tanpa Node / offline

Untuk HP yang kesulitan `npm` (atau menyiapkan paket di PC lalu dipindahkan):

1. Unduh 2 file dari [Releases](https://github.com/nemoobc/opencode-termux/releases):
   - `opencode-termux-installer.sh`
   - `opencode-termux-{versi}-aarch64.tar.gz`
2. Taruh **di folder yang sama**, lalu:
   ```bash
   sh opencode-termux-installer.sh
   ```

Installer mendeteksi bundle offline di sebelahnya otomatis — tanpa internet,
tanpa Node.js; checksum sha256 terverifikasi via `SHA256SUMS.txt`.

## 4️⃣ Verifikasi

```bash
opencode-termux --version   # contoh keluaran: nomor versi terpasang
opencode-termux doctor      # diagnosis lengkap lingkungan
```

Interpretasi `doctor`:

| Output | Arti | Tindakan |
|---|---|---|
| ✅ semua baris | sehat | lanjut pakai |
| ❌ vendor lengkap | bundle belum ada | `opencode-termux update` |
| ❌ tar tersedia | utilitas hilang | `pkg install tar` |
| ⚠️ platform bukan android | kamu di luar Android | wajar di CI/emulator |
| ⚠️ DNS resolv.conf | file belum ada | dibuat otomatis saat CLI pertama jalan |

## 5️⃣ Penggunaan

### Mulai cepat

```bash
mkdir -p ~/project-coba && cd ~/project-coba
opencode-termux
```

Config default sudah terpasang otomatis dengan **model gratis
`opencode/x-preview-f-free`** — tanpa API key. Lokasi config:
`~/.config/opencode/opencode.json` (milik user; installer tidak pernah menimpa).

### Perintah bawaan CLI

| Perintah | Fungsi |
|---|---|
| `opencode-termux` | Jalankan CLI opencode (argumen diteruskan) |
| `opencode-termux update` | Perbarui binary ke upstream terbaru |
| `opencode-termux doctor` | Diagnosis lingkungan & bundle (exit code jujur) |
| `opencode-termux version` | Info versi paket + binary |

Identitas perintah konsisten satu nama: **`opencode-termux`** — tanpa alias.

### Agent siap pakai

Sekali install — agent, command, dan config **langsung terpasang**:

| Agent | Tugas |
|---|---|
| **autodev** | Developer otonom universal: coding, tools, build, tes, fix, rilis — berurutan |
| **termux-coder** | Coding assistant yang paham Termux (PATH, pkg, tanpa root) |
| **apk-builder** | Build APK Android: payload, align, sign |
| **tester** | Jalankan seluruh test suite + laporan pass/fail |
| **fixer** | Loop perbaikan: uji → analisis → fix minimal → uji ulang (maks 5x) |

| Command | Fungsi |
|---|---|
| `/build-apk` | Build APK lengkap lewat agent apk-builder |
| `/test` | Seluruh test suite + laporan |
| `/fix` | Loop otomatis perbaiki semua tes gagal sampai hijau |
| `/release` | Bump versi → tag → release → bersih-bersih |

## 6️⃣ Update & uninstall

```bash
opencode-termux update                        # perbarui binary ke upstream terbaru
npm uninstall -g @nemoobc/opencode-termux     # copot paket
rm -rf ~/.opencode-termux                     # (opsional) hapus cache bundle lokal
```

Config dan riwayat di `~/.config/opencode/` tidak disentuh saat uninstall.

---

## 🩺 Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `tar: not found` saat install | utilitas tar belum ada | `pkg install tar` lalu `opencode-termux update` |
| `EACCES` / permission denied | salah kaprah pakai sudo | Termux tak punya root — jangan `sudo`; `npm rebuild -g @nemoobc/opencode-termux` |
| Timeout DNS / host not found | resolv.conf belum terbentuk | jalankan sekali: `opencode-termux`, cek `$PREFIX/etc/resolv.conf` |
| `Exec format error` | CPU bukan arm64/x64 | cek `uname -m`; arm32 tidak didukung |
| Bundle gagal unduh berkali-kali | jaringan operator bermasalah | coba WiFi / ganti DNS hotspot; installer retry 3x otomatis |
| `integritas gagal` saat install | unduhan korup | `opencode-termux update` — hash diverifikasi ulang |
| Node error `fetch is not defined` | Node < 18 | `pkg install nodejs-lts` |
| Termux dari Play Store crash/jadul | build Play Store dihentikan | pindah ke [build F-Droid](https://f-droid.org/en/packages/com.termux/) |

## ❓ FAQ

**Butuh root?** Tidak. Semua berjalan di ruang user Termux.

**Kenapa tidak pakai proot/chroot?** Overhead I/O proot besar di HP. Paket ini
menjalankan binary musl langsung: lebih cepat, lebih hemat baterai.

**Data apa yang disimpan?**
- `~/.config/opencode/` — config & agent/command kamu
- `<global-npm>/@nemoobc/opencode-termux/vendor/` — binary + loader (± 200 MB)

**Binary-nya resmi?** Ya — diunduh dari paket resmi upstream opencode,
diverifikasi sha512 terhadap registry. Paket ini hanya membungkus + menambal
loader libc agar ramah Termux.

**Bisa di emulator/Waydroid/x64?** Bisa — `OCX_ARCH=x64 OCX_FORCE=1 node install.mjs`.

## 🔗 Tautan

- Repo: <https://github.com/nemoobc/opencode-termux>
- npm: <https://www.npmjs.com/package/@nemoobc/opencode-termux>
- Rilis: <https://github.com/nemoobc/opencode-termux/releases>

## 📄 Lisensi

MIT. Binary opencode resmi dari upstream — paket ini hanya membungkus + menambah agent.
