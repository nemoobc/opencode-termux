# 📱 opencode-termux

**[opencode](https://opencode.ai) CLI native di Termux/Android — TANPA proot, TANPA root.**

[![npm](https://img.shields.io/npm/v/@nemoobc/opencode-termux?color=cb3837&logo=npm)](https://www.npmjs.com/package/@nemoobc/opencode-termux)
[![platform](https://img.shields.io/badge/platform-Android%20%7C%20Termux-3DDC84)](#)
[![arch](https://img.shields.io/badge/arch-arm64-blue)](#)

---

## Kenapa paket ini ada?

Installer resmi `opencode-ai` gagal di Termux karena tidak mengenali
`process.platform === "android"` dan tidak menyediakan build untuk Bionic libc.

Paket ini menjembatani tanpa trik aneh:

```
opencode-termux (shim Node)
   └─ vendor/ld-musl.so          ← musl libc hasil build khusus Termux*
        └─ vendor/opencode       ← binary resmi opencode-linux-arm64-musl
             ⤳ LD_LIBRARY_PATH → libstdc++ / libgcc_s (dari Alpine)
```

\* path `/etc/resolv.conf` & `/etc/hosts` dipatch saat kompilasi menuju
`$PREFIX/etc/` sehingga DNS jalan tanpa root.

## 🚀 Install

```bash
pkg update && pkg install nodejs-lts
npm i -g @nemoobc/opencode-termux
```

> Jika muncul warning `install-scripts`, izinkan sekali:
> ```bash
> npm config set allow-scripts=@nemoobc/opencode-termux --location=user
> npm rebuild -g @nemoobc/opencode-termux
> ```
> (atau abaikan — shim akan memasang bundle otomatis saat pertama dijalankan)

Alias biar terasa asli:

```bash
ln -sf $PREFIX/bin/opencode-termux $PREFIX/bin/opencode
```

## ✅ Verifikasi

```bash
opencode-termux --version     # versi upstream opencode
opencode-termux models        # katalog model (tes jaringan/DNS)
```

Model gratis default: **`opencode/x-preview-f-free`** (Ox Alpha Free · Unlimited).

## 🔧 Troubleshooting

| Masalah | Solusi |
|---|---|
| `Permission denied` saat menjalankan | `chmod +x $PREFIX/lib/node_modules/@nemoobc/opencode-termux/bin/opencode.js` |
| Warning `install-scripts` | lihat bagian Install |
| Perintah jaringan gantung | pastikan `$PREFIX/etc/resolv.conf` ada — installer/shim membuatnya otomatis |
| Versi upstream lama | `npm i -g @nemoobc/opencode-termux@latest` — installer selalu tarik rilis terbaru |

## ⚠️ Pesan error yang datang dari provider (BUKAN bug paket ini)

Paket ini hanya menjalankan binary resmi opencode. Error model/network berasal
dari server provider — beberapa di antaranya tampil dalam bahasa Mandarin
karena backend relay model gratisnya memang begitu.

**1. `Upstream request failed: 图片输入格式/解析错误 [retrying...]`**

Artinya: *"format/parsing input gambar salah"*. Muncul ketika ada **gambar**
masuk ke konteks percakapan (file gambar/GIF yang dibaca, paste screenshot,
dsb.) dan endpoint model gagal memprosesnya.

Cara mengatasinya:
- Mulai sesi baru dengan `/new`, lalu hindari membaca/melampirkan gambar.
- Atau ganti ke model lain lewat `/models`.

**2. `service unavailable`**

Server model sedang overload/down sesaat. opencode sudah retry otomatis
(`attempt #n`) — biasanya pulih sendiri beberapa detik kemudian. Kalau sering:
ganti model dulu via `/models`, coba lagi nanti.

**3. Saat keluar muncul `opencode -s <id>`**

Itu **bukan error** — petunjuk resmi untuk melanjutkan sesi terakhir.
Jalankan persis perintah itu jika ingin lanjut, atau abaikan saja.

## ⚙️ Variabel lingkungan

| Var | Fungsi |
|---|---|
| `OCX_UPSTREAM` | paksa versi upstream tertentu (default: terbaru) |
| `OCX_ARCH` / `OCX_FORCE` | uji bundle di non-Android (`x64`) |

## 📜 Lisensi

MIT. Binary opencode adalah milik proyek [opencode](https://github.com/sst/opencode) (MIT).
