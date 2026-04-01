import { spawn } from "child_process"
import type { Tool, ToolContext } from "./step1-tool-interface"
import { buildTool } from "./step1-tool-interface"

const DANGEROUS = ["rm -rf", "dd", "mkfs", "sudo", "su "]

function isSafe(cmd: string): { safe: boolean; reason?: string } {
  for (const d of DANGEROUS) if (cmd.toLowerCase().includes(d)) return { safe: false, reason: `危险命令: ${d}` }
  return { safe: true }
}

export function createBashTool(o: { timeout?: number } = {}): Tool {
  const { timeout = 30000 } = o
  return buildTool({
    name: "bash",
    description: "执行shell命令",
    input_schema: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"] },
    async execute(i, ctx) {
      const { command, cwd } = i as { command: string; cwd?: string }
      const safe = isSafe(command)
      if (!safe.safe) return { type: "error", content: "", error: safe.reason }
      return new Promise(r => {
        let out = ""
        const child = spawn("/bin/bash", ["-c", command], { cwd: cwd || ctx.workingDirectory })
        const t = setTimeout(() => { child.kill(); r({ type: "error", content: out, error: "超时" }) }, timeout)
        child.stdout?.on("data", d => out += d)
        child.stderr?.on("data", d => out += d)
        child.on("close", c => { clearTimeout(t); r({ type: c === 0 ? "success" : "error", content: out }) })
        child.on("error", e => { clearTimeout(t); r({ type: "error", content: "", error: String(e) }) })
      })
    }
  })
}

async function demo() {
  console.log("Step 3: Shell工具演示")
  const ctx: ToolContext = { permissionMode: "acceptEdits", workingDirectory: "/tmp" }
  const bash = createBashTool()
  const r = await bash.call({ command: "echo Hello" }, ctx)
  console.log("Result:", r)
  const bad = await bash.call({ command: "rm -rf /" }, ctx)
  console.log("Dangerous:", bad.error)
}
demo().catch(console.error)
