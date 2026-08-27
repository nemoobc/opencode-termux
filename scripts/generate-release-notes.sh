#!/usr/bin/env bash
# generate-release-notes.sh — Adaptive release notes yang preserve history + per-artifact install
# Usage: ./scripts/generate-release-notes.sh <version> <upstream_version> <date>
set -euo pipefail

VER="${1:-$(node -p "require('./package.json').version")}"
UPSTREAM="${2:-$(node -p "require('./package.json').opencodeUpstream")}"
DATE="${3:-$(date -u +"%Y-%m-%d")}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Get git log since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  CHANGELOG=$(git log --oneline --pretty=format:"- %s (%h)" "$LAST_TAG"..HEAD 2>/dev/null | head -30)
else
  CHANGELOG=$(git log --oneline --pretty=format:"- %s (%h)" -30 2>/dev/null)
fi

# Get upstream changes
UPSTREAM_CHANGES=""
if command -v curl >/dev/null 2>&1; then
  UPSTREAM_CHANGES=$(curl -sf "https://api.github.com/repos/anomalyco/opencode/compare/v${UPSTREAM}...main" 2>/dev/null | \
    python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    commits = data.get('commits', [])
    for c in commits[:10]:
        msg = c['commit']['message'].split('\n')[0]
        print(f'- {msg} ({c[\"sha\"][:7]})')
except:
    pass
" 2>/dev/null || echo "- Unable to fetch upstream changes")
fi

# Read common description from package.json (single source of truth)
DESC=$(node -p "require('./package.json').description")

cat <<EOF
# 📦 opencode-termux v$VER — Release Notes

**Tanggal:** $DATE  
**Upstream:** opencode-ai v$UPSTREAM  
**Platform:** Android/Termux (ARM64)  
**Lisensi:** MIT

---

## 🎯 $DESC

### ✨ Fitur Utama (v$VER)
- **AUTODEV Agent** — Developer otonom universal multi-bahasa
  - \`/coder full\` — Full lifecycle: audit → test → monitor → fix → compact
  - \`/coder audit\` — Scan project lengkap (struktur, deps, security, style, arch)
  - \`/coder test\` — Jalankan semua test per bahasa dengan coverage
  - \`/coder monitor\` — Daemon: file watch, CI status, perf baseline, log tail
  - \`/coder fix\` — Auto-fix loop (max 5 iterasi per bug, regression check)
  - \`/coder compact\` — Optimasi: dead code, format, deps, bundle, perf
- **Orchestrator** — Koordinator tahapan dengan state persistence & resume
- **5 Skills Built-in:** audit, test, monitor, fix, compact (multi-language)

---

## 📦 4 Paket Rilis (Essential)

| File | Format | Ukuran | Target | Cara Install |
|------|--------|--------|--------|--------------|
| \`opencode-termux-$VER.tgz\` | \`.tgz\` | ~200 KB | **npm global** | \`npm install -g @nemoobc/opencode-termux\` |
| \`opencode-termux-$VER-aarch64.tar.gz\` | \`.tar.gz\` | ~180 MB | **Offline ARM64** | \`sh opencode-termux-installer.sh\` (butuh bundle di samping) |
| \`opencode-termux-installer-$VER.sh\` | \`.sh\` | ~10 KB | **Universal (no Node)** | \`sh opencode-termux-installer.sh\` |
| \`opencode-termux_${VER}_aarch64.deb\` | \`.deb\` | ~180 MB | **Termux apt** | \`pkg install ./opencode-termux_${VER}_aarch64.deb\` |

> **Checksum:** \`SHA256SUMS.txt\` & \`SHA512SUMS.txt\` termasuk untuk verifikasi integritas

---

## 📥 Panduan Install Per-Artefak (Lengkap)

### 1️⃣ Via npm (Recommended — Online)
```bash
pkg update && pkg install nodejs-lts tar
npm install -g @nemoobc/opencode-termux
opencode-termux --version
```
> ⚠️ Warning \`install-scripts\`? Izinkan sekali:
> ```bash
> npm config set allow-scripts=@nemoobc/opencode-termux --location=user
> npm rebuild -g @nemoobc/opencode-termux
> ```

### 2️⃣ Via Offline Installer (Tanpa Node.js / Tanpa Internet)
**Cocok untuk:** HP tanpa internet, install massal, air-gapped
```bash
# 1. Download 2 file dari GitHub Releases v$VER:
#    - opencode-termux-installer-$VER.sh
#    - opencode-termux-$VER-aarch64.tar.gz
#    - SHA256SUMS.txt (untuk verifikasi)

# 2. Taruh di folder yang sama, verifikasi:
sha256sum -c SHA256SUMS.txt

# 3. Jalankan installer (POSIX sh, no Node):
sh opencode-termux-installer.sh
```
**Detail installer:** Murni POSIX sh, auto-detect arm64/x86_64, offline-first, checksum verified, install ke \$PREFIX, DNS auto-setup, smoke test.

### 3️⃣ Via .deb Package (Termux apt)
```bash
pkg install ./opencode-termux_${VER}_aarch64.deb
```
**Isi .deb:** Binary + vendor di \`/data/data/com.termux/files/usr/lib/opencode-termux/\`, wrapper CLI di \`/data/data/com.termux/files/usr/bin/opencode-termux\`, postinst auto-setup DNS + copy agent/command/config ke \`~/.config/opencode/\`.

---

## ✅ Verifikasi & Quick Start

```bash
# Verifikasi
opencode-termux --version
opencode-termux doctor

# Quick start
mkdir -p ~/project-coba && cd ~/project-coba
opencode-termux
```

**Config default:** Model gratis \`opencode-zen/kimi-k2-5\` — tanpa API key.  
**Lokasi config:** \`~/.config/opencode/opencode.json\` (tidak pernah ditimpa installer).

---

## 🤖 Agent & Command (Auto-installed)

| Command | Fungsi | Agent |
|---------|--------|-------|
| \`/coder full\` | **Full lifecycle: audit→test→monitor→fix→compact** | **autodev** |
| \`/coder audit\` | Scan project lengkap | autodev |
| \`/coder test\` | Jalankan semua test | autodev |
| \`/coder monitor\` | Start daemon (watch+CI+perf) | autodev |
| \`/coder fix\` | Auto-fix failure | autodev |
| \`/coder compact\` | Optimasi kode | autodev |
| \`/orchestrator full\` | Koordinator dengan state | orchestrator |
| \`/test\` | Test suite + laporan | tester |
| \`/fix\` | Loop perbaiki sampai hijau | fixer |
| \`/build-apk\` | Build APK Android | apk-builder |
| \`/release\` | Bump → tag → release | apk-builder |

---

## 🔄 Upstream Changes (opencode-ai v$UPSTREAM)

$UPSTREAM_CHANGES

---

## 📋 Changelog (since v$LAST_TAG)

$CHANGELOG

---

## 📚 Dokumentasi (Versioned — Tidak Hilang Saat Update)

| File | Deskripsi |
|------|-----------|
| \`docs/INSTALASI.md\` | Panduan detail + troubleshooting + FAQ |
| \`README.md\` | Ringkasan project + quick start + attribution |
| \`CHANGELOG.md\` | Riwayat perubahan kumulatif |
| \`prebuilt/README.md\` | Cara rebuild musl loader |
| Agent & Command docs | Di \`agents/\` & \`commands/\` |

> 💡 **Philosophy:** Semua docs *versioned* — upgrade ke v$VER+1, file v$VER tetap ada di GitHub Releases. History tidak hilang.

---

## ✅ Verifikasi Integritas

\`\`\bash
sha256sum -c SHA256SUMS.txt
sha512sum -c SHA512SUMS.txt
\`\`\`

---

## 📝 Catatan Upgrade

- **Config user** (\`~/.config/opencode/\`) **tidak pernah ditimpa** saat update
- **Agent & command** custom di \`~/.config/opencode/agent/\` & \`command/\` aman
- **Binary vendor** di-update otomatis via \`opencode-termux update\`
- **Rollback:** Download versi lama dari GitHub Releases, jalankan installer

---

## 🙏 Attribution

### Source Asli: **opencode-ai** (anomalyco)
🔗 https://github.com/anomalyco/opencode | 📦 https://www.npmjs.com/package/opencode-ai

> opencode-termux hanya membungkus & menyesuaikan binary resmi opencode-ai untuk Termux/Android. **Semua credit core CLI, agent system, LLM integration, arsitektur utama milik opencode-ai team.**

### Kontributor
- **nemoobc** — Packaging, musl loader, Termux adaptation, agent ecosystem, automation
- **Community** — Testing, bug reports, feature requests

---

*Generated by \`scripts/generate-release-notes.sh\` — preserves history + per-artifact install guides*
EOF

# Append to history file (preserves across releases)
{
  echo ""
  echo "---"
  echo ""
  cat <<EOF
# v$VER ($DATE)
Upstream: opencode-ai v$UPSTREAM

$CHANGELOG
EOF
} >> "$ROOT/RELEASE-HISTORY.md"

echo "Release notes generated: RELEASE-NOTES-$VER.md"
echo "History updated: RELEASE-HISTORY.md"