/**
 * Resolver paket Alpine dari CDN — anti-404 saat Alpine memperbarui paket
 * dalam satu branch. Fallback ke versi terakhir yang diketahui hidup.
 */
export const cmpVer = (a, b) => {
  const pa = a.split(/[.\-r]/).filter(Boolean).map(Number)
  const pb = b.split(/[.\-r]/).filter(Boolean).map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

export async function alpinePkg(fetchFn, cdnBase, nameEncoded, fallback = "14.2.0-r4") {
  let latest = null
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
