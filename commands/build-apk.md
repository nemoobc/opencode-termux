---
description: Build APK Android lengkap (payload + align + sign)
agent: apk-builder
---

Build APK project sekarang. Ikuti seluruh resep di agent apk-builder:
1. Cek & siapkan lingkungan (pkg + unduhan dl/)
2. Rakit payload rootfs.bin (ingat: binary TIDAK masuk rootfs)
3. Jalankan ./build.sh
4. Verifikasi: resources.arsc Stored + unzip -t lulus + ukuran ~67MB
5. Laporkan lokasi APK + ukuran + hasil verifikasi

$ARGUMENTS
