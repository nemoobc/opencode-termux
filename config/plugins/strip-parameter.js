// strip-parameter.js — opencode plugin (global: ~/.config/opencode/plugins/)
// Membersihkan raw XML tool-call tags literal (mis. <parameter>, </function_calls>,
// <parameter name="...">) dari output TEKS model SEBELUM dirender TUI, supaya
// tag mentah tidak bocor ke layar.
//
// Mitigasi lokal atas issue opencode #24316 (bug "<parameter>" literal di TUI),
// sejalan dengan pendekatan PR #27984 (strip dangling XML artifacts).
//
// CATATAN: Hook "experimental.text.complete" bersifat eksperimental & hanya
// memodifikasi output teks. Plugin murni ESM tanpa dependensi eksternal.

export const StripParameterPlugin = async (ctx) => {
  try {
    await ctx?.client?.app.log?.({
      body: {
        service: "strip-parameter",
        level: "info",
        message: "Plugin initialized — mensupresi raw XML tool-call tags dari output teks",
      },
    })
  } catch {}

  return {
    "experimental.text.complete": async (_input, output) => {
      const before = output.text
      if (typeof before !== "string" || !before.includes("<")) return

      let text = before

      // 1) Hapus blok tool-call XML lengkap (tag + konten)
      text = text.replace(/<function_calls>[\s\S]*?<\/function_calls>/g, "")
      text = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
      text = text.replace(/<invoke\b[^>]*>[\s\S]*?<\/invoke>/g, "")
      text = text.replace(/<antml:function_calls>[\s\S]*?<\/antml:function_calls>/g, "")

      // 2) Hapus pasangan <parameter ...>...</parameter> & <parameter>...</parameter>
      text = text.replace(/<parameter\b[^>]*>[\s\S]*?<\/parameter>/g, "")

      // 3) Hapus tag tool-call "dangling" (pembuka/penutup tanpa pasangan)
      text = text.replace(/<\/?parameter\b[^>]*>/g, "")
      text = text.replace(/<\/?invoke\b[^>]*>/g, "")
      text = text.replace(/<\/?function_calls\b[^>]*>/g, "")
      text = text.replace(/<\/?tool_call\b[^>]*>/g, "")
      text = text.replace(/<\/?antml:\w+(?:\s[^>]*)?>/g, "")
      text = text.replace(/<\|mask_start\|>[\s\S]*?<\|mask_end\|>/g, "")

      // 4) Rapikan baris kosong berlebih & spasi sisa
      text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")

      if (text !== before) output.text = text
    },
  }
}

export default StripParameterPlugin
