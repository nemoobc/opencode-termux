# 📱 opencode-termux

**[opencode](https://opencode.ai) CLI native di Termux/Android — tanpa proot, tanpa root, plus agent & tools otomatis.**

[![npm](https://img.shields.io/npm/v/@nemoobc/opencode-termux?color=cb3837&logo=npm)](https://www.npmjs.com/package/@nemoobc/opencode-termux)
[![release](https://img.shields.io/github/v/release/nemoobc/opencode-termux?color=3B82F6)](../../releases)
[![CI](https://img.shields.io/github/actions/workflow/status/nemoobc/opencode-termux/test.yml?label=test&color=22C55E)](.github/workflows/test.yml)
[![platform](https://img.shields.io/badge/platform-Android%20%7C%20Termux-3DDC84)](#)
[![arch](https://img.shields.io/badge/arch-arm64-blue)](#)

---

## ⚡ Ringkasan

Installer resmi `opencode-ai` gagal di Termux (tidak mengenali Android/Bionic).
Paket ini menjalankan binary resmi opencode **langsung** lewat loader musl yang
dipatch khusus Termux — tanpa proot, tanpa root:

```
opencode-termux (shim Node)
   └─ vendor/ld-musl.so      ← musl libc build khusus Termux*
        └─ vendor/opencode   ← binary resmi opencode-linux-arm64-musl
```

\* DNS dipatch ke `$PREFIX/etc/` sehingga jalan tanpa root.

## 🤖 Yang ikut terpasang otomatis

| Agent | Tugas |
|---|---|
| **autodev** | Developer otonom: coding → build → tes → fix → rilis |
| **termux-coder** | Coding assistant yang paham Termux (PATH, pkg, tanpa root) |
| **apk-builder** | Build APK Android: payload, align, sign |
| **tester** | Seluruh test suite + laporan pass/fail |
| **fixer** | Loop perbaikan sampai hijau (maks 5 iterasi) |

| Command | Fungsi |
|---|---|
| `/build-apk` · `/test` · `/fix` · `/release` | Otomasi lengkap dari dalam CLI |

Config default ikut terpasang: **model gratis `opencode/x-preview-f-free`** — tanpa API key.

## 🛠 Perintah CLI

| Perintah | Fungsi |
|---|---|
| `opencode-termux` | Jalankan CLI opencode (argumen diteruskan) |
| `opencode-termux update` | Perbarui binary ke upstream terbaru |
| `opencode-termux doctor` | Diagnosis lingkungan & bundle |
| `opencode-termux version` | Info versi paket + binary |

## 🚀 Mulai cepat

```bash
pkg update -y && pkg install -y nodejs-lts tar
npm i -g @nemoobc/opencode-termux
opencode-termux --version
```

## 📖 Dokumentasi

- **Instalasi lengkap & penggunaan**: [docs/INSTALASI.md](docs/INSTALASI.md) atau [Releases](../../releases)
- Tanpa Node / offline? Ambil installer sh + bundle `.tar.gz` di [Releases](../../releases)

## 🔒 Keamanan & sync

- Binary diverifikasi **sha512** terhadap metadata registry npm.
- Workflow mengecek upstream [opencode-ai](https://github.com/anomalyco/opencode) tiap 6 jam dan auto-sinkron.

## 📄 Lisensi

MIT. Binary opencode resmi dari upstream — paket ini hanya membungkus + menambah agent.
