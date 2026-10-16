#!/bin/sh
# opencode-termux installer — TANPA butuh Node.js
# Pakai:  sh opencode-termux-installer.sh
# Online : unduh bundle dari GitHub Releases (curl/wget)
# Offline: otomatis pakai file opencode-termux-<ver>-<arch>.tar.gz di folder yang sama
set -eu

VERSION="@VERSION@"
REPO="nemoobc/opencode-termux"
BASE="https://github.com/$REPO/releases/download/v$VERSION"

say() { printf '[opencode-termux] %s\n' "$*"; }
die() { printf '[opencode-termux] ❌ %s\n' "$*" >&2; exit 1; }

# ---- deteksi arsitektur -------------------------------------------------
case "$(uname -m)" in
  aarch64|arm64)   ARCH=aarch64 ;;
  x86_64|amd64)    ARCH=x86_64 ;;
  *) die "arsitektur $(uname -m) tidak didukung (butuh arm64/x86_64)" ;;
esac

# ---- tentukan lokasi instalasi -----------------------------------------
IS_TERMUX=0
if [ -n "${TERMUX_VERSION:-}" ]; then IS_TERMUX=1; fi
if [ -n "${OCX_LIBDIR:-}" ] || [ -n "${OCX_BINDIR:-}" ]; then
  # override eksplisit selalu menang (berguna untuk uji & lokasi kustom)
  LIBDIR="${OCX_LIBDIR:-$HOME/.local/lib/opencode-termux}"
  BINDIR="${OCX_BINDIR:-$HOME/.local/bin}"
elif [ "$IS_TERMUX" = 1 ] || [ -d /data/data/com.termux ]; then
  PREFIX="${TERMUX_PREFIX:-/data/data/com.termux/files/usr}"
  LIBDIR="$PREFIX/lib/opencode-termux"
  BINDIR="$PREFIX/bin"
else
  LIBDIR="${OCX_LIBDIR:-$HOME/.local/lib/opencode-termux}"
  BINDIR="${OCX_BINDIR:-$HOME/.local/bin}"
fi

# ---- sumber bundle: offline dulu, online kemudian -----------------------
HERE=$(cd "$(dirname "$0")" 2>/dev/null && pwd || pwd)
LOCAL_BUNDLE="$HERE/opencode-termux-$VERSION-$ARCH.tar.gz"
# direktori sementara ramah-Termux (Termux tak punya /tmp bawaan)
PREF_TMP="${TMPDIR:-${PREFIX:-/data/data/com.termux/files/usr}/tmp}"
mkdir -p "$PREF_TMP" 2>/dev/null || PREF_TMP="$(pwd)/.ocx-tmp"
WORK="$PREF_TMP/ocx-install-$$"
mkdir -p "$WORK"
trap 'rm -rf "$WORK" "$LIBDIR.new"' EXIT

fetch() { # fetch <url> <dest>
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -qO "$2" "$1"
  else return 1; fi
}

if [ -f "$LOCAL_BUNDLE" ]; then
  say "mode offline — memakai $LOCAL_BUNDLE"
  cp "$LOCAL_BUNDLE" "$WORK/bundle.tar.gz"
else
  say "mengunduh bundle $ARCH v$VERSION…"
  fetch "$BASE/opencode-termux-$VERSION-$ARCH.tar.gz" "$WORK/bundle.tar.gz" \
    || die "unduhan gagal & tidak ada bundle offline di samping installer"
fi

# ---- pasang (staging + swap: instalasi lama tak tersentuh sampai smoke lolos)
say "memasang ke $LIBDIR…"
mkdir -p "$BINDIR"
rm -rf "$LIBDIR.new"
mkdir -p "$LIBDIR.new"
tar xzf "$WORK/bundle.tar.gz" -C "$LIBDIR.new" --strip-components=1

VENDOR="$LIBDIR/vendor"
OC="$VENDOR/opencode"
LOADER="$VENDOR/ld-musl.so"
PATCHER="$VENDOR/patchelf"
MARK="$LIBDIR/.interp-patched"

# swap: LIBDIR lama dipindah ke .old (rollback bila smoke gagal)
rm -rf "$LIBDIR.old"
if [ -e "$LIBDIR" ]; then mv "$LIBDIR" "$LIBDIR.old"; fi
mv "$LIBDIR.new" "$LIBDIR"

# ---- first-run patch PT_INTERP (bundle rilis di-cross-build di CI) ------
# Bundle menyimpan binary dengan INTERP bawaan (/lib/ld-musl-*.so.1 — tak ada
# di Termux) atau path CI. Patch ke loader vendor DI SINI (selalu native),
# interp-only TANPA --set-rpath (terbukti SIGSEGV). Gagal → jalur loader.
rm -f "$MARK"
if [ -x "$LOADER" ] && [ -f "$OC" ]; then
  if head -c 65536 "$OC" | grep -aqF "$LOADER"; then
    touch "$MARK"                       # INTERP sudah menunjuk lokasi final
  elif [ -x "$PATCHER" ]; then
    say "patch PT_INTERP ke loader vendor (first-run)…"
    if "$LOADER" --library-path "$VENDOR" "$PATCHER" \
         --set-interpreter "$LOADER" "$OC" 2>/dev/null \
       && LD_LIBRARY_PATH="$VENDOR" "$OC" --version >/dev/null 2>&1; then
      touch "$MARK"
      say "✅ binary dipatch (interp-only, tanpa RPATH)"
    else
      say "⚠️ patch gagal — wrapper pakai jalur loader (perintah sekali-jalan tetap jalan)"
    fi
  else
    say "⚠️ patchelf tidak ditemukan — wrapper pakai jalur loader"
  fi
fi

# wrapper CLI (sh murni, tanpa node)
# rm -f dulu agar ikut menimpa symlink npm lama (bukan menulis ke target-nya)
rm -f "$BINDIR/opencode-termux"
{
  printf '#!/bin/sh\n'
  printf 'LIBDIR=%s\n' "\"$LIBDIR\""
  printf 'export LD_PRELOAD=\n'
  printf 'export LD_LIBRARY_PATH="$LIBDIR/vendor"\n'
  printf 'export TMPDIR="${TMPDIR:-$LIBDIR/tmp}"\n'
  printf 'mkdir -p "$TMPDIR"\n'
  printf 'if [ -f "$LIBDIR/.interp-patched" ]; then\n'
  printf '  exec "$LIBDIR/vendor/opencode" "$@"\n'
  printf 'fi\n'
  printf 'exec "$LIBDIR/vendor/ld-musl.so" --library-path "$LIBDIR/vendor" "$LIBDIR/vendor/opencode" "$@"\n'
} > "$BINDIR/opencode-termux"
chmod +x "$BINDIR/opencode-termux"

# DNS ramah-Termux (tanpa root)
if [ "$IS_TERMUX" = 1 ]; then
  mkdir -p "$PREFIX/etc" 2>/dev/null || true
  [ -f "$PREFIX/etc/resolv.conf" ] || printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > "$PREFIX/etc/resolv.conf" 2>/dev/null || true
  [ -f "$PREFIX/etc/hosts" ] || printf '127.0.0.1 localhost\n' > "$PREFIX/etc/hosts" 2>/dev/null || true
fi

# ---- smoke test (via wrapper — menguji jalur exec yang sebenarnya) -------
if "$BINDIR/opencode-termux" --version >"$WORK/ocx-ver.$$" 2>&1; then
  say "✅ terpasang: $("$BINDIR/opencode-termux" --version)"
  rm -rf "$LIBDIR.old"
else
  cat "$WORK/ocx-ver.$$" >&2 || true
  # rollback: kembalikan instalasi lama (bila ada)
  if [ -e "$LIBDIR.old" ]; then
    rm -rf "$LIBDIR"
    mv "$LIBDIR.old" "$LIBDIR"
    say "instalasi lama dikembalikan (tidak ada yang berubah)"
  fi
  die "smoke test gagal — pastikan arsitektur didukung lalu coba lagi"
fi
