#!/usr/bin/env bash
# Rakit seluruh artefak rilis opencode-termux (6 jenis file):
#   1. opencode-termux-installer.sh            — bootstrap tanpa Node
#   2. opencode-termux-<v>-aarch64.tar.gz      — bundle offline arm64
#   3. opencode-termux-<v>-x86_64.tar.gz       — bundle offline x64
#   4. nemoobc-opencode-termux-<v>.tgz         — paket npm
#   5. opencode-agents-and-config.zip          — paket agent/command/config
#   6. SHA256SUMS.txt                          — checksum semua di atas
set -euo pipefail
cd "$(dirname "$0")/.."

VER=$(node -p "require('./package.json').version")
OUT="${1:-dist}"
rm -rf "$OUT"; mkdir -p "$OUT"

echo "== bundle offline per arsitektur =="
for ARCH in arm64 x64; do
  NAME=aarch64; [ "$ARCH" = "x64" ] && NAME=x86_64
  echo "-- build $ARCH ($NAME)"
  OCX_ARCH="$ARCH" OCX_FORCE=1 OCX_SKIP_SMOKE=1 node install.mjs >/dev/null
  tar czf "$OUT/opencode-termux-$VER-$NAME.tar.gz" \
    --transform "s|^|opencode-termux/|" \
    bin lib vendor agents commands config LICENSE README.md
done
# pastikan vendor kembali ke arsitektur mesin ini untuk pemakaian lokal
HOST_ARCH=$(node -p "process.arch === 'arm64' ? 'arm64' : 'x64'")
OCX_ARCH="$HOST_ARCH" OCX_FORCE=1 node install.mjs >/dev/null

echo "== paket npm =="
npm pack --pack-destination "$OUT" >/dev/null

echo "== paket agent+command+config =="
zip -qr "$OUT/opencode-agents-and-config.zip" agents commands config

echo "== installer universal =="
sed "s/@VERSION@/$VER/" scripts/installer.sh > "$OUT/opencode-termux-installer.sh"
chmod +x "$OUT/opencode-termux-installer.sh"

echo "== checksums =="
( cd "$OUT" && ls | grep -vx SHA256SUMS.txt | xargs sha256sum > SHA256SUMS.txt )

echo "== hasil =="
ls -la "$OUT"
[ "$(ls "$OUT" | wc -l)" -eq 6 ] || { echo "❌ jumlah artefak ≠ 6"; exit 1; }
echo "✅ 6 artefak siap di $OUT/"
