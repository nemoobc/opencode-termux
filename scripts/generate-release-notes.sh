#!/usr/bin/env bash
# generate-release-notes.sh — release notes adaptif & JUJUR (tanpa klaim usang:
# tanpa agent/command bonus, tanpa .deb — artefak mengikuti build-release.sh).
# TIDAK menulis RELEASE-HISTORY.md — history dikelola workflow sync-upstream
# + entry manual; skrip ini murni mencetak draft notes ke stdout.
# Usage: ./scripts/generate-release-notes.sh [version] [upstream] [date]
set -euo pipefail

VER="${1:-$(node -p "require('./package.json').version")}"
UPSTREAM="${2:-$(node -p "require('./package.json').opencodeUpstream")}"
DATE="${3:-$(date -u +"%Y-%m-%d")}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  CHANGELOG=$(git log --oneline --pretty=format:"- %s (%h)" "$LAST_TAG"..HEAD 2>/dev/null | head -30)
else
  CHANGELOG=$(git log --oneline --pretty=format:"- %s (%h)" -30 2>/dev/null)
fi

cat <<EOF
# 📦 opencode-termux v$VER — Release Notes
Upstream: opencode v$UPSTREAM · $DATE

Binary opencode resmi (musl) dibungkus native untuk Termux/Android — tanpa
proot, tanpa root. Instalasi ber-staging + rollback; binary diverifikasi
pin sha256 (bila tersedia) + gzip + cek ELF.

## 🔧 Perubahan (sejak ${LAST_TAG:-(awal)})
$CHANGELOG

## 📦 6 Artefak Rilis
| File | Target |
|------|--------|
| nemoobc-opencode-termux-$VER.tgz | npm (install global) |
| opencode-termux-$VER-aarch64.tar.gz | bundle offline ARM64 (Termux) |
| opencode-termux-$VER-x86_64.tar.gz | bundle offline x86_64 |
| opencode-config.zip | config default (tanpa menimpa milik user) |
| opencode-termux-installer.sh | installer POSIX sh (tanpa Node, offline-capable) |
| SHA256SUMS.txt | checksum semua artefak — verifikasi dulu |

## 🚀 Instalasi
- npm:      \`npm install -g @nemoobc/opencode-termux\`
- offline:  taruh installer + bundle \`-aarch64\` di satu folder lalu
            \`sh opencode-termux-installer.sh\`
- verifikasi: \`sha256sum -c SHA256SUMS.txt\` (WAJIB sebelum eksekusi)

## ✅ Verifikasi Cepat
\`opencode-termux --version\` → versi binary upstream
\`opencode-termux doctor\`    → diagnosa lingkungan & bundle

Panduan lengkap: docs/INSTALASI.md · Riwayat: RELEASE-HISTORY.md
EOF
