#!/usr/bin/env bash
# build-install-guide.sh — panduan instalasi per versi.
# SUMBER TUNGGAL: docs/INSTALASI.md (anti-drift — panduan selalu sinkron
# dengan repo). Skrip ini hanya menempel header versi lalu mencetak ke stdout.
# Usage: ./scripts/build-install-guide.sh [version] [upstream]
set -euo pipefail

VER="${1:-$(node -p "require('./package.json').version")}"
UPSTREAM="${2:-$(node -p "require('./package.json').opencodeUpstream")}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/docs/INSTALASI.md" ]; then
  echo "[build-install-guide] docs/INSTALASI.md tidak ditemukan" >&2
  exit 1
fi

printf '# 📥 Panduan Instalasi Lengkap — opencode-termux v%s (upstream opencode v%s)\n\n' "$VER" "$UPSTREAM"
printf '> Di-generate %s — sumber kanonik: docs/INSTALASI.md\n\n' "$(date -u +"%Y-%m-%d")"
tail -n +3 "$ROOT/docs/INSTALASI.md"
