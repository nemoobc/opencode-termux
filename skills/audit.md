---
description: Multi-language project audit — structure, deps, security, style, arch
mode: subagent
model: opencode-zen/kimi-k2-5
tools:
  bash: true
  read: true
  glob: true
  grep: true
---

# AUDIT SKILL — Full Project Scan

Input: project root path
Output: `audit-report-<timestamp>.md` + `audit-summary.json`

## LANGKAH (JALANKAN SEMUA)

### 1. Deteksi Bahasa & Project Type
```bash
# Scan file indikator
ls -la
# Kumpulkan: package.json, tsconfig.json, pyproject.toml, requirements.txt, go.mod, Cargo.toml, pom.xml, build.gradle, CMakeLists.txt, Makefile, *.csproj, composer.json, mix.exs
# Output: languages[] = ["typescript", "python", "go", ...]
```

### 2. Struktur & Konfigurasi
```bash
# Per bahasa cek:
# Node: package.json valid, scripts (test, build, lint, typecheck), engines, deps vs devDeps
# Python: pyproject.toml / setup.cfg / requirements.txt, pytest.ini, ruff.toml, mypy.ini
# Go: go.mod tidy, go.work, Makefile/justfile
# Rust: Cargo.toml workspace, rust-toolchain.toml, clippy config
# Java: pom.xml / build.gradle.kts, wrapper, checkstyle/spotbugs config
# C/C++: CMakeLists.txt, compile_commands.json, .clang-format, .clang-tidy
# Shell: .shellcheckrc, .editorconfig
# Universal: .gitignore, .editorconfig, LICENSE, README.md, CONTRIBUTING.md
```

### 3. Dependensi & Security
```bash
# Node: npm audit --json, npm outdated --json, pnpm audit
# Python: pip-audit -r requirements.txt --format=json, pip list --outdated --format=json
# Go: govulncheck ./..., go list -u -m -json all
# Rust: cargo audit --json, cargo outdated --format=json
# Java: mvn org.owasp:dependency-check:check (atau gradle equivalent)
# C/C++: cppcheck --enable=all --xml (jika compile_commands.json ada)
# Universal: gitleaks detect --no-git --source=. (secrets), trivy fs . (container/vuln)
```

### 4. Code Quality & Style
```bash
# Node: npx eslint . --format=json (kalau config ada), npx prettier --check .
# Python: ruff check . --output-format=json, black --check --diff .
# Go: golangci-lint run --out-format=json, gofmt -l .
# Rust: cargo clippy --all-targets --all-features --message-format=json, cargo fmt --check
# Java: ./gradlew checkstyleMain spotbugsMain (kalau config)
# C/C++: clang-tidy -p build (kalau compile_commands.json), cppcheck --enable=style
# Shell: shellcheck -f json **/*.sh, shfmt -d **/*.sh
```

### 5. Arsitektur & Best Practice
```bash
# Deteksi: circular deps (madge, pydeps, go-mod-graph), dead code (ts-prune, vulture, go-deadcode)
# Cek: test coverage config, CI config (.github/workflows/, .gitlab-ci.yml)
# Cek: Dockerfile best practice (hadolint), k8s manifests (kubeval)
# Cek: lockfile sync (package-lock.json vs package.json, Cargo.lock, go.sum)
```

### 6. Git Hygiene
```bash
# git status --porcelain
# git log --oneline -20
# Cek: large files (>10MB), binary di history, commit message conventional
# Cek: branch protection, signed commits
```

## FORMAT OUTPUT

### audit-report-<timestamp>.md
```markdown
# Audit Report — <project> — <timestamp>

## Ringkasan
- Bahasa: TypeScript, Python, Go
- Total file: 1,234 | LOC: 89,432
- Issues: 🔴 3 Critical | 🟡 12 Warning | 🟢 45 Info

## Per Kategori
### Struktur & Config
- ✅ package.json valid, scripts lengkap
- ⚠️ tsconfig.json: strict: false (rekomendasi: true)
- ❌ Python: pyproject.toml missing, pakai requirements.txt lama

### Dependensi & Security
- 🔴 npm audit: 2 high (lodash, ws) — update available
- 🟡 pip-audit: 1 medium (requests) — upgrade to 2.32+
- ✅ govulncheck: clean
- 🔴 gitleaks: 1 secret di .env.example (harus dummy)

### Code Quality
- ✅ ESLint: 0 error, 8 warning (unused vars)
- 🟡 Ruff: 12 fixable (import order, trailing comma)
- ✅ golangci-lint: clean
- ⚠️ clippy: 3 pedantic warnings

### Arsitektur
- 🟡 Circular dep: utils/ ↔ core/ (TypeScript)
- 🟢 Dead code: 4 fungsi unused (ts-prune)

### Git
- ✅ .gitignore lengkap
- ⚠️ 3 file >10MB di history (LFS candidate)
```

### audit-summary.json
```json
{
  "timestamp": "2026-08-27T10:30:00Z",
  "projectRoot": "/path/to/project",
  "languages": ["typescript", "python", "go"],
  "stats": {"files": 1234, "loc": 89432},
  "issues": {
    "critical": 3,
    "warning": 12,
    "info": 45
  },
  "byCategory": {
    "structure": {"critical": 0, "warning": 2, "info": 1},
    "deps": {"critical": 2, "warning": 1, "info": 0},
    "security": {"critical": 1, "warning": 0, "info": 0},
    "quality": {"critical": 0, "warning": 6, "info": 20},
    "arch": {"critical": 0, "warning": 1, "info": 3},
    "git": {"critical": 0, "warning": 2, "info": 0}
  },
  "actionItems": [
    {"priority": "critical", "category": "deps", "action": "npm audit fix", "files": ["package.json"]},
    {"priority": "critical", "category": "security", "action": "Rotate secret in .env.example", "files": [".env.example"]}
  ]
}
```

## CATATAN
- Jalankan **semua** checker yang tersedia untuk bahasa terdeteksi
- Skip checker yang config-nya tidak ada (mis. tidak ada .eslintrc → skip ESLint)
- Timeout per checker: 60s
- Parallelkan checker independen (pakai `&` + `wait`)
- Simpan raw output JSON setiap checker ke `.audit-raw/` untuk debug