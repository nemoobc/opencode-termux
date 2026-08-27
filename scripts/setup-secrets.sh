#!/usr/bin/env bash
# setup-secrets.sh — Panduan setup GitHub Secrets untuk opencode-termux
# Jalankan: source scripts/setup-secrets.sh (atau copy-paste manual)

set -euo pipefail

echo "============================================="
echo "  GitHub Secrets Setup untuk opencode-termux"
echo "============================================="
echo ""
echo "Buka: https://github.com/nemoobc/opencode-termux/settings/secrets/actions"
echo "Klik 'New repository secret' untuk masing-masing:"
echo ""

# ============================================================
# GH_PAT (Required) - Personal Access Token
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. GH_PAT  —  GitHub Personal Access Token (CLASSIC)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Cara buat:"
echo "  1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)"
echo "  2. Generate new token (classic)"
echo "  3. Scopes yang WAJIB dicentang:"
echo "     ☑ repo                    (Full control of private repositories)"
echo "     ☑ workflow                (Update GitHub Action workflows)"
echo "     ☑ write:packages          (Upload release assets)"
echo "     ☑ delete:packages         (Manage release assets)"
echo "  4. Expiration: No expiration (atau custom >1 tahun)"
echo "  5. Copy token (ghp_xxxxxxxxxxxx) → Paste ke GH_PAT secret"
echo ""
echo "Note: GH_PAT dipakai untuk:"
echo "  - Push tag & commit (sync-upstream.yml)"
echo "  - Create/edit GitHub Release (release.yml) — supaya publisher = nemoobc, bukan github-actions[bot]"
echo "  - Upload release assets"
echo ""

# ============================================================
# NPM_TOKEN (Required) - npm Automation Token
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. NPM_TOKEN  —  npm Automation Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Cara buat:"
echo "  1. Login npmjs.com → Access Tokens → Generate New Token"
echo "  2. Type: Automation (bukan Publish)"
echo "  3. Scope: @nemoobc (atau public packages)"
echo "  4. Copy token (npm_xxxxxxxxxxxx) → Paste ke NPM_TOKEN secret"
echo ""
echo "Note: Dipakai untuk auto-publish ke npm saat release.yml jalan"
echo ""

# ============================================================
# Verification
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Verifikasi Setelah Set"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Di GitHub Secrets page, pastikan ada 2 secrets:"
echo "  GH_PAT    = ghp_xxxxxxxxxxxxxxxxxxxx"
echo "  NPM_TOKEN = npm_xxxxxxxxxxxxxxxxxxxx"
echo ""
echo "Test manual:"
echo "  # Test GH_PAT (butuh gh CLI login dulu)"
echo "  gh auth login --with-token < ~/.gh_pat_token_file"
echo "  gh release list -R nemoobc/opencode-termux"
echo ""
echo "  # Test NPM_TOKEN"
echo "  echo \"//registry.npmjs.org/:_authToken=\$NPM_TOKEN\" > ~/.npmrc"
echo "  npm whoami"
echo ""

# ============================================================
# Workflow yang pakai secrets
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Workflow & Secret Mapping"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "| Workflow              | GH_PAT | NPM_TOKEN |"
echo "|-----------------------|--------|-----------|"
echo "| sync-upstream.yml     |   ✅   |           |"
echo "| release.yml           |   ✅   |     ✅    |"
echo "| test.yml              |        |           |"
echo "| bersihkan.yml         |   ✅   |           |"
echo ""

# ============================================================
# Manual Set via gh CLI (optional)
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Quick Set via gh CLI (kalau sudah login)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "# Set GH_PAT"
echo "gh secret set GH_PAT --body \"ghp_xxxxxxxxxxxx\" --repo nemoobc/opencode-termux"
echo ""
echo "# Set NPM_TOKEN"
echo "gh secret set NPM_TOKEN --body \"npm_xxxxxxxxxxxx\" --repo nemoobc/opencode-termux"
echo ""
echo "# List secrets"
echo "gh secret list --repo nemoobc/opencode-termux"
echo ""

echo "============================================="
echo "  Selesai! Pastikan keduanya sudah di-set."
echo "============================================="