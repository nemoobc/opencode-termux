# Prebuilt musl Loader Rebuild Guide

File `ld-musl-aarch64-termux.so` adalah custom musl loader yang dipatch agar:
- Membaca `/etc/resolv.conf` dan `/etc/hosts` dari `$PREFIX/etc/` (Termux prefix)
- Bukan dari `/etc/` (butuh root)

## Cara Rebuild

### Prasyarat
- Linux host (bisa WSL, VM, atau CI)
- Docker terinstall
- `aarch64-linux-musl` toolchain

### Langkah Build

```bash
# 1. Clone musl repo (versi yang kompatibel dengan Alpine 3.21)
git clone https://git.musl-libc.org/git/musl
cd musl
git checkout v1.2.5  # atau tag yang dipakai Alpine 3.21

# 2. Patch src/internal/dynlink.c untuk ganti path resolv.conf & hosts
# Cari baris yang define RESOLV_CONF dan HOSTS_PATH, ganti ke:
# #define RESOLV_CONF "/data/data/com.termux/files/usr/etc/resolv.conf"
# #define HOSTS_PATH  "/data/data/com.termux/files/usr/etc/hosts"

# 3. Build dengan cross-compiler aarch64
./configure --prefix=/out --target=aarch64-linux-musl --disable-shared
make -j$(nproc)
make install

# 4. Ambil ld-musl-aarch64.so.1 dari /out/lib/
# Rename ke ld-musl-aarch64-termux.so
cp /out/lib/ld-musl-aarch64.so.1 ../prebuilt/ld-musl-aarch64-termux.so
chmod +x ../prebuilt/ld-musl-aarch64-termux.so
```

### Alternatif: Build via Docker (lebih bersih)

```dockerfile
# Dockerfile.build-musl
FROM alpine:3.21 AS builder
RUN apk add --no-cache build-base linux-headers git
WORKDIR /musl
RUN git clone https://git.musl-libc.org/git/musl . && git checkout v1.2.5
# Apply patch di sini (sed atau patch file)
RUN sed -i 's|/etc/resolv.conf|/data/data/com.termux/files/usr/etc/resolv.conf|g' src/internal/dynlink.c
RUN sed -i 's|/etc/hosts|/data/data/com.termux/files/usr/etc/hosts|g' src/internal/dynlink.c
RUN ./configure --prefix=/out --target=aarch64-linux-musl --disable-shared && make -j$(nproc) && make install

FROM scratch
COPY --from=builder /out/lib/ld-musl-aarch64.so.1 /ld-musl-aarch64-termux.so
```

```bash
docker build -f Dockerfile.build-musl -t musl-builder .
docker create --name temp musl-builder
docker cp temp:/ld-musl-aarch64-termux.so ./prebuilt/ld-musl-aarch64-termux.so
docker rm temp
```

### Verifikasi

```bash
# Cek ELF
file prebuilt/ld-musl-aarch64-termux.so
# Output: ELF 64-bit LSB shared object, ARM aarch64, version 1 (SYSV), dynamically linked

# Cek string patch
strings prebuilt/ld-musl-aarch64-termux.so | grep -E 'resolv.conf|hosts'
# Harus muncul path Termux prefix
```

### Catatan
- Loader ini **hanya untuk ARM64 (aarch64)**. Untuk x64, install.mjs otomatis ambil dari Alpine minirootfs.
- Jika Alpine naik versi major (mis. 3.22), mungkin perlu rebuild ulang loader agar kompatibel.
- Simpan binary hasil build ke `prebuilt/ld-musl-aarch64-termux.so` dan commit.