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
import { alpinePkg } from "./lib/alpine.js"
import { fetchWithRetry } from "./lib/net.js"
import { expectedFromRegistry, verifySha512, Packument } from "./lib/integrity.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8")) as { version: string; opencodeUpstream: string }
const ARCH = process.env.OCX_ARCH || "arm64"
const FORCE = !!process.env.OCX_FORCE
const IS_ANDROID = process.platform === "android"
const T0 = Date.now()
const log = (...args: unknown[]) => console.log("[opencode-termux]", ...args)

let V = process.env.OCX_UPSTREAM || pkgJson.opencodeUpstream
if (!V) {
  const latest = await (await fetch("https://registry.npmjs.org/opencode-ai/latest")).json() as { version: string }
  V = latest.version
  log(`upstream opencode-ai terbaru: ${V}`)
}
if (!IS_ANDROID && !FORCE) {
  log("Bukan Termux/Android — instalasi dilewati (pakai opencode-ai resmi).")
  process.exit(0)
}

const A = ARCH === "x64" ? "x86_64" : "aarch64"

async function dl(url: string, dest: string): Promise<void> {
  log(`download ${url.split("/").pop()}`)
  const res = await fetchWithRetry(fetch, url, {}, 3, m => log(m))
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  if (!res.body) throw new Error("Response body is null")
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest))
}

const untar = (tgz: string, dest: string, members: string[] = []): void => {
  fs.mkdirSync(dest, { recursive: true })
  const run = (m: string[]) => execFileSync("tar", ["xzf", tgz, "-C", dest, ...m], { stdio: ["ignore", "ignore", "pipe"] })
  try { run(members.map(x => "./" + x)) }
  catch { try { run(members) } catch (e) {
    console.error("[opencode-termux] 'tar' tidak ditemukan. Jalankan: pkg install tar")
    throw e
  } }
}

const work = path.join(__dirname, ".build")
fs.rmSync(work, { recursive: true, force: true })
fs.mkdirSync(work, { recursive: true })

async function fetchLatestAlpineVersion(): Promise<string> {
  try {
    const res = await fetchWithRetry(fetch, "https://dl-cdn.alpinelinux.org/alpine/latest-stable/", {}, 3)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const match = text.match(/href="(v\d+\.\d+)"/)
    if (match) return match[1]
  } catch {}
  return "v3.21"
}

async function fetchAlpineReleaseVersion(version: string): Promise<string> {
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

  const pkg = (name: string) => alpinePkg(fetch, `https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}`, name)

  const ocTgz = `opencode-linux-${ARCH}-musl-${V}.tgz`
  await dl(`https://registry.npmjs.org/opencode-linux-${ARCH}-musl/-/${ocTgz}`, `${work}/oc.tgz`)
  log("verifikasi integritas sha512…")
  const pk = await (await fetchWithRetry(fetch, `https://registry.npmjs.org/opencode-linux-${ARCH}-musl`, {}, 3)).json() as Packument
  const integrity = expectedFromRegistry(pk, V)
  if (!integrity) throw new Error("integrity tidak ditemukan di registry")
  verifySha512(`${work}/oc.tgz`, integrity)
  untar(`${work}/oc.tgz`, `${work}/oc`)

  const apkDir = `${work}/apk`; fs.mkdirSync(apkDir, { recursive: true })
  for (const name of ["libgcc", "libstdc%2B%2B"]) {
    const f = await pkg(name)
    await dl(`https://dl-cdn.alpinelinux.org/alpine/${AV}/main/${A}/${f}`, `${apkDir}/${f}`)
    untar(`${apkDir}/${f}`, apkDir)
  }

  const vendor = path.join(__dirname, "vendor")
  fs.rmSync(vendor, { recursive: true, force: true }); fs.mkdirSync(vendor)
  const cp = (dir: string, name: string) => fs.copyFileSync(path.join(dir, name), path.join(vendor, name))
  if (A === "aarch64") {
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

  function ensureEtc(): void {
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
      const msg = e instanceof Error ? e.message : String(e)
      log("peringatan: setup resolv.conf dilewati (" + msg.split("\n")[0] + ")")
    }
  }
  ensureEtc()

  if (process.env.OCX_SKIP_SMOKE === "1") {
    log("smoke test dilewati (OCX_SKIP_SMOKE=1 — mode cross-build)")
  } else {
    log("smoke test…")
    const { LD_PRELOAD, LD_PRELOAD_32BIT, ...cleanEnv } = process.env
    execFileSync(path.join(vendor, "ld-musl.so"),
      [path.join(vendor, "opencode"), "--version"],
      { stdio: "inherit", env: { ...cleanEnv, LD_LIBRARY_PATH: vendor } })
  }

  try {
    const HOME = process.env.HOME || "/data/data/com.termux/files/home"
    const OC = path.join(HOME, ".config", "opencode")
    for (const [srcDir, dstName] of [["agents", "agent"], ["commands", "command"]]) {
      const src = path.join(__dirname, srcDir)
      if (!fs.existsSync(src)) continue
      const dst = path.join(OC, dstName)
      fs.mkdirSync(dst, { recursive: true })
      for (const f of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, f), path.join(dst, f))
        log(`✅ terpasang: ${dstName}/${f}`)
      }
    }
    const cfgSrc = path.join(__dirname, "config", "opencode.json")
    const cfgDst = path.join(OC, "opencode.json")
    if (!fs.existsSync(cfgDst)) {
      fs.copyFileSync(cfgSrc, cfgDst)
      log("✅ config default terpasang (model gratis)")
    } else {
      log("config user sudah ada — tidak disentuh")
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log("auto-install agent dilewati:", msg)
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.error("[opencode-termux] ❌ instalasi gagal:", msg)
  process.exitCode = 1
  throw e
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}

console.log(`[opencode-termux] ✅ siap dalam ${((Date.now() - T0) / 1000).toFixed(1)}s
• global : jalankan 'opencode-termux'
• lokal  : 'npx opencode-termux' dari folder project ini`)