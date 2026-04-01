import * as fs from "fs/promises"
import * as path from "path"
import type { Tool, ToolContext } from "./step1-tool-interface"
import { buildTool } from "./step1-tool-interface"

function isPathAllowed(fp: string, dirs?: string[]): boolean {
  if (!dirs || !dirs.length) return true
  const rp = path.resolve(fp)
  return dirs.some(d => rp.startsWith(path.resolve(d)))
}

export function createFileReadTool(o: { allowedDirs?: string[] } = {}): Tool {
  const { allowedDirs = [] } = o
  return buildTool({
    name: "read",
    description: "读取文件内容",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    async execute(i, ctx) {
      const { path: fp } = i as { path: string }
      if (!isPathAllowed(fp, ctx.allowedDirectories)) return { type: "error", content: "", error: "不允许" }
      try { return { type: "success", content: await fs.readFile(fp, "utf-8") } }
      catch (e) { return { type: "error", content: "", error: String(e) } }
    }
  })
}

export function createFileWriteTool(o: { allowedDirs?: string[] } = {}): Tool {
  const { allowedDirs = [] } = o
  return buildTool({
    name: "write",
    description: "写入文件内容",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    async execute(i, _ctx) {
      const { path: fp, content } = i as { path: string; content: string }
      if (!isPathAllowed(fp, allowedDirs)) return { type: "error", content: "", error: "不允许" }
      try { await fs.mkdir(path.dirname(fp), { recursive: true }); await fs.writeFile(fp, content, "utf-8"); return { type: "success", content: "写入成功" } }
      catch (e) { return { type: "error", content: "", error: String(e) } }
    }
  })
}

export function createGlobTool(o: { allowedDirs?: string[] } = {}): Tool {
  const { allowedDirs = [] } = o
  return buildTool({
    name: "glob",
    description: "Glob模式搜索文件",
    input_schema: { type: "object", properties: { pattern: { type: "string" }, baseDir: { type: "string" } }, required: ["pattern"] },
    async execute(i, ctx) {
      const { pattern, baseDir } = i as { pattern: string; baseDir?: string }
      const dir = baseDir || ctx.workingDirectory || process.cwd()
      if (!isPathAllowed(dir, allowedDirs)) return { type: "error", content: "", error: "不允许" }
      const r = await glob(dir, pattern)
      return { type: "success", content: r.join("\n") || "无匹配" }
    }
  })
}

async function glob(dir: string, pat: string): Promise<string[]> {
  const res: string[] = []
  const parts = pat.split("/")
  async function search(d: string, ps: string[]) {
    if (!ps.length) return
    const [p, ...rest] = ps
    if (p === "**") {
      try { for (const e of await fs.readdir(d, { withFileTypes: true })) if (e.isDirectory()) await search(path.join(d, e.name), ps) } catch {}
    } else {
      try { for (const e of await fs.readdir(d, { withFileTypes: true })) { const fp = path.join(d, e.name); if (match(e.name, p)) rest.length ? e.isDirectory() && await search(fp, rest) : res.push(fp) } } catch {}
    }
  }
  function match(n: string, p: string) { return new RegExp("^" + p.replace(/\*/g, ".*").replace(/\?/g, ".") + "$").test(n) }
  await search(dir, parts)
  return res
}

async function demo() {
  console.log("Step 2: 文件工具演示")
  const td = "/tmp/tool-demo"
  const tf = path.join(td, "t.txt")
  await fs.mkdir(td, { recursive: true }).catch(() => {})
  await fs.writeFile(tf, "Hello\nWorld", "utf-8").catch(() => {})
  const ctx: ToolContext = { allowedDirectories: [td], permissionMode: "acceptEdits" }
  const r = await createFileReadTool({ allowedDirs: [td] }).call({ path: tf }, ctx)
  console.log("Read:", r)
  const g = await createGlobTool({ allowedDirs: ["/tmp"] }).call({ pattern: "*.txt", baseDir: td }, ctx)
  console.log("Glob:", g.content)
}
demo().catch(console.error)
