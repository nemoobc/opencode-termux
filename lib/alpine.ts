/**
 * Resolver paket Alpine dari CDN — anti-404 saat Alpine memperbarui paket
 * dalam satu branch. Fallback ke versi terakhir yang diketahui hidup.
 */
export function cmpVer(a: string, b: string): number {
  const pa = a.split(/[.\-r]/).filter(Boolean).map(Number)
  const pb = b.split(/[.\-r]/).filter(Boolean).map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

export interface FetchFn {
  (url: string, options?: RequestInit): Promise<{ text: () => Promise<string> }>
}

export async function alpinePkg(
  fetchFn: FetchFn,
  cdnBase: string,
  nameEncoded: string,
  fallback = "14.2.0-r4"
): Promise<string> {
  let latest: { file: string; v: string } | null = null
  try {
    const res = await fetchFn(`${cdnBase}/`)
    const idx = await res.text()
    const re = new RegExp(`${nameEncoded}-([0-9][0-9a-zA-Z.+]*)-r([0-9]+)\\.apk`, "g")
    for (const m of idx.matchAll(re)) {
      const v = `${m[1]}-r${m[2]}`
      if (!latest || cmpVer(v, latest.v) > 0) latest = { file: m[0], v }
    }
  } catch {}
  if (!latest) {
    console.warn(`[opencode-termux] listing CDN gagal — fallback ${nameEncoded}-${fallback}.apk`)
    latest = { file: `${nameEncoded}-${fallback}.apk`, v: fallback }
  }
  return latest.file
}