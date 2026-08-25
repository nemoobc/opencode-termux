/**
 * Utilitas jaringan: fetch dengan retry + backoff eksponensial.
 * fetchFn dapat disuntik untuk unit test.
 */
export async function fetchWithRetry(fetchFn, url, opts = {}, retries = 3, log = () => {}) {
  let lastErr
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(url, opts)
      // 429/5xx → layak dicoba ulang; 4xx lain → gagal permanen
      if (!res.ok && res.status < 500 && res.status !== 429) return res
      if (res.ok) return res
      lastErr = new Error(`HTTP ${res.status} — ${url}`)
    } catch (e) {
      lastErr = e
    }
    if (attempt < retries) {
      const wait = Math.min(1000 * 2 ** (attempt - 1), 8000)
      log(`gagal (${attempt}/${retries}) — ulang dalam ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr
}
