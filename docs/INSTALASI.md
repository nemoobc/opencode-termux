# 📥 Panduan Instalasi Lengkap — opencode-termux

Panduan end-to-end: persyaratan → instalasi → verifikasi → pemakaian pertama →
update/uninstall → troubleshooting → FAQ.

---

## 1️⃣ Persyaratan

| Butuh | Nilai | Cara cek |
|---|---|---|
| Perangkat | Android 9+ **arm64** | jalankan `uname -m` di Termux → harus `aarch64` |
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

### Alternatif tanpa install global

```bash
npx @nemoobc/opencode-termux --version
```

### Alternatif tanpa Node / instalasi offline

Untuk HP yang kesulitan `npm` (atau menyiapkan paket di PC lalu dipindahkan):

1. Unduh 2 file dari [Releases](https://github.com/nemoobc/opencode-termux/releases):
   - `opencode-termux-installer.sh`
   - `opencode-termux-<versi>-aarch64.tar.gz` (sesuai arsitektur)
2. Taruh **di folder yang sama**, lalu:
   ```bash
   sh opencode-termux-installer.sh
   ```

Installer mendeteksi bundle offline di sebelahnya otomatis — tanpa internet,
tanpa Node.js, checksum sha256 ikut terverifikasi via `SHA256SUMS.txt`.

### **Instalasi per-artefak (dari GitHub Releases)**

Semua file diunduh dari
**[Releases](https://github.com/nemoobc/opencode-termux/releases)**. Ganti `{v}`
dengan versi (contoh `1.20.3`), dan `-aarch64` dengan `-x86_64` kalau kamu di
emulator/PC. **Verifikasi dulu sebelum dipakai:** `sha256sum -c SHA256SUMS.txt`.

| # | Artefak | Cara install / pakai |
|---|---------|----------------------|
| 1 | `nemoobc-opencode-termux-{v}.tgz` | Paket npm. `npm install -g ./nemoobc-opencode-termux-{v}.tgz` |
| 2 | `opencode-termux-{v}-aarch64.tar.gz` | **Bundle offline arm64.** Taruh di folder yang sama dengan installer lalu `sh opencode-termux-installer.sh`. (Manual: `tar xzf ... -C ~/.local/lib/opencode-termux --strip-components=1`) |
| 3 | `opencode-termux-{v}-x86_64.tar.gz` | Bundle offline untuk emulator/PC x64. Sama seperti #2. |
| 4 | `opencode-agents-and-config.zip` | Agent + command + config saja. `unzip opencode-agents-and-config.zip -d ~/.config/opencode` (tidak menimpa `opencode.json` yang sudah ada). |
| 5 | `opencode-termux-installer.sh` | **Installer universal.** `sh opencode-termux-installer.sh`. Di Termux memasang ke `$PREFIX/lib/opencode-termux` + `$PREFIX/bin`; di luar Termux ke `~/.local/{lib,bin}`. Bisa offline (bundle di sampingnya) atau online (unduh otomatis). |
| 6 | `SHA256SUMS.txt` | Verifikasi keutuhan semua artefak: `sha256sum -c SHA256SUMS.txt`. |

Contoh verifikasi lengkap lalu install offline:

```bash
# taruh ketiga file di satu folder, lalu:
sha256sum -c SHA256SUMS.txt          # semua harus 'OK'
sh opencode-termux-installer.sh       # pakai bundle -aarch64 di sampingnya
```

> ⚠️ Artefak `.deb` dihapus sejak v1.20.3 (paket fokus npm + installer.sh +
> bundle tarball). Butuh `.deb`? Ambil dari rilis lama.

## 4️⃣ Verifikasi

```bash
opencode-termux --version   # contoh: 1.18.22
opencode-termux doctor      # diagnosis lengkap lingkungan
```

Interpretasi `doctor`:

| Output | Arti | Tindakan |
|---|---|---|
| ✅ semua baris | sehat | lanjut pakai |
| ❌ vendor lengkap | bundle belum ada | `opencode-termux update` |
| ❌ tar tersedia | utilitas hilang | `pkg install tar` |
| ⚠️ platform bukan android | kamu di luar Android | wajar di CI/emulator |
| ⚠️ DNS resolv.conf | file belum ada | dibuat otomatis saat menjalankan CLI |

## 5️⃣ Pemakaian pertama

```bash
mkdir -p ~/project-coba && cd ~/project-coba
opencode-termux
```

Config default sudah terpasang otomatis dengan **model
`opencode-zen/kimi-k2-5`** (provider zen) — tanpa API key. Lokasi config:
`~/.config/opencode/opencode.json` (milik user; installer tidak pernah menimpa).

Bonus ikut terpasang — agent & command siap pakai:

| Command | Fungsi |
|---|---|
| `/test` | seluruh test suite + laporan |
| `/fix` | loop perbaikan sampai hijau |
| `/build-apk` | build APK lewat agent apk-builder |
| `/release` | bump → tag → release |

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
| `EACCES` / permission denied | salah kaprah pakai sudo | Termux tak punya root — jangan `sudo`; error lain? `npm rebuild -g @nemoobc/opencode-termux` |
| Timeout DNS / host not found | resolv.conf belum terbentuk | jalankan sekali: `opencode-termux` (dibuat otomatis), cek `$PREFIX/etc/resolv.conf` |
| `Exec format error` | CPU bukan arm64/x64 | cek `uname -m`; arm32 tidak didukung |
| Bundle gagal unduh berkali-kali | jaringan operator bermasalah | coba WiFi / ganti DNS hotspot; installer retry 3x otomatis |
| `integritas gagal` saat install | unduhan korup | jalankan lagi `opencode-termux update` — hash diverifikasi ulang |
| Node error `fetch is not defined` | Node < 18 | `pkg install nodejs-lts` (yang baru) |
| Termux dari Play Store crash/versi jadul | build Play Store dihentikan | pindah ke [build F-Droid](https://f-droid.org/en/packages/com.termux/) |

## ❓ FAQ

**Butuh root?** Tidak. Semua berjalan di ruang user Termux.

**Kenapa tidak pakai proot/chroot seperti lainnya?** Bisa saja — tapi overhead
I/O proot besar di HP. Paket ini menjalankan binary musl langsung: lebih cepat,
lebih hemat baterai.

**Data apa yang disimpan?**
- `~/.config/opencode/` — config & agent/command kamu
- `<global-npm>/@nemoobc/opencode-termux/vendor/` — binary + loader (± 200 MB)

**Apakah binary-nya resmi?** Ya — diunduh dari npm `opencode-linux-arm64-musl`
resmi milik upstream opencode, diverifikasi sha512 terhadap registry. Paket ini
hanya membungkus + menambal loader libc agar ramah Termux.

**Bisa dipakai di emulator/Waydroid/x64?** Bisa — jalankan manual dengan
`OCX_ARCH=x64 OCX_FORCE=1 node install.mjs`.
