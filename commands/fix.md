---
description: Loop otomatis perbaiki semua tes yang gagal sampai hijau
---

Jalankan siklus perbaikan:
1. Suruh agent tester menjalankan seluruh tes
2. Untuk setiap kegagalan, perbaiki sendiri dengan protokol fixer:
   pahami → fix minimal → uji ulang (maks 5 iterasi per bug)
3. Setelah semua hijau, jalankan ulang SEMUA tes sekali lagi (regression check)
4. Ringkas: daftar bug yang diperbaiki + perubahan file

Target: $ARGUMENTS
