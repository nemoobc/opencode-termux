#!/usr/bin/env bash
# build-all.sh — Build 4 essential packages untuk opencode-termux
# 1. opencode-termux-{v}.tgz              — npm package (npm install -g)
# 2. opencode-termux-{v}-aarch64.tar.gz    — offline bundle ARM64 (Termux)
# 3. opencode-termux-installer-{v}.sh      — universal installer (no Node, offline)
# 4. opencode-termux_{v}_aarch64.deb       — .deb package (pkg install)
# + SHA256SUMS + SHA512SUMS + RELEASE-NOTES
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VER=$(node -p "require('./package.json').version")
UPSTREAM=$(node -p "require('./package.json').opencodeUpstream")
OUT="${1:-dist}"
DATE=$(date -u +"%Y-%m-%d")

echo "=== Building opencode-termux v$VER (upstream opencode-ai v$UPSTREAM) ==="
rm -rf "$OUT"; mkdir -p "$OUT"

# ============================================================
# 1. NPM PACKAGE (.tgz) — untuk npm install -g
# ============================================================
echo "== 1/4: Building npm package =="
npm pack --pack-destination "$OUT" >/dev/null
mv "$OUT"/@nemoobc-opencode-termux-*.tgz "$OUT/opencode-termux-$VER.tgz" 2>/dev/null || true

# ============================================================
# 2. OFFLINE BUNDLE ARM64 (.tar.gz) — full vendor + source
# ============================================================
echo "== 2/4: Building offline bundle ARM64 =="
OCX_ARCH=arm64 OCX_FORCE=1 OCX_SKIP_SMOKE=1 node install.mjs >/dev/null
tar czf "$OUT/opencode-termux-$VER-aarch64.tar.gz" \
  --transform "s|^|opencode-termux/|" \
  bin lib vendor agents commands config LICENSE README.md docs

# Restore host arch vendor for local use
HOST_ARCH=$(node -p "process.arch === 'arm64' ? 'arm64' : 'x64'")
OCX_ARCH="$HOST_ARCH" OCX_FORCE=1 node install.mjs >/dev/null

# ============================================================
# 3. UNIVERSAL INSTALLER (.sh) — POSIX, no Node required
# ============================================================
echo "== 3/4: Building universal installer =="
sed "s/@VERSION@/$VER/" scripts/installer.sh > "$OUT/opencode-termux-installer-$VER.sh"
chmod +x "$OUT/opencode-termux-installer-$VER.sh"
# Symlink-less version for direct download
cp "$OUT/opencode-termux-installer-$VER.sh" "$OUT/opencode-termux-installer.sh"
chmod +x "$OUT/opencode-termux-installer.sh"

# ============================================================
# 4. DEBIAN PACKAGE (.deb) for Termux (pkg install)
# ============================================================
echo "== 4/4: Building .deb package for Termux =="
DEB_DIR="$OUT/deb-build"
rm -rf "$DEB_DIR"
mkdir -p "$DEB_DIR/DEBIAN"
mkdir -p "$DEB_DIR/data/data/com.termux/files/usr/lib/opencode-termux"
mkdir -p "$DEB_DIR/data/data/com.termux/files/usr/bin"

OCX_ARCH=arm64 OCX_FORCE=1 OCX_SKIP_SMOKE=1 node install.mjs >/dev/null
cp -r vendor/* "$DEB_DIR/data/data/com.termux/files/usr/lib/opencode-termux/"

cat > "$DEB_DIR/data/data/com.termux/files/usr/bin/opencode-termux" <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
LIBDIR="/data/data/com.termux/files/usr/lib/opencode-termux"
LD_LIBRARY_PATH="$LIBDIR/vendor" exec "$LIBDIR/vendor/ld-musl.so" "$LIBDIR/vendor/opencode" "$@"
EOF
chmod +x "$DEB_DIR/data/data/com.termux/files/usr/bin/opencode-termux"

cat > "$DEB_DIR/DEBIAN/control" <<EOF
Package: opencode-termux
Version: $VER
Architecture: aarch64
Maintainer: nemoobc <258114617+nemoobc@users.noreply.github.com>
Depends: nodejs-lts (>= 18), tar
Description: opencode CLI native untuk Termux/Android tanpa proot
 Membundel loader musl + binary opencode resmi (upstream opencode-ai v$UPSTREAM).
 Termasuk agent autodev, termux-coder, apk-builder, tester, fixer
 dan command /test, /fix, /build-apk, /release, /coder, /orchestrator.
Homepage: https://github.com/nemoobc/opencode-termux
EOF

cat > "$DEB_DIR/DEBIAN/postinst" <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
set -e
PREFIX="${TERMUX_PREFIX:-/data/data/com.termux/files/usr}"
mkdir -p "$PREFIX/etc"
[ -f "$PREFIX/etc/resolv.conf" ] || printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > "$PREFIX/etc/resolv.conf"
[ -f "$PREFIX/etc/hosts" ] || printf '127.0.0.1 localhost\n' > "$PREFIX/etc/hosts"
HOME_DIR="${HOME:-/data/data/com.termux/files/home}"
OC_DIR="$HOME_DIR/.config/opencode"
mkdir -p "$OC_DIR/agent" "$OC_DIR/command"
[ -d /data/data/com.termux/files/usr/lib/opencode-termux/agents ] && \
  cp -n /data/data/com.termux/files/usr/lib/opencode-termux/agents/* "$OC_DIR/agent/" 2>/dev/null || true
[ -d /data/data/com.termux/files/usr/lib/opencode-termux/commands ] && \
  cp -n /data/data/com.termux/files/usr/lib/opencode-termux/commands/* "$OC_DIR/command/" 2>/dev/null || true
[ -f /data/data/com.termux/files/usr/lib/opencode-termux/config/opencode.json ] && \
  [ ! -f "$OC_DIR/opencode.json" ] && \
  cp /data/data/com.termux/files/usr/lib/opencode-termux/config/opencode.json "$OC_DIR/opencode.json"
echo "[opencode-termux] Installed. Run 'opencode-termux' to start."
EOF
chmod +x "$DEB_DIR/DEBIAN/postinst"

dpkg-deb --build --root-owner-group "$DEB_DIR" "$OUT/opencode-termux_${VER}_aarch64.deb" >/dev/null
rm -rf "$DEB_DIR"

# ============================================================
# CHECKSUMS (SHA256 + SHA512)
# ============================================================
echo "== Generating checksums =="
( cd "$OUT" && ls | grep -vx 'SHA256SUMS.txt\|SHA512SUMS.txt' | xargs sha256sum > SHA256SUMS.txt )
( cd "$OUT" && ls | grep -vx 'SHA256SUMS.txt\|SHA512SUMS.txt' | xargs sha512sum > SHA512SUMS.txt )

# ============================================================
# RELEASE NOTES (adaptive — preserves history + per-artifact install)
# ============================================================
echo "== Generating release notes with per-artifact install guides =="
./scripts/generate-release-notes.sh "$VER" "$UPSTREAM" "$DATE" > "$OUT/RELEASE-NOTES-$VER.md"

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "=== Build Complete: v$VER ==="
ls -la "$OUT"
echo ""
echo "Artifacts (4 essential + checksums + notes):"
ls "$OUT" | sed 's/^/  /'
echo ""
ARTIFACT_COUNT=$(ls "$OUT" | grep -E '\.(tgz|tar\.gz|sh|deb)$' | grep -v 'opencode-termux-installer\.sh$' | wc -l)
echo "Core artifacts: $ARTIFACT_COUNT (expected 4)"
[ "$ARTIFACT_COUNT" -eq 4 ] || { echo "❌ core artifacts ≠ 4"; exit 1; }
echo "✅ 4 core artifacts + checksums + release notes siap di $OUT/"