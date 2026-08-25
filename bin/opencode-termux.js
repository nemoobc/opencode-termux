#!/usr/bin/env node
const { spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const os = require("os")
const root = path.join(__dirname, "..")
const vendor = path.join(root, "vendor")
const loader = path.join(vendor, "ld-musl.so")
const bin = path.join(vendor, "opencode")
const PKG = require(path.join(root, "package.json"))
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

function runBinary(args) {
  // LD_PRELOAD bawaan Termux (libtermux-exec) dibuat untuk Bionic dan akan
  // gagal relokasi jika ikut dimuat ke proses musl — jadi selalu dibersihkan.
  const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
  ensureDns()
  const r = spawnSync(loader, [bin, ...args], {
    stdio: "inherit",
    env: { ...cleanEnv, LD_LIBRARY_PATH: vendor },
  })
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
    const latest = await (await fetch("https://registry.npmjs.org/opencode-ai/latest")).json()
    if (latest.version && latest.version !== PKG.opencodeUpstream) {
      PKG.opencodeUpstream = latest.version
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
    const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
    const out = spawnSync(loader, [bin, "--version"], {
      encoding: "utf8",
      env: { ...cleanEnv, LD_LIBRARY_PATH: vendor },
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
    const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
    const out = spawnSync(loader, [bin, "--version"], {
      encoding: "utf8",
      env: { ...cleanEnv, LD_LIBRARY_PATH: vendor },
    })
    if (out.status === 0 && out.stdout.trim()) binVer = out.stdout.trim()
  }
  console.log(`opencode-termux v${PKG.version} (upstream opencode ${PKG.opencodeUpstream}, binary ${binVer})`)
  return 0
}

/* ---------- models / status / model ---------- */
const ZEN = "https://opencode.ai/zen/v1"
const OC_CFG = path.join(os.homedir(), ".config", "opencode", "opencode.json")

async function cmdModels() {
  try {
    const r = await fetch(ZEN + "/models")
    const j = await r.json()
    let aktif = ""
    try { aktif = JSON.parse(fs.readFileSync(OC_CFG, "utf8")).model || "" } catch {}
    console.log("model relay opencode (" + (j.data?.length || 0) + "):")
    for (const m of j.data || []) {
      const full = "opencode/" + m.id
      console.log((full === aktif ? " → " : "   ") + m.id)
    }
    if (aktif) console.log("\naktif: " + aktif)
    return 0
  } catch (e) {
    console.error("zen tidak terjangkau:", e.message)
    return 1
  }
}

async function cmdStatus() {
  let model = "-"
  try { model = JSON.parse(fs.readFileSync(OC_CFG, "utf8")).model || "-" } catch {}
  let zen = "DOWN"
  try { const r = await fetch(ZEN + "/models"); zen = "HTTP " + r.status + (r.ok ? " ✓" : " (limit?)") } catch { zen = "tidak terjangkau" }
  let bundle = "-"
  try { bundle = (require("child_process").execSync("du -sh " + JSON.stringify(path.join(root, "vendor"))).toString().split("	")[0]) } catch {}
  let disk = "-"
  try { disk = require("child_process").execSync("df -h /data/data/com.termux/files/home | tail -1 | awk '{print $4}'").toString().trim() } catch {}
  console.log("opencode-termux v" + PKG.version + " (binary upstream " + (PKG.opencodeUpstream || "?") + ")")
  console.log("model aktif : " + model)
  console.log("zen relay   : " + zen)
  console.log("bundle      : " + bundle)
  console.log("storage free: " + disk)
  return 0
}

async function cmdModel(id) {
  if (!id) { console.error("pakai: opencode-termux model <id>   contoh: opencode-termux model big-pickle") ; return 1 }
  try {
    const r = await fetch(ZEN + "/models")
    const j = await r.json()
    const ids = (j.data || []).map((m) => m.id)
    if (!ids.includes(id)) {
      console.error("model tidak ditemukan di relay. tersedia:")
      ids.forEach((x) => console.log("  " + x))
      return 1
    }
    let c = {}
    try { c = JSON.parse(fs.readFileSync(OC_CFG, "utf8")) } catch {}
    c[""] = c[""] || "https://opencode.ai/config.json"
    c.model = "opencode/" + id
    fs.writeFileSync(OC_CFG, JSON.stringify(c, null, 2))
    console.log("✓ model aktif sekarang:", c.model)
    return 0
  } catch (e) { console.error("zen tidak terjangkau:", e.message); return 1 }
}

async function main() {
  const arg = process.argv[2]
  if (arg === "update") return cmdUpdate()
  if (arg === "doctor") return cmdDoctor()
  if (arg === "version") return cmdVersion()
  if (arg === "models") return cmdModels()
  if (arg === "status") return cmdStatus()
  if (arg === "model") return cmdModel(process.argv[3])
  if (arg === "help" || arg === "--help" || arg === "-h") {
    console.log(`opencode-termux v${PKG.version}
pakai:
  opencode-termux                 jalankan CLI opencode (argumen diteruskan)
  opencode-termux update          perbarui binary ke upstream terbaru
  opencode-termux doctor          diagnosis lingkungan & bundle
  opencode-termux version         info versi paket + binary`)
    return 0
  }
  if (!heal()) return 1
  const code = runBinary(process.argv.slice(2))
  // banner perpisahan setelah sesi TUI ditutup
  if (process.argv[2] === undefined) {
    console.log("")
    console.log("[2m█▀▀█ █▀▀█ █▀▀▀ █▀▀▄ █▀▀▀ █▀▀█ █▀▀▄ █▀▀▀  ────  ▀▀▀▀ █▀▀▀ █▀▀█ █▄▄█ █  █ ▀▄ ▄▀[0m")
    console.log("[2m█  █ █▀▀█ █▀▀  █▄▄▀ █▀▀  █  █ █  █ █▀▀  ────    █    █▄▄▀ █▄▄█ █  █ █  █  █  [0m")
    console.log("[2m▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀  ────  ▀▀▀▀ ▀ ▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀ ▀▀[0m")
    console.log("")
    console.log("[2m                    jalankan lagi: [0m[1;32mopencode-termux[0m")
  }
  return code
}

main().then(code => process.exit(code)).catch(e => {
  console.error("[opencode-termux]", e.message)
  process.exit(1)
})
