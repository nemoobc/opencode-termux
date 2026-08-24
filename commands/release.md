---
description: Rilis versi baru - bump, tag, release GitHub, bersihkan lama
agent: apk-builder
---

Rilis versi baru dengan aturan ketat:
1. Bump versionCode (+1) dan versionName di AndroidManifest.xml
2. Build APK, verifikasi penuh (arsc Stored, unzip -t, ukuran)
3. Update baris riwayat versi di README.md (SELALU satu baris saja)
4. git commit + tag vX.Y.Z + push
5. gh release create vX.Y.Z build/APK — judul HANYA nama versi
6. Hapus release lama (sisakan satu)
7. Bersihkan dl/ staging/ build/ artefak

Catatan rilis: ringkas, poin per perubahan, versionCode disebut.
$ARGUMENTS
