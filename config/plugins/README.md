# Plugin `strip-parameter`

Plugin opencode global untuk **mensupresi raw XML tool-call tags literal** (mis.
`<parameter>`, `</function_calls>`, `<tool_call>`, `<antml:...>`) dari output teks
model **sebelum dirender TUI**, agar tag mentah tidak bocor ke layar.

## Mengapa

opencode kadang menampilkan tag tool-call XML mentah sebagai teks (issue upstream
`anomalyco/opencode#24316`, fix upstream PR #27984/#30633 belum masuk release).
Plugin ini adalah mitigasi lokal versi 1.18.23.

## Cara pakai

```bash
# 1. Salin ke folder plugin global opencode
mkdir -p ~/.config/opencode/plugins
cp config/plugins/strip-parameter.js ~/.config/opencode/plugins/

# 2. Pastikan config package.json bertipe ESM (opsional, menghilangkan warning)
#    di ~/.config/opencode/package.json tambahkan: "type": "module"

# 3. Restart opencode (plugin dimuat saat start). Efek aktif di sesi baru.
```

## Verifikasi

Jalankan log opencode; harus muncul:

```
Plugin initialized — mensupresi raw XML tool-call tags dari output teks
```

## Catatan

- Plugin memuat semua blok/penutup tool-call XML yang "nyasar" sebagai teks.
- Hanya menyentuh output **teks** (hook `experimental.text.complete`),
  tidak mengubah eksekusi tool.
- Hook ini eksperimental; jika berubah di versi opencode mendatang, sesuaikan.
