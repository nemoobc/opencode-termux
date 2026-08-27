---
description: Continuous monitor — file watch, CI status, perf baseline, alerting
mode: subagent
model: opencode-zen/kimi-k2-5
tools:
  bash: true
  read: true
  glob: true
  task: true
---

# MONITOR SKILL — Continuous Watch + CI + Perf

Input: project root, mode (daemon/once), config
Output: `monitor-<timestamp>.log` + `monitor-dashboard.md` + alerts

## MODE OPERASI

### 1. DAEMON MODE (background, terus jalan)
```bash
# Start: coder monitor start
# Stop:  coder monitor stop
# Status: coder monitor status
```

### 2. ONCE MODE (single sweep, untuk CI)
```bash
# coder monitor once
```

## KOMPONEN MONITOR

### A. File Watch (Incremental Test/Lint)
```bash
# Tool: watchexec / entr / inotifywait / fswatch (pilih yang ada)
# Pattern per bahasa:
#   TS/JS: **/*.ts **/*.tsx **/*.js **/*.json
#   Python: **/*.py **/*.toml
#   Go: **/*.go **/go.mod **/go.sum
#   Rust: **/*.rs **/Cargo.toml **/Cargo.lock
#   Java: **/*.java **/*.kt **/*.gradle*
#   C/C++: **/*.cpp **/*.hpp **/*.c **/*.h **/CMakeLists.txt
#   Shell: **/*.sh **/*.bash

# Action on change:
#   - Debounce 500ms
#   - Kalau test file: jalankan test spesifik file itu
#   - Kalau source file: jalankan lint + test terkait (affected)
#   - Kalau config: jalankan full lint + audit deps
```

### B. CI Status (GitHub Actions / GitLab CI)
```bash
# Polling setiap 30s (daemon) / sekali (once)
# gh run list --limit=5 --json=conclusion,headBranch,createdAt,url
# Cek: workflow yg gagal, branch protection status
# Alert: kalau main branch merah > 5 menit
```

### C. Performance Baseline
```bash
# Benchmark tool: hyperfine / wrk / vegeta / custom script
# Simpan baseline ke .perf-baseline.json
# Bandingkan: kalau regresi >10% → alert
# Contoh:
#   hyperfine --warmup=3 --runs=10 'npm run build'
#   hyperfine --warmup=3 --runs=10 'pytest tests/perf/'
#   wrk -t4 -c100 -d30s http://localhost:3000/api/health
```

### D. Log Tail & Error Pattern
```bash
# Tail file log (app.log, error.log, nginx.access, dll)
# Pattern: ERROR, FATAL, PANIC, Exception, traceback, segmentation fault
# Alert realtime kalau spike error rate > threshold
```

## KONFIGURASI (`.monitor.config.json`)
```json
{
  "watch": {
    "enabled": true,
    "patterns": ["**/*.ts", "**/*.py", "**/*.go"],
    "ignore": ["node_modules", "dist", "build", ".git", "vendor", "target"],
    "debounceMs": 500,
    "onChange": "test-affected"
  },
  "ci": {
    "enabled": true,
    "provider": "github",
    "repo": "owner/repo",
    "branches": ["main", "develop"],
    "pollIntervalSec": 30,
    "alertOnRedMinutes": 5
  },
  "perf": {
    "enabled": true,
    "baselineFile": ".perf-baseline.json",
    "thresholdPct": 10,
    "benchmarks": [
      {"name": "build", "cmd": "npm run build"},
      {"name": "test", "cmd": "npm test"},
      {"name": "api", "cmd": "wrk -t4 -c100 -d10s http://localhost:3000/health"}
    ]
  },
  "logs": {
    "enabled": true,
    "files": ["logs/app.log", "logs/error.log"],
    "patterns": ["ERROR", "FATAL", "PANIC", "Exception"],
    "rateThresholdPerMin": 10
  },
  "alerts": {
    "webhook": "https://hooks.slack.com/.../xxx",
    "notifyOn": ["test-fail", "ci-red", "perf-regress", "error-spike"]
  }
}
```

## OUTPUT

### monitor-dashboard.md (update realtime)
```markdown
# Monitor Dashboard — <project> — <timestamp>

## Status: 🟢 HEALTHY / 🟡 DEGRADED / 🔴 CRITICAL

## File Watch
- Watching: 1,234 files (TS: 567, Py: 312, Go: 355)
- Last change: `src/api.ts` (2s ago) → lint ✅ test ✅
- Queue: 0 pending

## CI (GitHub Actions)
| Workflow | Branch | Status | Duration | Last Run |
|----------|--------|--------|----------|----------|
| test | main | ✅ | 3m 12s | 2 min ago |
| build | main | ✅ | 1m 45s | 2 min ago |
| release | main | ⏸️ | - | - |
| lint | develop | ❌ | 45s | 10 min ago | **ALERT**

## Performance (vs Baseline)
| Benchmark | Baseline | Current | Delta | Status |
|-----------|----------|---------|-------|--------|
| build | 12.3s | 12.1s | -1.6% | ✅ |
| test | 18.5s | 19.2s | +3.8% | ✅ |
| api-p99 | 45ms | 52ms | +15.6% | 🔴 **REGRESS** |

## Error Rate (last 5 min)
- `logs/app.log`: 2 ERROR, 0 FATAL
- `logs/error.log`: 0
- Rate: 0.4/min (threshold: 10/min) ✅

## Alerts Aktif
1. 🔴 **Perf Regress**: api-p99 +15.6% (threshold 10%)
2. 🟡 **CI Red**: lint workflow on develop (10 min)
```

### monitor-<timestamp>.log (append only)
```
[2026-08-27T10:50:00Z] START daemon mode
[2026-08-27T10:50:01Z] WATCH: watchexec started (PID 12345)
[2026-08-27T10:50:02Z] CI: polling github.com/owner/repo
[2026-08-27T10:50:03Z] PERF: baseline loaded from .perf-baseline.json
[2026-08-27T10:50:04Z] LOGS: tailing logs/app.log, logs/error.log
[2026-08-27T10:52:15Z] CHANGE: src/api.ts modified
[2026-08-27T10:52:16Z] LINT: eslint src/api.ts ✅ (0 errors)
[2026-08-27T10:52:18Z] TEST: vitest run src/api.test.ts ✅ (3 passed)
[2026-08-27T10:55:00Z] CI: workflow "lint" on develop FAILED
[2026-08-27T10:55:00Z] ALERT: ci-red → webhook sent
[2026-08-27T11:00:00Z] PERF: benchmark "api" current=52ms baseline=45ms delta=+15.6%
[2026-08-27T11:00:00Z] ALERT: perf-regress → webhook sent
```

## CATATAN
- Daemon mode: simpan PID ke `.monitor.pid`, trap SIGTERM untuk cleanup
- Gunakan `watchexec` kalau ada (cross-platform), fallback `inotifywait`/`fswatch`
- CI polling: pakai `gh` CLI (perlu auth), atau GitLab API
- Perf baseline: generate saat pertama kali, update manual via `coder monitor baseline`
- Alert webhook: optional, support Slack/Discord/Generic POST
- Resource limit: max 50MB RAM, 5% CPU idle