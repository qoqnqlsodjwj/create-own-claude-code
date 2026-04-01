/**
 * 模块 6 - Step 3: 内置 Agent 实现
 *
 * 本文件实现一组预定义的专用 Agent：
 * - Explore Agent - 只读探索代码库
 * - Plan Agent - 架构设计和规划
 * - Verification Agent - 代码验证和测试
 * - General Purpose Agent - 通用任务处理
 */

import { Tool } from "./step1-agent-interface"
import { InProcessAgent } from "./step2-spawn-agent"
import { readFile, readdir, stat } from "fs/promises"
import { join, extname, basename } from "path"

// 通用只读工具集
const readOnlyTools: Tool[] = [
  {
    name: "read_file",
    description: "读取文件内容",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    async execute(input) {
      const { path } = input as { path: string }
      try { return { success: true, content: await readFile(path, "utf-8") } }
      catch (e) { return { success: false, error: (e as Error).message } }
    }
  },
  {
    name: "list_directory",
    description: "列出目录内容",
    input_schema: { type: "object", properties: { path: { type: "string" }, recursive: { type: "boolean" } }, required: ["path"] },
    async execute(input) {
      const { path, recursive = false } = input as { path: string; recursive?: boolean }
      const walk = async (dir: string, d: number): Promise<unknown[]> => {
        if (d > 3) return []
        const entries = await readdir(dir)
        const results: unknown[] = []
        for (const entry of entries) {
          if (entry.startsWith(".") && entry !== ".gitignore") continue
          const full = join(dir, entry)
          const st = await stat(full)
          if (st.isDirectory()) results.push(recursive ? { name: entry, type: "dir", children: await walk(full, d + 1) } : { name: entry, type: "dir" })
          else results.push({ name: entry, type: "file", ext: extname(entry), size: st.size })
        }
        return results
      }
      return walk(path, 0)
    }
  }
]

// 读写工具集
const readWriteTools: Tool[] = [
  ...readOnlyTools,
  {
    name: "write_file",
    description: "创建或覆盖文件",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    async execute(input) {
      const { path, content } = input as { path: string; content: string }
      const { writeFile } = await import("fs/promises")
      await writeFile(path, content, "utf-8")
      return { success: true, path, bytes: Buffer.byteLength(content) }
    }
  }
]

// 验证工具集
const verificationTools: Tool[] = [
  {
    name: "run_test",
    description: "运行测试",
    input_schema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] },
    async execute(input) {
      const { file } = input as { file: string }
      const { exec } = await import("child_process")
      return new Promise(resolve => {
        exec("npm test", { timeout: 60000 }, (err, stdout, stderr) => {
          resolve({ success: !err, output: stdout + stderr, exitCode: err?.code || 0 })
        })
      })
    }
  }
]

// Explore Agent - 代码库探索专家
export class ExploreAgent extends InProcessAgent {
  constructor(private projectRoot?: string) {
    super({
      name: "Explore",
      description: "代码库探索专家",
      model: "claude-sonnet-4-20250514",
      systemPrompt: "你是一个专业的代码库探索专家。分析项目结构，识别技术栈。",
      tools: readOnlyTools,
      permissionMode: "read_only"
    })
  }

  async explore(depth: "quick" | "detailed" = "detailed"): Promise<ExploreResult> {
    const output = await this.execute(depth === "quick" ? "快速扫描项目结构" : "详细分析项目结构")
    return { agentId: this.id, status: output.status, findings: output.output, duration: output.duration }
  }
}

export interface ExploreResult { agentId: string; status: string; findings: string; duration: number }

// Plan Agent - 架构设计专家
export class PlanAgent extends InProcessAgent {
  constructor(private context?: string) {
    super({
      name: "Plan",
      description: "架构设计专家",
      model: "claude-sonnet-4-20250514",
      systemPrompt: "你是一个经验丰富的架构师。理解需求，设计架构，制定计划。",
      tools: readOnlyTools,
      permissionMode: "read_only"
    })
  }

  async designFeature(requirement: string): Promise<PlanResult> {
    const output = await this.execute("设计功能架构：" + requirement)
    return { agentId: this.id, status: output.status, plan: output.output, duration: output.duration }
  }
}

export interface PlanResult { agentId: string; status: string; plan: string; duration: number }

// Verification Agent - 代码验证专家
export class VerificationAgent extends InProcessAgent {
  constructor() {
    super({
      name: "Verification",
      description: "代码验证专家",
      model: "claude-sonnet-4-20250514",
      systemPrompt: "你是一个严谨的代码质量专家。运行测试，验证正确性。",
      tools: verificationTools,
      permissionMode: "read_write"
    })
  }

  async verifyChanges(changedFiles: string[]): Promise<VerificationResult> {
    const output = await this.execute("验证修改：" + changedFiles.join("\n"))
    return { agentId: this.id, status: output.status, verificationReport: output.output, duration: output.duration }
  }
}

export interface VerificationResult { agentId: string; status: string; verificationReport: string; duration: number }

// General Purpose Agent - 通用任务处理
export class GeneralPurposeAgent extends InProcessAgent {
  constructor(permissionMode: "read_only" | "read_write" = "read_write") {
    super({
      name: "General",
      description: "通用任务 Agent",
      model: "claude-sonnet-4-20250514",
      systemPrompt: "你是一个全能的 AI 编程助手。",
      tools: permissionMode === "read_only" ? readOnlyTools : readWriteTools,
      permissionMode
    })
  }

  async do(task: string): Promise<TaskResult> {
    const output = await this.execute(task)
    return { agentId: this.id, status: output.status, result: output.output, error: output.error, duration: output.duration }
  }
}

export interface TaskResult { agentId: string; status: string; result: string; error?: string; duration: number }

// Agent 工厂
export class AgentFactory {
  static createExplorer(projectRoot?: string): ExploreAgent { return new ExploreAgent(projectRoot) }
  static createPlanner(context?: string): PlanAgent { return new PlanAgent(context) }
  static createVerifier(): VerificationAgent { return new VerificationAgent() }
  static createGeneral(permissionMode: "read_only" | "read_write" = "read_write"): GeneralPurposeAgent { return new GeneralPurposeAgent(permissionMode) }
}
