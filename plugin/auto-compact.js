// auto-compact.js — setelah INTERRUPT, otomatis meringkas sesi:
// token turun mendekati 0%, ingatan tetap (ringkasan), ngobrol lanjut tetap nyambung.
// Log: ~/.cache/opencode/auto-compact.log

import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const LOG = path.join(os.homedir(), ".cache", "opencode", "auto-compact.log")
const INTERRUPT_WINDOW_MS = 30000

function log(...a) {
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true })
    fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${a.join(" ")}\n`)
  } catch {}
}

export const AutoCompact = async ({ client, $ }) => {
  const interrupted = new Map() // sessionID -> { at, providerID, modelID }

  async function summarize(sessionID, providerID, modelID) {
    const body = { providerID, modelID }
    // 1) coba SDK
    try {
      if (client?.session?.summarize) {
        await client.session.summarize({ sessionID, providerID, modelID })
        log("✓ summarize via SDK", sessionID)
        return true
      }
    } catch (e) { log("SDK summarize gagal:", e.message) }
    // 2) coba $ helper
    try {
      if ($) {
        await $(`/session/${sessionID}/summarize`, { method: "POST", body })
        log("✓ summarize via $", sessionID)
        return true
      }
    } catch (e) { log("$ summarize gagal:", e.message) }
    // 3) fallback langsung ke 127.0.0.1:4096
    try {
      const r = await fetch(`http://127.0.0.1:4096/session/${sessionID}/summarize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      log("fallback summarize HTTP", r.status, sessionID)
      return r.ok
    } catch (e) { log("fallback gagal:", e.message) }
    return false
  }

  return {
    event: async ({ event }) => {
      try {
        // 1) deteksi interrupt: pesan assistant membawa error abort
        if (event.type === "message.updated") {
          const i = event.properties?.info
          if (i?.role === "assistant" && i?.error) {
            interrupted.set(i.sessionID || event.properties.sessionID, {
              at: Date.now(),
              providerID: i.model?.providerID || "opencode",
              modelID: i.model?.modelID || i.model?.id || "big-pickle",
            })
            log("interrupt terdeteksi", i.sessionID || event.properties.sessionID)
          }
        }

        // 2) saat sesi diam + baru saja di-interrupt → auto summarize
        if (event.type === "session.idle") {
          const sid = event.properties?.sessionID
          const mark = interrupted.get(sid)
          if (mark && Date.now() - mark.at < INTERRUPT_WINDOW_MS) {
            interrupted.delete(sid)
            log("auto-compact jalan untuk", sid)
            const ok = await summarize(sid, mark.providerID, mark.modelID)
            log(ok ? "✓ sesi diringkas — token fresh, ingatan tetap" : "✗ summarize gagal (coba lagi manual / tunggu provider pulih)", sid)
          }
        }

        // 3) buang penanda basi (>30 dtk)
        if (event.type === "session.idle") {
          for (const [sid, m] of interrupted) if (Date.now() - m.at > INTERRUPT_WINDOW_MS) interrupted.delete(sid)
        }
      } catch (e) { log("plugin error:", e.message) }
    },
  }
}
