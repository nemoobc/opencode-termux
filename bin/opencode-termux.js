#!/usr/bin/env node
import { spawnSync } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const vendor = path.join(root, "vendor")
const loader = path.join(vendor, "ld-musl.so")
const bin = path.join(vendor, "opencode")
const PKG = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const PREFIX = process.env.TERMUX_PREFIX || "/data/data/com.termux/files/usr"

function ready() {
  return fs.existsSync(loader) && fs.existsSync(bin)
}

// Auto-heal: kalau postinstall terlewat (mis. --ignore-scripts), pasang sekarang.
function heal() {
  if (ready()) return true
  console.log("[opencode-termux] vendor belum ada — menjalankan installer…")
  const r = spawnSync(process.execPath, [path.join(root, "install.mjs")], {
    stdio: "inherit",
    env: process.env,
  })
  if (r.status !== 0 || !ready()) {
    console.error("[opencode-termux] instalasi bundle gagal. Coba manual:")
    console.error("  npm rebuild @nemoobc/opencode-termux")
    return false
  }
  return true
}

// Bandingkan versi semver: return 1 (a>b), -1 (a<b), 0 (sama)
function cmpVer(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}

// Ambil versi terbaru dari npm registry (mode v2 pakai @opencode/cli)
async function latestUpstream() {
  try {
    const reg = PKG.opencodeUpstream?.startsWith("2.") ? "@opencode/cli" : "opencode-ai"
    const res = await fetch(`https://registry.npmjs.org/${reg}/latest`)
    if (res.ok) { const d = await res.json(); if (d.version) return d.version }
  } catch {}
  return null
}

// DNS fix: musl hasil build kita membaca config dari prefix Termux —
// pastikan filenya ada (bisa ditulis tanpa root).
function ensureDns() {
  try {
    const etc = path.join(PREFIX, "etc")
    fs.mkdirSync(etc, { recursive: true })
    const rc = path.join(etc, "resolv.conf")
    if (!fs.existsSync(rc)) fs.writeFileSync(rc, "nameserver 1.1.1.1\nnameserver 8.8.8.8\n")
    const hh = path.join(etc, "hosts")
    if (!fs.existsSync(hh)) fs.writeFileSync(hh, "127.0.0.1 localhost\n")
  } catch {}
}

function cleanEnv() {
  // LD_PRELOAD bawaan Termux (libtermux-exec) dibuat untuk Bionic dan akan
  // gagal relokasi jika ikut dimuat ke proses musl — jadi selalu dibersihkan.
  const { LD_PRELOAD, LD_PRELOAD_32BIT, ...rest } = process.env
  return rest
}

// TMPDIR: /tmp di Termux read-only — pastikan ada lokasi writable.
function ensureTmp() {
  if (process.env.TMPDIR && fs.existsSync(process.env.TMPDIR)) return
  const t = path.join(PREFIX, "tmp")
  fs.mkdirSync(t, { recursive: true })
  process.env.TMPDIR = t
}

function runBinary(args) {
  ensureTmp()
  ensureDns()
  const env = cleanEnv()
  const interactive = args.length === 0 || args[0] === "mini"
  let serverWasRunning = false
  if (interactive) {
    const s = spawnSync(loader, ["--library-path", vendor, bin, "service", "status"], { encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] })
    serverWasRunning = s.status === 0 && s.stdout.trim() !== "stopped"
  }
  // Invoke via loader langsung (bukan binary patched) — patchelf --set-interpreter
  // merusakkan binary 200MB+ (menambah PT_INTERP segment, memindahkan offset → SIGSEGV).
  // Loader di-invoke sebagai interpreter langsung: ld-musl.so --library-path vendor opencode.
  const r = spawnSync(loader, ["--library-path", vendor, bin, ...args], { stdio: "inherit", env })
  if (interactive && !serverWasRunning) {
    spawnSync(loader, ["--library-path", vendor, bin, "service", "stop"], { stdio: "ignore", env })
  }
  if (r.error) {
    console.error("[opencode-termux] gagal menjalankan binary:", r.error.message)
    return 1
  }
  const sigExit = { SIGINT: 130, SIGQUIT: 131, SIGTERM: 143 }
  return r.status ?? sigExit[r.signal] ?? 1
}

async function cmdUpdate() {
  console.log(`[opencode-termux] memperbarui bundle (paket v${PKG.version})…`)
  const env = { ...process.env }
  delete env.LD_PRELOAD
  delete env.LD_PRELOAD_32BIT
  const r = spawnSync(process.execPath, [path.join(root, "install.mjs")], {
    stdio: "inherit",
    env: env,
  })
  if (r.status !== 0) {
    console.error("[opencode-termux] ❌ update gagal.")
    return 1
  }
  // sinkronkan pin di package.json modul agar auto-heal berikutnya konsisten
  try {
    const latest = await latestUpstream()
    if (latest && cmpVer(latest, PKG.opencodeUpstream) > 0) {
      PKG.opencodeUpstream = latest
      fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(PKG, null, 2) + "\n")
    }
  } catch {}
  console.log("[opencode-termux] ✅ update selesai.")
  return 0
}

function cmdDoctor() {
  let critical = 0
  const cek = (name, fn, { crit = true } = {}) => {
    try {
      const info = fn()
      console.log(`✅ ${name}${info ? ` — ${info}` : ""}`)
    } catch (e) {
      if (crit) critical++
      console.log(`${crit ? "❌" : "⚠️ "} ${name} — ${e.message}`)
    }
  }

  console.log(`[opencode-termux] doctor v${PKG.version} (upstream ${PKG.opencodeUpstream})`)
  cek("platform", () => {
    if (process.platform !== "android") throw new Error(`process.platform=${process.platform} (bukan android)`)
    return "android"
  }, { crit: false })
  cek("arsitektur", () => {
    if (process.arch !== "arm64" && process.arch !== "x64") throw new Error(`${process.arch} tidak didukung`)
    return process.arch
  })
  cek("node >= 18", () => {
    const [M] = process.versions.node.split(".").map(Number)
    if (M < 18) throw new Error(`node ${process.versions.node}`)
    return process.versions.node
  })
  cek("tar tersedia", () => {
    const r = spawnSync("tar", ["--version"], { stdio: "ignore" })
    if (r.error || r.status !== 0) throw new Error("tidak ditemukan — pkg install tar")
  })
  cek("vendor lengkap", () => {
    if (!ready()) throw new Error("vendor/ tidak lengkap — jalankan 'opencode-termux update'")
    return `${fs.readdirSync(vendor).length} file`
  })
  cek("DNS resolv.conf", () => {
    const rc = path.join(PREFIX, "etc", "resolv.conf")
    if (!fs.existsSync(rc)) throw new Error(`${rc} hilang`)
    return "ada"
  }, { crit: false })
  cek("jaringan registry npm", () => {
    const r = spawnSync(process.execPath, ["-e", "fetch('https://registry.npmjs.org/-/ping').then(r=>{if(!r.ok)process.exit(1)})"], {
      timeout: 10000,
    })
    if (r.status !== 0) throw new Error("registry tak terjangkau")
  })
  cek("binary opencode", () => {
    if (!ready()) throw new Error("binary belum terpasang")
    const out = spawnSync(loader, ["--library-path", vendor, bin, "--version"], {
      encoding: "utf8",
      env: cleanEnv(),
    })
    if (out.status !== 0) throw new Error("gagal dieksekusi")
    return `v${out.stdout.trim()}`
  })

  console.log(critical === 0 ? "[opencode-termux] ✅ semua komponen kritis sehat" : `[opencode-termux] ❌ ${critical} masalah kritis`)
  return critical === 0 ? 0 : 1
}

function cmdVersion() {
  let binVer = "(belum terpasang)"
  if (ready()) {
    const out = spawnSync(loader, ["--library-path", vendor, bin, "--version"], {
      encoding: "utf8",
      env: cleanEnv(),
    })
    if (out.status === 0 && out.stdout.trim()) binVer = out.stdout.trim()
  }
  console.log(`opencode-termux v${PKG.version} (upstream opencode ${PKG.opencodeUpstream}, binary ${binVer})`)
  return 0
}

async function main() {
  const arg = process.argv[2]
  if (arg === "update") process.exit(await cmdUpdate())
  if (arg === "doctor") process.exit(cmdDoctor())
  if (arg === "version") process.exit(cmdVersion())
  if (arg === "help" || arg === "--help" || arg === "-h") {
    console.log(`opencode-termux v${PKG.version}
pakai:
  opencode-termux                 jalankan CLI opencode (argumen diteruskan)
  opencode-termux update          perbarui binary ke upstream terbaru
  opencode-termux doctor          diagnosis lingkungan & bundle
  opencode-termux version         info versi paket + binary`)
    process.exit(0)
  }
  if (!heal()) process.exit(1)
  process.exit(runBinary(process.argv.slice(2)))
}

main().catch(e => {
  console.error("[opencode-termux]", e.message)
  process.exit(1)
})
