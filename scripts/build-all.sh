#!/usr/bin/env bash
# build-all.sh — LEGACY alias (pra-v1.20.3).
# Rilis resmi sekarang dibangun oleh scripts/build-release.sh (6 artefak,
# tanpa .deb — .deb dipensiunkan sejak v1.20.3). Skrip ini hanya meneruskan.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[build-all] LEGACY — meneruskan ke scripts/build-release.sh (6 artefak, tanpa .deb)"
exec bash scripts/build-release.sh "${1:-dist}"
