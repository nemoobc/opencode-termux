---
description: Auto-fix loop — analyze failures, minimal patch, verify, repeat (max 5x)
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

# FIX SKILL — Auto-Fix Loop

Input: failure list (dari test/audit/monitor), project root
Output: `fix-log-<timestamp>.md` + `fix-summary.json` + patches

## PROTOKOL KETAT (WAJIB IKUTI)

```
UNTUK SETIAP FAILURE:
1. BACA   → error message + stack trace + file terkait
2. PAHAMI → root cause dalam 1 kalimat (tulis ke log)
3. PATCH  → minimal change (satu file, satu logika, <20 baris)
4. UJI    → jalankan test spesifik failure tadi
5. ULANG  → kalau gagal, kembali ke langkah 1 (MAX 5 ITERASI)
6. CATAT  → diff + alasan + hasil

KALAU 5x GAGAL → STOP + DEEP ANALYSIS REPORT
```

## INPUT FORMAT (dari test-summary.json / audit-summary.json)
```json
{
  "failures": [
    {"id": "fix-001", "language": "typescript", "file": "src/auth.ts", "test": "src/auth.test.ts:42", "error": "Expected 401 got 200", "type": "test-fail"},
    {"id": "fix-002", "language": "python", "file": "db/pool.py", "test": "tests/test_db.py:67", "error": "OperationalError: too many connections", "type": "test-fail"},
    {"id": "fix-003", "language": "typescript", "file": "package.json", "test": "npm audit", "error": "2 high vulnerabilities", "type": "audit-deps"}
  ]
}
```

## ALGORITMA PER FAILURE

### Phase 1: Analisis (Read-only)
```bash
# 1. Baca file error + test file + file terkait (grep import/call)
# 2. Bangun konteks: fungsi, dependencies, tipe data
# 3. Identifikasi root cause candidates (prioritaskan yang paling mungkin)
# 4. Tulis ke log: "ROOT CAUSE: <1 kalimat>"
```

### Phase 2: Patch Generation
```bash
# Aturan patch:
# - SATU file per iterasi
# - Perubahan MINIMAL (hapus/tambah <20 baris)
# - Tidak sentuh file tidak berkaitan
# - Tidak hapus test
# - Prioritaskan: fix logic > fix test > update config
# - Gunakan edit tool, bukan rewrite file penuh
```

### Phase 3: Verifikasi
```bash
# Jalankan HANYA test yang gagal tadi:
# Node: npx vitest run src/auth.test.ts -t "should handle expired token"
# Python: pytest tests/test_db.py::test_connection_pool -xvs
# Go: go test -v -run TestConnectionPool ./db/
# Rust: cargo test test_connection_pool -- --nocapture
# Java: ./gradlew test --tests "com.example.DbTest.testConnectionPool"

# Kalau PASS → success, lanjut failure berikutnya
# Kalau FAIL → iterasi berikutnya (max 5)
```

### Phase 4: Regression Check (SETIAP KALAU BERHASIL)
```bash
# Setelah SEMUA failure diperbaiki (atau max iterasi):
# Jalankan FULL TEST SUITE (skill test)
# Kalau ada test baru gagal → tambah ke daftar fix
# Kalau semua hijau → DONE
```

## TIPE FAILURE & STRATEGI FIX

| Tipe | Contoh | Strategi |
|------|--------|----------|
| `test-fail` logic | Assertion error, wrong output | Baca test + source, fix logic di source |
| `test-fail` flaky | Timeout, race condition | Add retry/mock time/isolate state |
| `test-fail` setup | DB connection, missing fixture | Fix test setup/teardown, not source |
| `audit-deps` | Vulnerable dependency | `npm audit fix` / `pip install -U` / `go get` / `cargo update` |
| `audit-style` | Lint error | Auto-fix: `eslint --fix` / `ruff --fix` / `golangci-lint --fix` |
| `audit-security` | Secret detected | Rotate secret, update .gitignore, rewrite history (BFG) |
| `compile-error` | Type error, syntax error | Fix type / syntax di file error |
| `perf-regress` | Benchmark slower | Profile, optimize hot path (algoritma, caching, query) |

## OUTPUT

### fix-log-<timestamp>.md
```markdown
# Fix Log — <project> — <timestamp>

## Ringkasan
- Total failure: 3
- Fixed: 2 | Failed after 5 iter: 1 | Skipped: 0
- Regression check: ✅ All tests pass (1247/1247)

## Detail per Failure

### fix-001: TypeScript auth test
**File:** `src/auth.ts` | **Test:** `src/auth.test.ts:42`
**Error:** Expected 401 got 200

**Iterasi 1:**
- ROOT CAUSE: Middleware `verifyToken` tidak cek `exp` claim pada JWT
- PATCH: Tambah validasi expiry di `src/auth.ts:23`
- DIFF:
```diff
+ if (payload.exp && payload.exp * 1000 < Date.now()) {
+   throw new Error('Token expired')
+ }
```
- TEST: `vitest run src/auth.test.ts -t "should handle expired token"` → ✅ PASS

**Regression:** Full test suite ✅ (523/523)

---

### fix-002: Python DB pool leak
**File:** `db/pool.py` | **Test:** `tests/test_db.py:67`
**Error:** OperationalError: too many connections

**Iterasi 1:**
- ROOT CAUSE: `get_connection()` tidak return ke pool saat exception
- PATCH: Wrap dalam `try/finally` di `db/pool.py:45`
- DIFF:
```diff
  def get_connection(self):
      conn = self.pool.acquire()
-     return conn
+     try:
+         return conn
+     except Exception:
+         self.pool.release(conn)
+         raise
```
- TEST: `pytest tests/test_db.py::test_connection_pool` → ❌ FAIL (masih leak)

**Iterasi 2:**
- ROOT CAUSE: `release()` butuh argumen `conn`, tapi `conn` bisa None kalau acquire gagal
- PATCH: Guard `conn` not None di `finally`
- DIFF:
```diff
  def get_connection(self):
      conn = self.pool.acquire()
      try:
          return conn
      except Exception:
-         self.pool.release(conn)
+         if conn: self.pool.release(conn)
          raise
```
- TEST: ✅ PASS

**Regression:** Full test suite ✅ (312/312)

---

### fix-003: npm audit high vulnerabilities
**File:** `package.json` | **Source:** `npm audit`
**Error:** 2 high (lodash@4.17.20, ws@7.4.6)

**Iterasi 1:**
- ROOT CAUSE: Transitive deps outdated, butuh update major
- PATCH: `npm audit fix --force` (major update)
- TEST: `npm audit` → ❌ FAIL (breaking change di lodash v5)

**Iterasi 2:**
- ROOT CAUSE: Breaking change lodash v5, kode pakai `_.flattenDeep` yg dihapus
- PATCH: Pin lodash@4.17.21 (patch security) + ganti `_.flattenDeep` → `flat` (manual)
- DIFF: `package.json` + `src/utils/array.ts`
- TEST: `npm audit` → ✅ PASS (0 high)

**Regression:** Full test suite ✅ (523/523)
```

### fix-summary.json
```json
{
  "timestamp": "2026-08-27T11:15:00Z",
  "projectRoot": "/path",
  "inputFailures": 3,
  "results": {
    "fixed": 2,
    "failed": 1,
    "skipped": 0
  },
  "details": [
    {"id": "fix-001", "status": "fixed", "iterations": 1, "filesChanged": ["src/auth.ts"]},
    {"id": "fix-002", "status": "fixed", "iterations": 2, "filesChanged": ["db/pool.py"]},
    {"id": "fix-003", "status": "fixed", "iterations": 2, "filesChanged": ["package.json", "src/utils/array.ts"]}
  ],
  "regressionCheck": {"passed": 1247, "failed": 0, "duration": "42.1s"},
  "totalDuration": "180s"
}
```

## CATATAN
- **State persistence**: simpan progress ke `.fix-state.json` (bisa resume kalau crash)
- **Backup**: sebelum edit, copy file ke `.fix-backup/<id>/`
- **Atomic**: kalau iterasi gagal, restore backup, coba pendekatan lain
- **Parallel**: fix failure independen bisa paralel (bed file), tapi regression check serial
- **Human-in-loop**: kalau 3x gagal, opsi minta bantuan (tapi default auto)
- **Max total time**: 30 menit per failure, 2 jam total