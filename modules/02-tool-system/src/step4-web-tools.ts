import https from "https"
import http from "http"
import type { Tool, ToolContext } from "./step1-tool-interface"
import { buildTool } from "./step1-tool-interface"

function httpGet(url: string, timeout = 15000): Promise<{ content: string; status: number }> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url)
      const cli = u.protocol === "https:" ? https : http
      const req = cli.get(u, { timeout }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpGet(res.headers.location, timeout).then(resolve).catch(reject); return
        }
        const chunks: Buffer[] = []
        res.on("data", c => chunks.push(c))
        res.on("end", () => resolve({ content: Buffer.concat(chunks).toString("utf-8"), status: res.statusCode || 0 }))
        res.on("error", reject)
      })
      req.on("error", reject)
      req.on("timeout", () => { req.destroy(); reject(new Error("超时")) })
    } catch (e) { reject(e) }
  })
}

export function createWebFetchTool(): Tool {
  return buildTool({
    name: "web_fetch",
    description: "获取网页内容",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    async execute(i, _ctx) {
      const { url } = i as { url: string }
      try {
        const { content, status } = await httpGet(url)
        if (status >= 400) return { type: "error", content: "", error: `HTTP ${status}` }
        const text = content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
        return { type: "success", content: text.substring(0, 5000) }
      } catch (e) { return { type: "error", content: "", error: String(e) } }
    }
  })
}

export function createWebSearchTool(): Tool {
  return buildTool({
    name: "web_search",
    description: "网络搜索",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    async execute(i, _ctx) {
      const { query } = i as { query: string }
      try {
        const { content } = await httpGet(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`)
        const data = JSON.parse(content)
        let out = ""
        if (data.AbstractText) out += data.AbstractText
        if (data.RelatedTopics?.length) out += "\n\n相关: " + data.RelatedTopics.slice(0, 5).map((t: any) => t.Text).join("; ")
        return { type: "success", content: out || "无结果" }
      } catch (e) { return { type: "error", content: "", error: String(e) } }
    }
  })
}

async function demo() {
  console.log("Step 4: Web工具演示")
  const ctx: ToolContext = { permissionMode: "acceptEdits" }
  const fetch = createWebFetchTool()
  const r = await fetch.call({ url: "https://example.com" }, ctx)
  console.log("Fetch:", r.content?.substring(0, 100))
}
demo().catch(console.error)
