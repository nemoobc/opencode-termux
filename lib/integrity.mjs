/**
 * Verifikasi integritas file:
 *  - sha512 format registry npm ("sha512-<base64>") untuk paket v1.
 *  - sha256 hex + pin per versi/arsitektur untuk tarball opencode.ai v2
 *    (CDN tidak menyediakan checksum — pin di repo ini adalah satu-satunya
 *    acuan; bila pin ada → WAJIB cocok (fail-closed), bila tidak ada → skip).
 *  - verifikasi ELF minimal (magic/class/endian/machine) sebelum exec binary.
 */
import crypto from "crypto"
import fs from "fs"

export const expectedFromRegistry = (packument, version) => {
  const dist = packument?.versions?.[version]?.dist
  return dist?.integrity?.startsWith("sha512-") ? dist.integrity.slice(7) : null
}

export function verifySha512(filePath, expectedB64) {
  if (!expectedB64) throw new Error("tidak ada hash acuan (integrity) dari registry")
  const h = crypto.createHash("sha512")
  h.update(fs.readFileSync(filePath))
  const got = h.digest("base64")
  const a = Buffer.from(got)
  const b = Buffer.from(expectedB64)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error(`integritas gagal: file ≠ sha512 registry (${filePath})`)
  }
  return true
}

export const sha256File = (filePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")

export function verifySha256(filePath, expectedHex, label = "binary") {
  const got = sha256File(filePath)
  if (got !== expectedHex) {
    throw new Error(
      `integritas ${label} gagal: sha256 tidak cocok dengan pin\n` +
      `  diharapkan: ${expectedHex}\n  didapat:    ${got} (${filePath})`)
  }
  return true
}

/**
 * Pin sha256 tarball opencode.ai v2 (per versi/arsitektur) — dihitung dari
 * unduhan nyata CDN. Tidak ada di pin → verifikasi hanya gzip+ukuran.
 */
export const BIN_PINS = {
  "2.0.21/arm64": "2b91209518e7ee8b4e21022fa4a6f93b2f2514897cf125b0caf85979c997a97a",
  "2.0.30/arm64": "ff021dca8e4127154596324f2f5a82a5b8983fb530daf803dcf8140a149f3e19",
}

export const pinFor = (version, arch) => BIN_PINS[`${version}/${arch}`] || null

/** verifikasi ELF minimal: magic, 64-bit, little-endian, machine sesuai arch */
export function verifyElf(filePath, arch) {
  const want = { arm64: 0xb7, x64: 0x3e }[arch]
  if (!want) throw new Error(`arsitektur ${arch} tidak dikenal untuk cek ELF`)
  const fd = fs.openSync(filePath, "r")
  const buf = Buffer.alloc(64)
  try { fs.readSync(fd, buf, 0, 64, 0) } finally { fs.closeSync(fd) }
  if (buf.subarray(0, 4).toString("latin1") !== "\x7fELF") throw new Error(`bukan ELF: ${filePath}`)
  if (buf[4] !== 2) throw new Error(`ELF bukan 64-bit (class=${buf[4]}): ${filePath}`)
  if (buf[5] !== 1) throw new Error(`ELF bukan little-endian (data=${buf[5]}): ${filePath}`)
  const machine = buf.readUInt16LE(0x12)
  if (machine !== want) throw new Error(`ELF machine 0x${machine.toString(16)} ≠ ${arch} (0x${want.toString(16)}): ${filePath}`)
  return true
}
