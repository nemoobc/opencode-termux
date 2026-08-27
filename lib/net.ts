/**
 * Utilitas jaringan: fetch dengan retry + backoff eksponensial.
 * fetchFn dapat disuntik untuk unit test.
 */

interface ResponseLike {
  ok: boolean
  status: number
  body: ReadableStream<Uint8Array> | null
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
}

interface ErrorWithCode extends Error {
  code?: string
  cause?: { code?: string }
}

const RETRYABLE_ERRORS = new Set(["ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "ENETUNREACH", "EAI_AGAIN"])

export type FetchFn = (url: string, options?: RequestInit) => Promise<ResponseLike | Response>

export async function fetchWithRetry(
  fetchFn: FetchFn,
  url: string,
  opts: RequestInit = {},
  retries = 3,
  log: (msg: string) => void = () => {}
): Promise<ResponseLike | Response> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(url, opts)
      if (!res.ok && res.status < 500 && res.status !== 429) return res
      if (res.ok) return res
      lastErr = new Error(`HTTP ${res.status} — ${url}`)
    } catch (e) {
      lastErr = e
      const code = (e as ErrorWithCode).cause?.code || (e as ErrorWithCode).code
      if (code && !RETRYABLE_ERRORS.has(code)) {
        throw e
      }
    }
    if (attempt < retries) {
      const wait = Math.min(1000 * 2 ** (attempt - 1), 8000)
      log(`gagal (${attempt}/${retries}) — ulang dalam ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr
}