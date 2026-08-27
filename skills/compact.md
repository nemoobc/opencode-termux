---
description: Code compact & optimize — dead code, format, lint-fix, deps, bundle, tree-shake
mode: subagent
model: opencode-zen/kimi-k2-5
tools:
  bash: true
  read: true
  edit: true
  write: true
  grep: true
  glob: true
---

# COMPACT SKILL — Cleanup & Optimize

Input: project root, language list, aggressive mode (bool)
Output: `compact-report-<timestamp>.md` + `compact-summary.json` + stats

## PHASES (JALANKAN BERURUTAN)

### 1. FORMAT (Auto-fix style)
```bash
# Per bahasa, jalankan formatter + lint --fix
# Node: npx prettier --write . && npx eslint . --fix
# Python: ruff check --fix . && black .
# Go: gofmt -w . && golangci-lint run --fix
# Rust: cargo fmt --all && cargo clippy --fix --allow-dirty --allow-staged
# Java: ./gradlew spotlessApply (kalau config) / google-java-format
# C/C++: clang-format -i **/*.cpp **/*.h **/*.c **/*.hpp
# Shell: shfmt -w **/*.sh && shellcheck -f diff **/*.sh | patch -p1
# Universal: editorconfig-checker . (fix indent, newline, charset)
```

### 2. DEAD CODE REMOVAL
```bash
# Node/TS: npx ts-prune (unused exports) → review manual → hapus
#         npx depcheck (unused deps) → uninstall
#         knip (unused files, deps, exports) → knip --fix
# Python: vulture (dead code) → review → hapus
#         pip-autoremove / pipdeptree (unused deps)
# Go: go-deadcode (unused func/var) → review
#     go mod tidy (unused deps)
# Rust: cargo machete (unused deps) → cargo remove
#       cargo unused (unused items) — manual review
# Java: jdeprscan (deprecated API) / proguard (shrink)
# C/C++: cppcheck --enable=unusedFunction --xml → parse → review
# Shell: shellcheck --enable=SC2034 (unused var) → manual
```

### 3. DEPENDENCY OPTIMIZATION
```bash
# Update patch/minor (major manual)
# Node: npx npm-check-updates -u --target minor && npm install
# Python: pip-upgrade --dry-run → apply minor/patch
# Go: go get -u=patch ./... && go mod tidy
# Rust: cargo upgrade --incompatible (review) / cargo update
# Java: ./gradlew dependencyUpdates / mvn versions:display-dependency-updates
# C/C++: conan outdated / vcpkg upgrade (manual)

# Audit lockfile sync
# Node: npm ls --prod --depth=0 vs package-lock.json
# Python: pip freeze vs requirements.txt
```

### 4. BUNDLE / BUILD OPTIMIZATION
```bash
# Node: Analisis bundle
#   npx webpack-bundle-analyzer dist/stats.json (kalau webpack)
#   npx vite-bundle-analyzer (kalau vite)
#   npx esbuild --bundle --analyze (kalau esbuild)
#   Tree-shake: cek sideEffects di package.json, unused exports

# Python: pyinstaller --clean --onefile (kalau binary)
#         pip-compile --upgrade (requirements.txt minimal)

# Go: go build -ldflags="-s -w" (strip debug)
#     upx binary (kompres)

# Rust: cargo build --release (strip otomatis)
#       cargo bloat --release --crates (top size)

# Java: ./gradlew shadowJar (fat jar) / proguard

# C/C++: strip binary, upx, LTO (-flto)
```

### 5. PERFORMANCE MICRO-OPTIMIZATIONS
```bash
# Deteksi pola umum (grep + review manual):
# - N+1 query (loop di dalam loop DB call)
# - Sync I/O di hot path (bisa async?)
# - Alloc di loop (pre-allocate / reuse buffer)
# - String concat di loop (StringBuilder / join)
# - Regex compile di loop (pre-compile)
# - JSON parse/stringify berulang (cache)
# - Unnecessary clone/copy (ref/borrow)
# - Missing index (DB query plan)

# Auto-fix yang aman:
# - Import order (sort)
# - Unused variable → hapus
# - Const assertion (as const / readonly / final)
# - Inline const (const x = 1; → 1 langsung kalau sekali pakai)
```

### 6. CODE STRUCTURE (OPSIONAL, AGGRESSIVE MODE)
```bash
# Hanya kalau aggressive=true + test coverage >90%
# - Extract duplicate logic → shared util
# - Large file (>500 lines) → split module
# - God class → split responsibility
# - Circular dependency → invert/extract interface
# - Magic number → named constant
# - Long parameter list (>4) → config object
```

## OUTPUT

### compact-report-<timestamp>.md
```markdown
# Compact Report — <project> — <timestamp>

## Ringkasan
- Files changed: 47 | Lines removed: 1,234 | Lines added: 89
- Bundle size: 2.4MB → 1.8MB (**-25%**)
- Build time: 18.5s → 14.2s (**-23%**)
- Test time: 42.1s → 38.7s (**-8%**)
- Deps updated: 12 patch, 3 minor

## Per Phase

### 1. Format & Lint-Fix
- TypeScript: Prettier (23 files), ESLint --fix (12 fixes: unused vars, import order)
- Python: Ruff --fix (45 fixes: trailing comma, import sort), Black (8 files)
- Go: gofmt (0), golangci-lint --fix (3: error return, context)
- Rust: cargo fmt (0), clippy --fix (2: redundant clone)

### 2. Dead Code Removal
- TypeScript: ts-prune → 4 unused exports dihapus (utils/date.ts, types/api.ts)
- TypeScript: knip → 2 unused deps (date-fns, lodash-es) → uninstall
- Python: vulture → 3 dead functions (old migration script) → dihapus
- Go: go-deadcode → 1 unused helper (internal/util.go) → dihapus
- Rust: cargo machete → 1 unused dep (serde_json) → cargo remove

### 3. Dependency Updates
| Package | Before | After | Type |
|---------|--------|-------|------|
| typescript | 5.3.3 | 5.4.5 | minor |
| vitest | 1.4.0 | 1.6.0 | minor |
| @types/node | 20.11.0 | 20.12.0 | patch |
| requests | 2.31.0 | 2.32.3 | patch |
| pytest | 7.4.2 | 7.4.4 | patch |
| gin | 1.9.1 | 1.9.2 | patch |

### 4. Bundle Optimization
- Vite: manual chunks (vendor, ui, charts) → -15% initial load
- Tree-shake: removed 3 unused icon packs (lucide-react, heroicons)
- Compression: gzip + brotli enabled → -60% transfer

### 5. Perf Micro-Optimizations
- `src/api.ts`: N+1 query di `getUsersWithPosts()` → batched query (+1 index)
- `src/utils/parse.ts`: regex compile di loop → pre-compiled (3x faster)
- `db/pool.py`: connection leak fix (dari fix skill) → pool stable

### 6. Structure (Aggressive)
- `src/services/auth.ts` (623 lines) → split ke `auth/token.ts`, `auth/session.ts`, `auth/mfa.ts`
- Circular dep `core/` ↔ `utils/` → extract `core/interfaces.ts`

## Before/After Stats
| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Total LOC | 89,432 | 88,287 | -1.3% |
| Bundle (gz) | 2.4 MB | 1.8 MB | -25% |
| Deps (prod) | 147 | 142 | -5 |
| Deps (dev) | 89 | 86 | -3 |
| Build time | 18.5s | 14.2s | -23% |
| Test time | 42.1s | 38.7s | -8% |
| Lint errors | 8 | 0 | -8 |
| Test coverage | 86.2% | 86.5% | +0.3% |
```

### compact-summary.json
```json
{
  "timestamp": "2026-08-27T11:45:00Z",
  "projectRoot": "/path",
  "aggressive": false,
  "phases": {
    "format": {"filesChanged": 31, "fixes": 62},
    "deadCode": {"exportsRemoved": 4, "depsRemoved": 3, "functionsRemoved": 4},
    "deps": {"updated": 15, "major": 0, "minor": 3, "patch": 12},
    "bundle": {"sizeBefore": 2400000, "sizeAfter": 1800000, "reductionPct": 25},
    "perf": {"optimizations": 3, "estimatedSpeedup": "15-20%"},
    "structure": {"filesSplit": 1, "circularDepsFixed": 1}
  },
  "stats": {
    "linesRemoved": 1234,
    "linesAdded": 89,
    "filesChanged": 47,
    "buildTimeDeltaPct": -23,
    "testTimeDeltaPct": -8,
    "bundleSizeDeltaPct": -25
  },
  "verification": {
    "testsPass": 1247,
    "testsFail": 0,
    "lintErrors": 0,
    "typecheckErrors": 0
  }
}
```

## CATATAN
- **Safety first**: setiap phase jalan test suite setelah selesai (quick test: unit only)
- **Backup**: `.compact-backup/` sebelum phase destruktif (dead code, deps)
- **Aggressive mode**: butuh approval manual (default false)
- **Rollback**: kalau test gagal pasca-compact, auto-restore backup + report
- **CI integration**: compact report sebagai artifact, block merge kalau bundle size naik >5%
- **Frequency**: jalan tiap minggu (schedule) atau pre-release