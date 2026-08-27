/**
 * Verifikasi integritas file terhadap hash sha512 format registry npm
 * ("sha512-<base64>"). Mencegah tarball korup/termanipulasi saat transit.
 */
import crypto from "crypto"
import fs from "fs"

export interface Packument {
  versions?: Record<string, { dist?: { integrity?: string } }>
}

export function expectedFromRegistry(packument: Packument, version: string): string | null {
  const dist = packument?.versions?.[version]?.dist
  return dist?.integrity?.startsWith("sha512-") ? dist.integrity.slice(7) : null
}

export function verifySha512(filePath: string, expectedB64: string): true {
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