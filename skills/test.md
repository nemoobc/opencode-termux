---
description: Multi-language test runner — unit, integration, e2e, contract, coverage
mode: subagent
model: opencode-zen/kimi-k2-5
tools:
  bash: true
  read: true
  glob: true
  grep: true
---

# TEST SKILL — Run All Tests

Input: project root, language list (dari audit), filter opsional
Output: `test-report-<timestamp>.md` + `test-summary.json`

## LANGKAH (PER BAHASA, PARALLEL)

### Node.js / TypeScript
```bash
# Deteksi test runner
if [ -f package.json ]; then
  RUNNER=$(jq -r '.scripts.test // "vitest --run"' package.json)
  # Jalankan
  npm test 2>&1 | tee test-node.log
  # Coverage
  npx vitest run --coverage 2>&1 | tee coverage-node.log
  # Kalau jest: npx jest --coverage --json
  # Kalau playwright: npx playwright test --reporter=json
fi
```

### Python
```bash
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  # Deteksi: pytest, unittest
  pytest -v --tb=short --json-report --json-report-file=test-python.json 2>&1 | tee test-python.log
  # Coverage
  pytest --cov=. --cov-report=json:coverage-python.json --cov-report=term 2>&1 | tee coverage-python.log
fi
```

### Go
```bash
if [ -f go.mod ]; then
  go test ./... -v -json -coverprofile=coverage-go.out 2>&1 | tee test-go.log
  go tool cover -func=coverage-go.out | tail -1
  # Race detector
  go test ./... -race -short 2>&1 | tee test-go-race.log
fi
```

### Rust
```bash
if [ -f Cargo.toml ]; then
  cargo test --all --message-format=json 2>&1 | tee test-rust.log
  # Coverage (tarpaulin / llvm-cov)
  cargo llvm-cov --all --json 2>&1 | tee coverage-rust.json
fi
```

### Java (Gradle/Maven)
```bash
if [ -f build.gradle.kts ] || [ -f pom.xml ]; then
  ./gradlew test --info 2>&1 | tee test-java.log  # Gradle
  # mvn test 2>&1 | tee test-java.log             # Maven
  # Coverage: ./gradlew jacocoTestReport / mvn jacoco:report
fi
```

### C/C++ (CMake)
```bash
if [ -f CMakeLists.txt ]; then
  cmake --build build --target test 2>&1 | tee test-cpp.log
  # CTest
  ctest --output-on-failure -j$(nproc) 2>&1 | tee test-ctest.log
  # Coverage: lcov/gcov
fi
```

### Shell
```bash
if ls *.sh >/dev/null 2>&1; then
  # Bats / shunit2 / manual
  bats test/ 2>&1 | tee test-shell.log  # Kalau ada test/*.bats
fi
```

### Contract / API Test
```bash
# Deteksi: pact, schemathesis, dredd, postman/newman
# Kalau ada OpenAPI spec: schemathesis run --checks=all spec.yaml http://localhost:8080
```

## AGREGASI HASIL

### test-summary.json
```json
{
  "timestamp": "2026-08-27T10:45:00Z",
  "projectRoot": "/path",
  "languages": ["typescript", "python", "go"],
  "total": {"passed": 1247, "failed": 3, "skipped": 12, "duration": "45.2s"},
  "byLanguage": {
    "typescript": {"passed": 523, "failed": 2, "skipped": 5, "duration": "18.3s", "coverage": "87.4%"},
    "python": {"passed": 312, "failed": 1, "skipped": 3, "duration": "12.1s", "coverage": "82.1%"},
    "go": {"passed": 412, "failed": 0, "skipped": 4, "duration": "14.8s", "coverage": "91.7%"}
  },
  "failures": [
    {"language": "typescript", "file": "src/auth.test.ts", "test": "should handle expired token", "error": "Expected 401 got 200"},
    {"language": "typescript", "file": "src/api.test.ts", "test": "rate limit", "error": "Timeout after 5000ms"},
    {"language": "python", "file": "tests/test_db.py", "test": "test_connection_pool", "error": "OperationalError: too many connections"}
  ],
  "coverage": {"lines": "86.2%", "branches": "78.5%", "functions": "89.1%"},
  "thresholds": {"lines": 80, "branches": 70, "functions": 80},
  "thresholdMet": true
}
```

### test-report-<timestamp>.md
```markdown
# Test Report — <project> — <timestamp>

## Ringkasan
✅ **1247 passed** | ❌ **3 failed** | ⏭️ **12 skipped** | ⏱️ **45.2s**
Coverage: **86.2%** lines | **78.5%** branches | **89.1%** functions

## Per Bahasa
| Bahasa | Pass | Fail | Skip | Duration | Coverage |
|--------|------|------|------|----------|----------|
| TypeScript | 523 | 2 | 5 | 18.3s | 87.4% |
| Python | 312 | 1 | 3 | 12.1s | 82.1% |
| Go | 412 | 0 | 4 | 14.8s | 91.7% |

## Kegagalan (Perlu Fix)
1. **TypeScript** — `src/auth.test.ts:42` — `should handle expired token`
   - Expected 401 got 200 — middleware tidak cek expiry
2. **TypeScript** — `src/api.test.ts:18` — `rate limit`
   - Timeout 5s — test flaky, butuh mock time
3. **Python** — `tests/test_db.py:67` — `test_connection_pool`
   - OperationalError: too many connections — leak pool

## Coverage Detail (TypeScript)
```
File                    | % Stmts | % Branch | % Funcs | % Lines
------------------------|---------|----------|---------|--------
src/                    |   87.4  |   79.2   |   89.1  |   87.4
src/auth.ts             |   65.2  |   50.0   |   70.0  |   65.2  ← butuh test
src/api.ts              |   91.3  |   85.7   |   92.0  |   91.3
src/utils/              |   94.1  |   88.9   |   95.0  |   94.1
```

## Rekomendasi
- Fix 3 failure di atas (prioritas: auth middleware, rate limit mock, db pool cleanup)
- Tambah test untuk `src/auth.ts` (coverage 65%)
- Target coverage sudah tercapai (>80% lines)
```

## CATATAN
- Jalankan test **paralel per bahasa** (background job + wait)
- Timeout default: 120s per bahasa, override via env `TEST_TIMEOUT`
- Kalau test gagal: **jangan stop** — kumpulkan semua failure, lanjut bahasa lain
- Coverage threshold: baca dari config (jest.config, pyproject.toml, .coveragerc, etc)
- Output JSON wajib untuk parsing otomatis
- Simpan raw log ke `.test-raw/` per bahasa