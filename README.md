# 📱 opencode-termux

**[opencode](https://opencode.ai) CLI native di Termux/Android — tanpa proot, tanpa root, plus agent & tools otomatis.**

[![npm](https://img.shields.io/npm/v/@nemoobc/opencode-termux?color=cb3837&logo=npm)](https://www.npmjs.com/package/@nemoobc/opencode-termux)
[![release](https://img.shields.io/github/v/release/nemoobc/opencode-termux?color=3B82F6)](https://github.com/nemoobc/opencode-termux/releases)
[![platform](https://img.shields.io/badge/platform-Android%20%7C%20Termux-3DDC84)](#)
[![arch](https://img.shields.io/badge/arch-arm64-blue)](#)
[![sync upstream](https://img.shields.io/badge/sync-upstream%20otomatis-C9A227)](.github/workflows/sync-upstream.yml)

---

## 🤖 Agent & tools otomatis

Sekali install — agent, command, dan config **langsung terpasang** tanpa setting ulang:

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

Config default ikut terpasang: **model gratis `opencode/x-preview-f-free`** — tanpa API key.

## 🔄 Sync upstream otomatis

Workflow GitHub mengecek [opencode-ai](https://github.com/anomalyco/opencode) baru setiap
6 jam — begitu ada versi baru, paket ini otomatis menyesuaikan (commit memakai identitas nemoobc).

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

## ✅ Verifikasi

```bash
opencode-termux --version
```

Alias biar terasa asli:

```bash
ln -sf $PREFIX/bin/opencode-termux $PREFIX/bin/opencode
```

## 📦 Versi

Tiga versi terakhir selalu tersedia — [lihat semua](https://www.npmjs.com/package/@nemoobc/opencode-termux?activeTab=versions).

## 📄 Lisensi

MIT. Binary opencode resmi dari upstream — paket ini hanya membungkus + menambah agent.
