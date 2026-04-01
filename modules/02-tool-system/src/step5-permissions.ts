import * as readline from "readline"
import type { ToolContext } from "./step1-tool-interface"

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions"

export interface PermissionRule {
  toolPattern?: string
  pathPattern?: string
  commandPattern?: string
  action: "allow" | "deny" | "confirm"
  name?: string
}

export const DEFAULT_RULES: PermissionRule[] = [
  { name: "bash需确认", toolPattern: "bash", action: "confirm" },
  { name: "write需确认", toolPattern: "write", action: "confirm" },
  { name: "read默认允许", toolPattern: "read", action: "allow" },
  { name: "危险命令拒绝", commandPattern: "rm -rf", action: "deny" }
]

export class PermissionChecker {
  private rules: PermissionRule[]
  constructor(rules: PermissionRule[] = DEFAULT_RULES) { this.rules = [...rules] }

  check(toolName: string, input: unknown, ctx: ToolContext) {
    if (ctx.permissionMode === "bypassPermissions") return { allowed: true, needsConfirm: false }
    const i = input as Record<string, unknown>
    for (const rule of this.rules) {
      if (rule.toolPattern && !this.match(toolName, rule.toolPattern)) continue
      if (rule.pathPattern && !this.match(String(i.path || ""), rule.pathPattern)) continue
      if (rule.commandPattern && !this.match(String(i.command || ""), rule.commandPattern)) continue
      if (rule.action === "allow") return { allowed: true, needsConfirm: false }
      if (rule.action === "deny") return { allowed: false, needsConfirm: false, reason: rule.name }
      if (rule.action === "confirm") {
        if (ctx.permissionMode === "acceptEdits" && ctx.isAutoMode) return { allowed: true, needsConfirm: false }
        return { allowed: false, needsConfirm: true, message: `${toolName} 需要确认` }
      }
    }
    return { allowed: false, needsConfirm: true }
  }

  private match(str: string, pat: string): boolean {
    const re = pat.replace(/\*/g, ".*").replace(/\?/g, ".")
    return new RegExp("^" + re + "$", "i").test(str)
  }
}

export async function showConfirm(msg: string): Promise<"allow" | "deny"> {
  return new Promise(r => {
    console.log("\n" + "=".repeat(50))
    console.log("权限确认:", msg)
    console.log("=".repeat(50))
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question("允许? (y/n): ", a => { rl.close(); r(a.toLowerCase() === "y" ? "allow" : "deny") })
  })
}

export class PermissionPipeline {
  constructor(private checker = new PermissionChecker()) {}
  async execute(toolName: string, fn: () => Promise<any>, input: unknown, ctx: ToolContext) {
    const check = this.checker.check(toolName, input, ctx)
    if (!check.allowed && check.needsConfirm) {
      const confirm = await showConfirm(check.message || toolName)
      if (confirm === "deny") return { type: "error", content: "", error: "用户拒绝" }
    }
    if (!check.allowed) return { type: "error", content: "", error: check.reason || "权限拒绝" }
    try { return { type: "success", content: await fn() } }
    catch (e) { return { type: "error", content: "", error: String(e) } }
  }
}

async function demo() {
  console.log("Step 5: 权限系统演示")
  const checker = new PermissionChecker()
  const ctx: ToolContext = { permissionMode: "default" }
  
  console.log("\n检查 read 权限:", checker.check("read", {}, ctx))
  console.log("检查 bash 权限:", checker.check("bash", { command: "ls" }, ctx))
  console.log("检查危险命令:", checker.check("bash", { command: "rm -rf" }, ctx))
}
demo().catch(console.error)
