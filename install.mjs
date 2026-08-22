#!/usr/bin/env node
/**
 * postinstall untuk @nemoobc/opencode-termux
 * Menyusun bundle native: loader musl + libgcc/libstdc++ + binary opencode.
 * Tanpa dependensi curl — unduhan memakai fetch bawaan Node >=18.
 * Target: Termux (android/arm64). Override uji: OCX_ARCH=x64 OCX_FORCE=1
 */
import fs from "fs"
import path from "path"
import { execFileSync } from "child_process"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"))
const ARCH = process.env.OCX_ARCH || "arm64"
const FORCE = !!process.env.OCX_FORCE
const IS_ANDROID = process.platform === "android"

// Versi upstream: env > package.json > otomatis ambil terbaru dari registry
let V = process.env.OCX_UPSTREAM || pkgJson.opencodeUpstream
if (!V) {
  const latest = await (await fetch("https://registry.npmjs.org/opencode-ai/latest")).json()
  V = latest.version
  console.log(`[opencode-termux] upstream opencode-ai terbaru: ${V}`)
}
const GLOBAL_HINT =
  process.platform === "win32" ? "" : ""

if (!IS_ANDROID && !FORCE) {
  console.log("[opencode-termux] Bukan Termux/Android — instalasi dilewati (pakai opencode-ai resmi).")
  process.exit(0)
}

const A = ARCH === "x64" ? "x86_64" : "aarch64"

async function dl(url, dest) {
  console.log(`[opencode-termux] download ${url.split("/").pop()}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest))
}
const untar = (tgz, dest, members = []) => {
  fs.mkdirSync(dest, { recursive: true })
  const run = m => execFileSync("tar", ["xzf", tgz, "-C", dest, ...m], { stdio: ["ignore", "ignore", "pipe"] })
  try { run(members.map(x => "./" + x)) }
  catch { try { run(members) } catch (e) {
    console.error("[opencode-termux] 'tar' tidak ditemukan. Jalankan: pkg install tar")
    throw e
  } }
}

const work = path.join(__dirname, ".build")
fs.rmSync(work, { recursive: true, force: true })
fs.mkdirSync(work, { recursive: true })
const AV = "v3.21", AL = "3.21.3"

// 1) binary opencode (musl) dari npm resmi
await dl(`https://registry.npmjs.org/opencode-linux-${ARCH}-musl/-/opencode-linux-${ARCH}-musl-${V}.tgz`, `${work}/oc.tgz`)
untar(`${work}/oc.tgz`, `${work}/oc`)

// 2) libgcc + libstdc++
const apkDir = `${work}/apk`; fs.mkdirSync(apkDir, { recursive: true })
for (const f of [`libgcc-14.2.0-r4.apk`, `libstdc%2B%2B-14.2.0-r4.apk`]) {
  await dl(`https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}/${f}`, `${apkDir}/${f}`)
  untar(`${apkDir}/${f}`, apkDir)
}

// 3) rakit vendor/
const vendor = path.join(__dirname, "vendor")
fs.rmSync(vendor, { recursive: true, force: true }); fs.mkdirSync(vendor)
const cp = (dir, name) => fs.copyFileSync(path.join(dir, name), path.join(vendor, name))
if (A === "aarch64") {
  // loader hasil build khusus: resolv.conf & hosts menunjuk ke prefix Termux
  cp(path.join(__dirname, "prebuilt"), "ld-musl-aarch64-termux.so")
  fs.renameSync(path.join(vendor, "ld-musl-aarch64-termux.so"), path.join(vendor, "ld-musl.so"))
} else {
  const mini = `${work}/ap`; await dl(
    `https://dl-cdn.alpinelinux.org/alpine/${AV}/releases/${A}/alpine-minirootfs-${AL}-${A}.tar.gz`, `${work}/ap.tgz`)
  untar(`${work}/ap.tgz`, mini, ["lib"])
  cp(`${mini}/lib`, `ld-musl-${A}.so.1`); fs.renameSync(path.join(vendor, `ld-musl-${A}.so.1`), path.join(vendor, "ld-musl.so"))
}
cp(`${work}/oc/package/bin`, "opencode")
cp(`${apkDir}/usr/lib`, "libstdc++.so.6"); cp(`${apkDir}/usr/lib`, "libstdc++.so.6.0.33"); cp(`${apkDir}/usr/lib`, "libgcc_s.so.1")
for (const f of fs.readdirSync(vendor)) fs.chmodSync(path.join(vendor, f), 0o755)

// 4) siapkan DNS config di prefix Termux (bisa ditulis TANPA root)
function ensureEtc() {
  try {
    const PREFIX = process.env.TERMUX_PREFIX || "/data/data/com.termux/files/usr"
    const etc = path.join(PREFIX, "etc")
    fs.mkdirSync(etc, { recursive: true })
    const rc = path.join(etc, "resolv.conf")
    if (!fs.existsSync(rc)) fs.writeFileSync(rc, "nameserver 1.1.1.1\nnameserver 8.8.8.8\n")
    const hh = path.join(etc, "hosts")
    if (!fs.existsSync(hh)) fs.writeFileSync(hh, "127.0.0.1 localhost\n")
  } catch (e) {
    if (!FORCE && IS_ANDROID) throw e
  }
}
ensureEtc()

// 5) smoke test (LD_PRELOAD termux-exec dibuang: tidak kompatibel dengan musl)
console.log("[opencode-termux] smoke test…")
const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
execFileSync(path.join(vendor, "ld-musl.so"),
  [path.join(vendor, "opencode"), "--version"],
  { stdio: "inherit", env: { ...cleanEnv, LD_LIBRARY_PATH: vendor } })

fs.rmSync(work, { recursive: true, force: true })
console.log(`[opencode-termux] ✅ siap!
• global : jalankan 'opencode-termux'
• lokal  : 'npx opencode-termux' dari folder project ini`)
