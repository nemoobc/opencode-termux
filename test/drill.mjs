#!/usr/bin/env node
/**
 * Drill installer offline — menjalankan scripts/installer.sh TANPA Node dan
 * TANPA jaringan, memakai bundle palsu (vendor/opencode = shell script yang
 * meniru binary ter-patch INTERP).
 *
 * Skenario:
 *  1. pasang bersih → smoke lolos → marker .interp-patched dibuat
 *  2. wrapper: --version benar + LD_LIBRARY_PATH menunjuk vendor
 *  3. pasang ulang dengan bundle KORUP → smoke gagal → instalasi lama
 *     dikembalikan utuh (rollback), wrapper lama masih jalan
 *
 * Jalankan: npm run drill
 */
import fs from "fs"
import path from "path"
import { spawnSync, execFileSync } from "child_process"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0, fail = 0
const ok = (cond, msg) => { if (!cond) throw new Error(msg) }
const t = (name, fn) => {
  try { fn(); console.log(`✅ ${name}`); pass++ }
  catch (e) { console.log(`❌ ${name}\n   └─ ${e.message}`); fail++ }
}

const VER = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version
const ARCH = process.arch === "arm64" ? "aarch64" : "x86_64"
const SB = fs.mkdtempSync(path.join(root, ".build-drill-"))
const LIB = path.join(SB, "lib", "opencode-termux")
const BINDIR = path.join(SB, "bin")

console.log(`🔩 drill installer offline — sandbox ${path.basename(SB)} (${ARCH})`)

const ENV = {
  ...process.env,
  OCX_LIBDIR: LIB, OCX_BINDIR: BINDIR,
  TERMUX_PREFIX: path.join(SB, "usr"), TMPDIR: path.join(SB, "tmp"),
}
fs.mkdirSync(ENV.TMPDIR, { recursive: true })

// Bundle palsu "sudah ter-patch": string penanda INTERP ada di 64KB pertama
// dan menunjuk $LIB/vendor/ld-musl.so — first-run patch dilewati secara sah.
const fakeBody = (label) => `#!/bin/sh
# INTERP marker: ${LIB}/vendor/ld-musl.so
if [ "$1" = "--version" ]; then echo "9.9.9-${label}"; exit 0; fi
echo "DRILL_LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
exit 0
`

function makeBundle({ label = "fresh", corrupt = false } = {}) {
  const stage = path.join(SB, "stage")
  fs.rmSync(stage, { recursive: true, force: true })
  const pkgDir = path.join(stage, "opencode-termux")
  fs.mkdirSync(path.join(pkgDir, "vendor"), { recursive: true })
  fs.mkdirSync(path.join(pkgDir, "bin"), { recursive: true })
  const oc = corrupt
    ? "#!/bin/sh\necho korup >&2\nexit 1\n"
    : fakeBody(label)
  fs.writeFileSync(path.join(pkgDir, "vendor", "opencode"), oc)
  // loader & patchelf dummy: selalu gagal → memaksa jalur fallback/rollback
  fs.writeFileSync(path.join(pkgDir, "vendor", "ld-musl.so"), "#!/bin/sh\nexit 1\n")
  fs.writeFileSync(path.join(pkgDir, "vendor", "patchelf"), "#!/bin/sh\nexit 1\n")
  for (const f of ["opencode", "ld-musl.so", "patchelf"]) fs.chmodSync(path.join(pkgDir, "vendor", f), 0o755)
  const bundle = path.join(SB, `opencode-termux-${VER}-${ARCH}.tar.gz`)
  execFileSync("tar", ["czf", bundle, "-C", stage, "opencode-termux"])
  return bundle
}

// installer "rilis": placeholder @VERSION@ diganti seperti build-release.sh
const tpl = fs.readFileSync(path.join(root, "scripts", "installer.sh"), "utf8")
fs.writeFileSync(path.join(SB, "installer.sh"), tpl.split("@VERSION@").join(VER))

const runInstaller = () =>
  spawnSync("sh", [path.join(SB, "installer.sh")], { env: ENV, encoding: "utf8" })
const wrap = (...args) =>
  spawnSync("sh", [path.join(BINDIR, "opencode-termux"), ...args], { encoding: "utf8" })

makeBundle({ label: "fresh" })

t("pasang bersih: exit 0 + smoke lolos + marker .interp-patched", () => {
  const r = runInstaller()
  ok(r.status === 0, `installer exit ${r.status}\n${r.stdout}\n${r.stderr}`)
  ok(/terpasang/.test(r.stdout), "output tidak memuat 'terpasang'")
  ok(fs.existsSync(path.join(LIB, ".interp-patched")), "marker .interp-patched tidak dibuat")
})

t("wrapper: --version benar", () => {
  const r = wrap("--version")
  ok(r.status === 0, `wrapper exit ${r.status}: ${r.stderr}`)
  ok(/9\.9\.9-fresh/.test(r.stdout), `output: ${r.stdout.trim()}`)
})

t("wrapper: LD_LIBRARY_PATH menunjuk vendor (libstdc++ terpenuhi)", () => {
  const r = wrap()
  ok(r.stdout.includes(`DRILL_LD_LIBRARY_PATH=${LIB}/vendor`), `LD_LIBRARY_PATH salah: ${r.stdout.trim()}`)
})

t("pasang ulang bundle KORUP: gagal + instalasi lama dikembalikan", () => {
  makeBundle({ label: "corrupt", corrupt: true })
  const r = runInstaller()
  ok(r.status !== 0, "installer dengan bundle korup harus GAGAL")
  ok(/dikembalikan/.test(r.stdout + r.stderr), "tidak ada pesan rollback 'dikembalikan'")
  const v = wrap("--version")
  ok(v.status === 0 && /9\.9\.9-fresh/.test(v.stdout), "instalasi lama tidak selamat setelah rollback")
})

t("tidak ada sisa staging (LIBDIR.new / .old)", () => {
  ok(!fs.existsSync(LIB + ".new"), "LIBDIR.new tersisa")
  ok(!fs.existsSync(LIB + ".old"), "LIBDIR.old tersisa")
})

console.log(`\n${"=".repeat(50)}\ndrill: ${pass} lulus, ${fail} gagal`)
if (process.env.DRILL_KEEP === "1") console.log(`sandbox dipertahankan: ${SB}`)
else fs.rmSync(SB, { recursive: true, force: true })
if (fail > 0) process.exit(1)
