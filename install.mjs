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
import { alpinePkg } from "./lib/alpine.mjs"
import { fetchWithRetry } from "./lib/net.mjs"
import { expectedFromRegistry, verifySha512 } from "./lib/integrity.mjs"

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

async function dl(url, dest) {
  log(`download ${url.split("/").pop()}`)
  const res = await fetchWithRetry(fetch, url, {}, 3, m => log(m))
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

async function fetchLatestAlpineVersion() {
  try {
    const res = await fetchWithRetry(fetch, "https://dl-cdn.alpinelinux.org/alpine/latest-stable/", {}, 3)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const match = text.match(/href="(v\d+\.\d+)"/)
    if (match) return match[1]
  } catch {}
  return "v3.21"
}

async function fetchAlpineReleaseVersion(version) {
  try {
    const res = await fetchWithRetry(fetch, `https://dl-cdn.alpinelinux.org/alpine/${version}/releases/${A}/`, {}, 3)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const match = text.match(new RegExp(`alpine-minirootfs-(\\d+\\.\\d+\\.\\d+)-${A}\\.tar\\.gz`))
    if (match) return match[1]
  } catch {}
  return "3.21.3"
}

try {
  const AV = process.env.OCX_ALPINE_VERSION || await fetchLatestAlpineVersion()
  const AL = await fetchAlpineReleaseVersion(AV)
  log(`Alpine version: ${AV} (release ${AL})`)

  // Resolusi dinamis paket Alpine dari CDN (lihat lib/alpine.mjs)
  const pkg = name => alpinePkg(fetch, `https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}`, name)

  // 1) binary opencode (musl)
  const IS_V2 = V.startsWith("2.")
  if (IS_V2) {
    // v2 TIDAK ada di npm registry — unduh dari opencode.ai, verifikasi gzip + ukuran
    const ocTgz = `opencode-linux-${ARCH}-musl.tar.gz`
    await dl(`https://opencode.ai/files/bin/${V}/${ocTgz}`, `${work}/oc.tgz`)
    log("verifikasi integritas (gzip + ukuran)…")
    execFileSync("gzip", ["-t", `${work}/oc.tgz`], { stdio: "ignore" })
    const sz = fs.statSync(`${work}/oc.tgz`).size
    if (sz < 50 * 1024 * 1024) throw new Error(`binary mencurigakan (${sz} bytes)`)
    untar(`${work}/oc.tgz`, `${work}/oc`)
  } else {
    // v1 dari npm resmi — diverifikasi sha512 registry
    const ocTgz = `opencode-linux-${ARCH}-musl-${V}.tgz`
    await dl(`https://registry.npmjs.org/opencode-linux-${ARCH}-musl/-/${ocTgz}`, `${work}/oc.tgz`)
    log("verifikasi integritas sha512…")
    const pk = await (await fetchWithRetry(fetch, `https://registry.npmjs.org/opencode-linux-${ARCH}-musl`, {}, 3)).json()
    verifySha512(`${work}/oc.tgz`, expectedFromRegistry(pk, V))
    untar(`${work}/oc.tgz`, `${work}/oc`)
  }

  // 2) libgcc + libstdc++ (versi terbaru yang tersedia di CDN)
  const apkDir = `${work}/apk`; fs.mkdirSync(apkDir, { recursive: true })
  for (const name of ["libgcc", "libstdc%2B%2B"]) {
    const f = await pkg(name)
    await dl(`https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}/${f}`, `${apkDir}/${f}`)
    untar(`${apkDir}/${f}`, apkDir)
  }

  // 2b) patchelf — untuk patch PT_INTERP/RPATH (biar binary bisa re-exec sendiri)
  const pf = await pkg("patchelf")
  await dl(`https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}/${pf}`, `${apkDir}/${pf}`)
  untar(`${apkDir}/${pf}`, apkDir)

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
  if (IS_V2) {
    cp(`${work}/oc`, "opencode")
  } else {
    cp(`${work}/oc/package/bin`, "opencode")
  }
  cp(`${apkDir}/usr/lib`, "libstdc++.so.6"); cp(`${apkDir}/usr/lib`, "libstdc++.so.6.0.33"); cp(`${apkDir}/usr/lib`, "libgcc_s.so.1")
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
  //     bahkan via loader. Jadi RPATH DILARANG SELAMANYA; libstdc++/libgcc
  //     dipenuhi lewat LD_LIBRARY_PATH yang di-set wrapper (lihat cleanEnv).
  //     Tanpa INTERP benar, re-exec background server gagal ("cannot load
  //     serve") dan TUI tidak start.
  //     Cross-build (host ≠ target) patch-nya DILEWATI — loader/patchelf target
  //     tak bisa dieksekusi di host; bundle di-patch saat first-run di
  //     perangkat (ensurePatched di bin/opencode-termux.js, selalu native).
  {
    const targetArch = ARCH === "x64" ? "x64" : "arm64"
    const hostArch = process.arch === "arm64" ? "arm64" : "x64"
    if (targetArch !== hostArch) {
      log(`patch PT_INTERP dilewati (cross-build ${hostArch}→${targetArch} — di-patch saat first-run di perangkat)`)
    } else {
      const loaderBin = path.join(vendor, "ld-musl.so")
      const { LD_PRELOAD, LD_PRELOAD_32BIT, ...noPreload } = process.env
      log("patch PT_INTERP ke vendor lokal (tanpa RPATH)…")
      execFileSync(loaderBin,
        ["--library-path", vendor, path.join(vendor, "patchelf"),
          "--set-interpreter", loaderBin, path.join(vendor, "opencode")],
        { stdio: "ignore", env: noPreload })
    }
  }

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
      log("peringatan: setup resolv.conf dilewati (" + e.message.split("\n")[0] + ")")
    }
  }
  ensureEtc()

  // 5) smoke test — binary langsung (sudah di-patch PT_INTERP di 3c,
  //     atau dilewati saat cross-build). LD_LIBRARY_PATH memenuhi libstdc++.
  if (process.env.OCX_SKIP_SMOKE === "1") {
    log("smoke test dilewati (OCX_SKIP_SMOKE=1 — mode cross-build)")
  } else {
    log("smoke test…")
    const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
    execFileSync(path.join(vendor, "opencode"), ["--version"],
      { stdio: "inherit", env: { ...cleanEnv, LD_LIBRARY_PATH: vendor } })
  }

  // 6) auto-install config opencode (tanpa menimpa milik user)
  try {
    const HOME = process.env.HOME || "/data/data/com.termux/files/home"
    const OC = path.join(HOME, ".config", "opencode")
    const cfgSrc = path.join(__dirname, "config", "opencode.json")
    const cfgDst = path.join(OC, "opencode.json")
    if (!fs.existsSync(cfgDst)) {
      fs.copyFileSync(cfgSrc, cfgDst)
      log("✅ config default terpasang (model gratis)")
    } else {
      log("config user sudah ada — tidak disentuh")
    }
    // 6b) keybind cli.json — Tab untuk switch agent (build ↔ plan, gaya v1)
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
} catch (e) {
  console.error("[opencode-termux] ❌ instalasi gagal:", e.message)
  process.exitCode = 1
  throw e
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}

console.log(`[opencode-termux] ✅ siap dalam ${((Date.now() - T0) / 1000).toFixed(1)}s
• global : jalankan 'opencode-termux'
• lokal  : 'npx opencode-termux' dari folder project ini`)
