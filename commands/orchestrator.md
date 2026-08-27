---
description: Jalankan orchestrator full lifecycle: audit → test → monitor → fix → compact
agent: orchestrator
---

Jalankan siklus penuh otomatis:
1. Audit project (struktur, deps, security, style, arch)
2. Test semua bahasa (unit, integration, coverage)
3. Monitor daemon (file watch, CI, perf baseline)
4. Fix semua failure (auto-loop max 5x per bug)
5. Compact & optimasi (dead code, format, deps, bundle)

Args: $ARGUMENTS (optional: full|audit|test|monitor|fix|compact|status|resume)

Default: full