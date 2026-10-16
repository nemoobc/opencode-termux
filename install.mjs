#!/usr/bin/env node
/**
 * postinstall untuk @nemoobc/opencode-termux
 * Menyusun bundle native: loader musl + libgcc/libstdc++ + binary opencode.
 * Tanpa dependensi curl — unduhan memakai fetch bawaan Node >=18.
 * Target: Termux (android/arm64). Override uji: OCX_ARCH=x64 OCX_FORCE=1
 *
 * Keandalan:
 *  - staging `.vendor-new` → smoke → swap (vendor lama tak pernah dirusak
 *    sebelum pengganti terbukti jalan; gagal → rollback otomatis).
 *  - lock file anti-tabrakan (npm rebuild + auto-heal bersamaan).
 *  - pin sha256 tarball opencode v2 bila ada (fail-closed), gzip + ELF check.
 *  - timeout unduhan 10 menit per percobaan.
 */
import fs from "fs"
import path from "path"
import { execFileSync } from "child_process"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { fileURLToPath } from "url"
import { alpinePkg, cmpVer } from "./lib/alpine.mjs"
import { fetchWithRetry } from "./lib/net.mjs"
import { expectedFromRegistry, verifySha512, verifySha256, pinFor, verifyElf } from "./lib/integrity.mjs"
import { acquireLock } from "./lib/lock.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"))
const ARCH = process.env.OCX_ARCH || "arm64"
const FORCE = !!process.env.OCX_FORCE
const IS_ANDROID = process.platform === "android"
const T0 = Date.now()
const log = m => console.log(`[opencode-termux] ${m}`)

// Versi upstream: env > package.json > default 2.0.6 (v2 — target sync)
let V = process.env.OCX_UPSTREAM || pkgJson.opencodeUpstream
if (!V) {
  V = "2.0.6"
  log(`upstream opencode default: ${V}`)
}
if (!IS_ANDROID && !FORCE) {
  log("Bukan Termux/Android — instalasi dilewati (pakai opencode-ai resmi).")
  process.exit(0)
}

const A = ARCH === "x64" ? "x86_64" : "aarch64"

const work = path.join(__dirname, ".build")
const vendorFinal = path.join(__dirname, "vendor")
const vendorTmp = path.join(__dirname, ".vendor-new")
const vendorOld = path.join(__dirname, ".vendor-old")
const DL_TIMEOUT_MS = 10 * 60_000

let LOCK = null

async function dl(url, dest, { pin = null, label = "file" } = {}) {
  log(`download ${url.split("/").pop()}`)
  LOCK?.heartbeat()
  // timeout per percobaan — signal dibuat baru setiap attempt
  const res = await fetchWithRetry(
    (u, o) => fetch(u, { ...o, signal: AbortSignal.timeout(DL_TIMEOUT_MS) }),
    url, {}, 3, m => log(m))
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest))
  if (pin) {
    verifySha256(dest, pin, label)
    log(`✅ sha256 cocok pin (${pin.slice(0, 12)}…)`)
  }
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

async function fetchLatestAlpineVersion() {
  try {
    const res = await fetchWithRetry(fetch, "https://dl-cdn.alpinelinux.org/alpine/", {}, 3)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const vers = [...text.matchAll(/href="(v\d+\.\d+)\/"/g)].map(m => m[1].slice(1))
    if (vers.length) return "v" + vers.sort(cmpVer).pop()
  } catch {}
  return "v3.21"
}

async function fetchAlpineReleaseVersion(version) {
  try {
    const res = await fetchWithRetry(fetch, `https://dl-cdn.alpinelinux.org/alpine/${version}/releases/${A}/`, {}, 3)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const vers = [...text.matchAll(new RegExp(`alpine-minirootfs-(\\d+\\.\\d+\\.\\d+)-${A}\\.tar\\.gz`, "g"))].map(m => m[1])
    if (vers.length) return vers.sort(cmpVer).pop()
  } catch {}
  return "3.21.3"
}

// DNS config di prefix Termux (bisa ditulis TANPA root)
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
    log("peringatan: setup resolv.conf dilewati (" + e.message.split("\n")[0] + ")")
  }
}

async function install() {
  fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(work, { recursive: true })
  fs.rmSync(vendorTmp, { recursive: true, force: true })
  fs.mkdirSync(vendorTmp, { recursive: true })

  // pulihkan swap yang terputus (crash antar-rename)
  if (!fs.existsSync(vendorFinal) && fs.existsSync(vendorOld)) {
    log("memulihkan vendor dari swap yang terputus…")
    fs.renameSync(vendorOld, vendorFinal)
  }

  const AV = process.env.OCX_ALPINE_VERSION || await fetchLatestAlpineVersion()
  log(`Alpine version: ${AV}`)

  // Resolusi dinamis paket Alpine dari CDN (lihat lib/alpine.mjs)
  const pkg = name => alpinePkg(fetch, `https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}`, name)

  // 1) binary opencode
  const IS_V2 = V.startsWith("2.")
  const ocSrc = path.join(work, "oc")
  if (IS_V2) {
    // v2 TIDAK ada di npm registry — unduh dari opencode.ai;
    // verifikasi: pin sha256 (bila ada) → gzip -t → ukuran → ELF
    const pin = pinFor(V, ARCH)
    if (!pin) log(`⚠️ pin sha256 ${V}/${ARCH} belum tersedia — verifikasi gzip + ukuran + ELF`)
    await dl(`https://opencode.ai/files/bin/${V}/opencode-linux-${ARCH}-musl.tar.gz`, `${work}/oc.tgz`,
      { pin, label: `tarball opencode ${V}/${ARCH}` })
    log("verifikasi integritas (gzip + ukuran)…")
    execFileSync("gzip", ["-t", `${work}/oc.tgz`], { stdio: "ignore" })
    const sz = fs.statSync(`${work}/oc.tgz`).size
    if (sz < 50 * 1024 * 1024) throw new Error(`binary mencurigakan (${sz} bytes)`)
    untar(`${work}/oc.tgz`, ocSrc)
    verifyElf(path.join(ocSrc, "opencode"), ARCH)
    log("✅ ELF valid (64-bit LE, machine sesuai arsitektur)")
  } else {
    // v1 dari npm resmi — diverifikasi sha512 registry
    const ocTgz = `opencode-linux-${ARCH}-musl-${V}.tgz`
    await dl(`https://registry.npmjs.org/opencode-linux-${ARCH}-musl/-/${ocTgz}`, `${work}/oc.tgz`)
    log("verifikasi integritas sha512…")
    const pk = await (await fetchWithRetry(fetch, `https://registry.npmjs.org/opencode-linux-${ARCH}-musl`, {}, 3)).json()
    verifySha512(`${work}/oc.tgz`, expectedFromRegistry(pk, V))
    untar(`${work}/oc.tgz`, ocSrc)
    verifyElf(path.join(ocSrc, "package", "bin"), ARCH)
  }

  // 2) libgcc + libstdc++ (versi terbaru yang tersedia di CDN)
  const apkDir = `${work}/apk`; fs.mkdirSync(apkDir, { recursive: true })
  for (const name of ["libgcc", "libstdc%2B%2B"]) {
    const f = await pkg(name)
    await dl(`https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}/${f}`, `${apkDir}/${f}`)
    untar(`${apkDir}/${f}`, apkDir)
  }

  // 2b) patchelf — untuk patch PT_INTERP (biar binary bisa re-exec sendiri)
  const pf = await pkg("patchelf")
  await dl(`https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}/${pf}`, `${apkDir}/${pf}`)
  untar(`${apkDir}/${pf}`, apkDir)

  // 3) rakit vendor di STAGING (.vendor-new — vendor lama belum disentuh)
  const vendor = vendorTmp
  const cp = (dir, name) => fs.copyFileSync(path.join(dir, name), path.join(vendor, name))
  if (A === "aarch64") {
    // loader hasil build khusus: resolv.conf & hosts menunjuk ke prefix Termux
    cp(path.join(__dirname, "prebuilt"), "ld-musl-aarch64-termux.so")
    fs.renameSync(path.join(vendor, "ld-musl-aarch64-termux.so"), path.join(vendor, "ld-musl.so"))
  } else {
    const AL = await fetchAlpineReleaseVersion(AV)
    log(`Alpine release: ${AL}`)
    const mini = `${work}/ap`; await dl(
      `https://dl-cdn.alpinelinux.org/alpine/${AV}/releases/${A}/alpine-minirootfs-${AL}-${A}.tar.gz`, `${work}/ap.tgz`)
    untar(`${work}/ap.tgz`, mini, ["lib"])
    cp(`${mini}/lib`, `ld-musl-${A}.so.1`); fs.renameSync(path.join(vendor, `ld-musl-${A}.so.1`), path.join(vendor, "ld-musl.so"))
  }
  if (IS_V2) {
    cp(`${work}/oc`, "opencode")
  } else {
    cp(`${work}/oc/package/bin`, "opencode")
  }
  // libstdc++: nama file ber-versi berubah antar rilis Alpine (6.0.33 →
  // 6.0.34 di v3.24) — deteksi dinamis + symlink soname. JANGAN hardcode.
  const stdlibDir = path.join(apkDir, "usr", "lib")
  const stdReal = fs.readdirSync(stdlibDir)
    .filter(f => /^libstdc\+\+\.so\.6\.\d/.test(f))
    .sort(cmpVer).pop()
  if (!stdReal) throw new Error("libstdc++.so.6.x tidak ditemukan di paket Alpine")
  fs.copyFileSync(path.join(stdlibDir, stdReal), path.join(vendor, stdReal))
  fs.symlinkSync(stdReal, path.join(vendor, "libstdc++.so.6")) // soname → file real
  log(`libstdc++: ${stdReal} (soname libstdc++.so.6 = symlink)`)
  cp(`${stdlibDir}`, "libgcc_s.so.1")
  cp(`${apkDir}/usr/bin`, "patchelf")
  for (const f of fs.readdirSync(vendor)) fs.chmodSync(path.join(vendor, f), 0o755)

  // 3b) symlink libc.musl → ld-musl.so (biar DT_NEEDED libc.musl-*.so.1 terpenuhi)
  const libcName = `libc.musl-${A}.so.1`
  const libcLink = path.join(vendor, libcName)
  if (!fs.existsSync(libcLink)) {
    fs.symlinkSync("ld-musl.so", libcLink)
    log(`symlink ${libcName} → ld-musl.so`)
  }

  // 3c) patchelf --set-interpreter SAJA (tanpa --set-rpath!) — HANYA saat native.
  //     Fakta dari matriks uji (x64): --set-interpreter saja + LD_LIBRARY_PATH
  //     = jalan (v2.0.11); --set-rpath = SIGSEGV, binary 195MB jadi sampah
  //     bahkan via loader. Jadi RPATH DILARANG SELAMANYA.
  //     Interpreter di-set ke path FINAL vendor/ld-musl.so — staging di-rename
  //     ke posisi itu saat swap (path absolut di data ELF tetap valid).
  const targetArch = ARCH === "x64" ? "x64" : "arm64"
  const hostArch = process.arch === "arm64" ? "arm64" : "x64"
  const nativePatch = targetArch === hostArch
  const loaderBin = path.join(vendor, "ld-musl.so")
  if (nativePatch) {
    const { LD_PRELOAD, LD_PRELOAD_32BIT, ...noPreload } = process.env
    log("patch PT_INTERP ke vendor lokal (tanpa RPATH)…")
    execFileSync(loaderBin,
      ["--library-path", vendor, path.join(vendor, "patchelf"),
        "--set-interpreter", path.join(vendorFinal, "ld-musl.so"), path.join(vendor, "opencode")],
      { stdio: "ignore", env: noPreload })
  } else {
    log(`patch PT_INTERP dilewati (cross-build ${hostArch}→${targetArch} — di-patch saat first-run di perangkat)`)
  }

  // 4) DNS config prefix Termux
  ensureEtc()

  // 5) smoke test di STAGING (via loader — path INTERP final belum berlaku di sini)
  const skipSmoke = process.env.OCX_SKIP_SMOKE === "1"
  if (skipSmoke) {
    log("smoke test dilewati (OCX_SKIP_SMOKE=1 — mode cross-build)")
  } else {
    log("smoke test (staging, via loader)…")
    const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
    execFileSync(loaderBin, ["--library-path", vendor, path.join(vendor, "opencode"), "--version"],
      { stdio: "inherit", env: { ...cleanEnv, LD_LIBRARY_PATH: vendor } })
  }

  // 6) swap: vendor → vendor.old, staging → vendor; smoke final; gagal → rollback
  fs.rmSync(vendorOld, { recursive: true, force: true })
  if (fs.existsSync(vendorFinal)) fs.renameSync(vendorFinal, vendorOld)
  fs.renameSync(vendorTmp, vendorFinal)
  if (nativePatch && !skipSmoke) {
    try {
      const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
      log("smoke test (final, exec langsung)…")
      execFileSync(path.join(vendorFinal, "opencode"), ["--version"],
        { stdio: "inherit", env: { ...cleanEnv, LD_LIBRARY_PATH: vendorFinal } })
    } catch (e) {
      log("❌ smoke pasca-swap gagal — vendor lama dikembalikan")
      fs.rmSync(vendorFinal, { recursive: true, force: true })
      if (fs.existsSync(vendorOld)) fs.renameSync(vendorOld, vendorFinal)
      throw new Error(`vendor baru gagal dieksekusi langsung: ${e.message}`)
    }
  }
  fs.rmSync(vendorOld, { recursive: true, force: true })
  log("✅ swap vendor selesai (versi baru terpasang penuh)")

  // 7) auto-install config opencode (tanpa menimpa milik user)
  try {
    const HOME = process.env.HOME || "/data/data/com.termux/files/home"
    const OC = path.join(HOME, ".config", "opencode")
    fs.mkdirSync(OC, { recursive: true }) // user baru: folder belum ada
    const cfgSrc = path.join(__dirname, "config", "opencode.json")
    const cfgDst = path.join(OC, "opencode.json")
    if (!fs.existsSync(cfgDst)) {
      fs.copyFileSync(cfgSrc, cfgDst)
      log("✅ config default terpasang (model gratis)")
    } else {
      log("config user sudah ada — tidak disentuh")
    }
    // 7b) keybind cli.json — Tab untuk switch agent (build ↔ plan, gaya v1)
    const cliSrc = path.join(__dirname, "config", "cli.json")
    const cliDst = path.join(OC, "cli.json")
    if (!fs.existsSync(cliDst)) {
      fs.copyFileSync(cliSrc, cliDst)
      log("✅ keybind default terpasang (Tab = switch agent)")
    } else {
      log("cli.json user sudah ada — tidak disentuh")
    }
  } catch (e) {
    log("auto-install config dilewati:", e.message)
  }
}

async function main() {
  LOCK = await acquireLock(path.join(__dirname, ".install.lock"), {
    log: m => log(m), staleMs: 20 * 60_000, timeoutMs: 30 * 60_000,
  })
  try {
    await install()
  } finally {
    LOCK.release()
    fs.rmSync(work, { recursive: true, force: true })
    fs.rmSync(vendorTmp, { recursive: true, force: true }) // staging sisa (gagal sebelum swap)
  }
}

main().then(() => {
  console.log(`[opencode-termux] ✅ siap dalam ${((Date.now() - T0) / 1000).toFixed(1)}s
• global : jalankan 'opencode-termux'
• lokal  : 'npx opencode-termux' dari folder project ini`)
}).catch(e => {
  console.error("[opencode-termux] ❌ instalasi gagal:", e.message)
  process.exitCode = 1
})
