---
description: Master coder — multi-language full lifecycle (audit, test, monitor, fix, compact)
agent: coder
---

CODER — Developer otonom universal multi-bahasa.

Perintah:
- coder full          # Audit → Test → Monitor → Fix → Compact (default)
- coder audit         # Scan project lengkap
- coder test          # Jalankan semua test
- coder monitor       # Start monitor daemon (watch + CI + perf)
- coder fix           # Auto-fix failure (loop max 5x)
- coder compact       # Optimasi: dead code, format, deps, bundle
- coder status        # Lihat state & progress

Args: $ARGUMENTS (opsional: bahasa spesifik, path, filter)

Contoh:
  coder full
  coder audit
  coder test --language=typescript
  coder fix --id=fix-001
  coder compact --aggressive