#!/usr/bin/env node
const { spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const vendor = path.join(__dirname, "..", "vendor")
const loader = path.join(vendor, "ld-musl.so")
const bin = path.join(vendor, "opencode")

function ready() {
  return fs.existsSync(loader) && fs.existsSync(bin)
}

// Auto-heal: kalau postinstall terlewat (mis. --ignore-scripts), pasang sekarang.
if (!ready()) {
  console.log("[opencode-termux] vendor belum ada — menjalankan installer…")
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "install.mjs")], {
    stdio: "inherit",
    env: process.env,
  })
  if (r.status !== 0 || !ready()) {
    console.error("[opencode-termux] instalasi bundle gagal. Coba manual:")
    console.error("  npm rebuild @nemoobc/opencode-termux")
    process.exit(1)
  }
}

if (!ready()) process.exit(1)

// DNS fix: musl hasil build kita membaca config dari prefix Termux —
// pastikan filenya ada (bisa ditulis tanpa root).
try {
  const PREFIX = process.env.TERMUX_PREFIX || "/data/data/com.termux/files/usr"
  const etc = path.join(PREFIX, "etc")
  fs.mkdirSync(etc, { recursive: true })
  const rc = path.join(etc, "resolv.conf")
  if (!fs.existsSync(rc)) fs.writeFileSync(rc, "nameserver 1.1.1.1\nnameserver 8.8.8.8\n")
  const hh = path.join(etc, "hosts")
  if (!fs.existsSync(hh)) fs.writeFileSync(hh, "127.0.0.1 localhost\n")
} catch {}

// LD_PRELOAD bawaan Termux (libtermux-exec) dibuat untuk Bionic dan akan
// gagal relokasi jika ikut dimuat ke proses musl — jadi selalu dibersihkan.
const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
const r = spawnSync(loader, [bin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...cleanEnv, LD_LIBRARY_PATH: vendor },
})
process.exit(r.status ?? 1)
