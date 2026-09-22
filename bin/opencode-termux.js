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

function ocEnv(extra = {}) {
  // LD_LIBRARY_PATH memenuhi libstdc++/libgcc (RPATH dilarang: --set-rpath
  // = SIGSEGV). Hanya untuk anak opencode — process node sendiri tak tersentuh.
  return { ...cleanEnv(), ...extra, LD_LIBRARY_PATH: vendor };
}

function runOc(args, opts = {}) {
  // Exec langsung dulu (binary di-patch PT_INTERP saat install/first-run) —
  // re-exec background server butuh /proc/self/exe = binary opencode.
  // Fallback ke invoke via loader (cukup untuk perintah sekali-jalan).
  const env = ocEnv(opts.env);
  const direct = spawnSync(bin, args, { ...opts, env });
  if (!direct.error) return direct;
  return spawnSync(loader, ["--library-path", vendor, bin, ...args], { ...opts, env });
}

// True bila string PT_INTERP binary sudah menunjuk loader vendor lokal.
// .interp selalu di awal file → cukup baca 8KB pertama (murah, tiap run).
function interpPatched() {
  try {
    const fd = fs.openSync(bin, "r");
    const buf = Buffer.alloc(8192);
    fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    return buf.includes(path.join(vendor, "ld-musl.so"));
  } catch { return false; }
}

// Bundle cross-build datang belum di-patch (install.mjs melewati patch saat
// cross). Patch INTERP SAJA di sini — selalu native (jalan di perangkat),
// TANPA --set-rpath (terbukti SIGSEGV). Idempoten: sekali saja.
function ensurePatched() {
  if (!ready() || interpPatched()) return true;
  const patcher = path.join(vendor, "patchelf");
  if (!fs.existsSync(patcher)) return false;
  console.log("[opencode-termux] patch PT_INTERP ke vendor lokal (tanpa RPATH)…");
  const env = ocEnv();
  const r = spawnSync(loader,
    ["--library-path", vendor, patcher, "--set-interpreter", loader, bin],
    { stdio: "ignore", env });
  const v = spawnSync(bin, ["--version"], { encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"] });
  if (r.error || r.status !== 0 || v.error || v.status !== 0 || !interpPatched()) {
    console.error("[opencode-termux] patch gagal — perintah sekali-jalan tetap bisa, TUI butuh binary ter-patch.");
    return false;
  }
  return true;
}

function runBinary(args) {
  ensureTmp();
  ensureDns();
  ensurePatched();
  const env = ocEnv();
  const interactive = args.length === 0 || args[0] === "mini";
  let serverWasRunning = false;
  if (interactive) {
    const s = runOc(["service", "status"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    serverWasRunning = !s.error && s.status === 0 && (s.stdout || "").trim() !== "stopped";
  }
  const r = runOc(args, { stdio: "inherit" });
  if (interactive && !serverWasRunning) {
    runOc(["service", "stop"], { stdio: "ignore", timeout: 15000 });
  }
  if (r.error) {
    console.error("[opencode-termux] gagal menjalankan binary:", r.error.message)
    return 1
  }
  const sigExit = { SIGINT: 130, SIGQUIT: 131, SIGTERM: 143 }
  return r.status ?? sigExit[r.signal] ?? 1
}

async function cmdUpdate() {
  console.log("[opencode-termux] update via npm — npm install -g @nemoobc/opencode-termux@latest")
  const env = { ...process.env }
  delete env.LD_PRELOAD
  delete env.LD_PRELOAD_32BIT
  const r = spawnSync("npm", ["install", "-g", "@nemoobc/opencode-termux@latest"], {
    stdio: "inherit",
    env: env,
  })
  if (r.error || r.status !== 0) {
    console.error("[opencode-termux] ❌ update gagal.")
    console.error("Kalau npm memblokir script postinstall (allow-scripts), jalankan dulu:")
    console.error("  npm config set allow-scripts=@nemoobc/opencode-termux --location=user")
    console.error("  npm rebuild -g @nemoobc/opencode-termux")
    return 1
  }
  console.log("[opencode-termux] ✅ update selesai — cek dengan 'opencode-termux version'.")
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
    const out = runOc(["--version"], {
      encoding: "utf8",
      env: cleanEnv(),
    })
    if (out.error || out.status !== 0) throw new Error("gagal dieksekusi")
    return `v${out.stdout.trim()}`
  })

  console.log(critical === 0 ? "[opencode-termux] ✅ semua komponen kritis sehat" : `[opencode-termux] ❌ ${critical} masalah kritis`)
  return critical === 0 ? 0 : 1
}

function cmdVersion() {
  let binVer = "(belum terpasang)"
  if (ready()) {
    const out = runOc(["--version"], {
      encoding: "utf8",
      env: cleanEnv(),
    })
    if (!out.error && out.status === 0 && out.stdout.trim()) binVer = out.stdout.trim()
  }
  console.log(`opencode-termux v${PKG.version} (upstream opencode ${PKG.opencodeUpstream}, binary ${binVer})`)
  return 0
}

// Perintah-perintah yang SAH sebagai argumen pertama opencode (selain path/folder
// project). Argumen bareword lain yang bukan path = salah ketik → tolak ramah,
// supaya tidak jatuh ke chdir ENOENT yang membingungkan dari binary opencode.
const KNOWN_ARGS = new Set([
  "mini", "run", "serve", "auth", "agents", "agent", "models", "debug",
  "uninstall", "reset", "telemetry", "open", "restore", "menu",
])

function looksLikePath(a) {
  return a.includes("/") || a === "." || a === ".." || fs.existsSync(a)
}

function looksLikeFlag(a) {
  return a.startsWith("-")
}

async function main() {
  const arg = process.argv[2]
  if (arg === "update" || arg === "upgrade") process.exit(await cmdUpdate())
  if (arg === "doctor") process.exit(cmdDoctor())
  if (arg === "version") process.exit(cmdVersion())
  if (arg === "help" || arg === "--help" || arg === "-h") {
    console.log(`opencode-termux v${PKG.version}
pakai:
  opencode-termux [opsi/path]      jalankan CLI opencode (argumen diteruskan)
  opencode-termux update           update via npm: npm install -g @nemoobc/opencode-termux
  opencode-termux doctor           diagnosis lingkungan & bundle
  opencode-termux version          info versi paket + binary`)
    process.exit(0)
  }
  if (arg !== undefined && !looksLikeFlag(arg) && !looksLikePath(arg) && !KNOWN_ARGS.has(arg)) {
    console.error(`[opencode-termux] perintah tidak dikenal: '${arg}'`)
    console.error("Cek daftar perintah: 'opencode-termux help' — atau beri path folder project yang valid.")
    process.exit(1)
  }
  if (!heal()) process.exit(1)
  process.exit(runBinary(process.argv.slice(2)))
}

main().catch(e => {
  console.error("[opencode-termux]", e.message)
  process.exit(1)
})
