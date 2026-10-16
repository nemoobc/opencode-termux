/**
 * Lock file sederhana anti-tabrakan instalasi (mis. npm rebuild + auto-heal
 * berjalan bersamaan): file berisi {pid, ts}; holder mati atau basi → diambil
 * alih. `heartbeat()` memperbarui ts supaya unduhan panjang tidak dianggap
 * basi oleh proses lain.
 */
import fs from "fs"
import path from "path"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === "EPERM" // proses ada tapi milik user lain
  }
}

function readInfo(lockPath) {
  try {
    const info = JSON.parse(fs.readFileSync(lockPath, "utf8"))
    return Number.isInteger(info?.pid) && Number.isFinite(info?.ts) ? info : null
  } catch {
    return null
  }
}

/**
 * Ambil lock; resolve dengan { release, heartbeat, path }.
 * - staleMs: umur ts (tanpa heartbeat) yang dianggap basi → boleh diambil alih.
 * - timeoutMs: batas tunggu selama holder masih hidup.
 */
export async function acquireLock(lockPath, { timeoutMs = 30 * 60_000, staleMs = 20 * 60_000, log = () => {} } = {}) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  const start = Date.now()
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, "wx")
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }))
      fs.closeSync(fd)
      let released = false
      return {
        path: lockPath,
        release() {
          if (released) return
          released = true
          try { fs.rmSync(lockPath, { force: true }) } catch {}
        },
        heartbeat(extra = {}) {
          try { fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, ts: Date.now(), ...extra })) } catch {}
        },
      }
    } catch (e) {
      if (e.code !== "EEXIST") throw e
      const info = readInfo(lockPath)
      const age = info ? Date.now() - info.ts : Infinity
      if (!info || !isAlive(info.pid) || age > staleMs) {
        log(`lock basi (pid ${info?.pid ?? "?"}, umur ${Math.round(age / 1000)}s) — diambil alih`)
        try { fs.rmSync(lockPath, { force: true }) } catch {}
        continue
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`lock ${lockPath} masih dipegang pid ${info.pid} — tunggu proses itu selesai atau hapus file lock`)
      }
      log(`menunggu lock (pid ${info.pid} sedang instalasi)…`)
      await sleep(1000)
    }
  }
}
