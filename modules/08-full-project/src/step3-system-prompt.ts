/**
 * 模块 8 - Step 3: 系统提示构建
 *
 * 本文件实现动态系统提示的构建逻辑：
 * - buildSystemPrompt()：主构建函数
 * - 注入当前日期/工作目录/Git 信息
 * - 注入 CLAUDE.md 项目记忆
 * - 分段构建（基础 + 上下文 + 工具说明 + 记忆）
 *
 * 系统提示决定了 AI 的行为方式和可用能力
 */

import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { execSync } from "child_process"
import type { ToolDefinition } from "./step2-tool-pool"
import type { Config } from "./step1-config"

// ============================================================
// 上下文信息收集
// ============================================================

/** 系统上下文 — 从环境中动态采集的信息 */
export interface SystemContext {
  /** 当前日期时间 */
  currentDate: string
  /** 工作目录 */
  workingDirectory: string
  /** 操作系统类型 */
  platform: string
  /** Shell 类型 */
  shell: string
  /** Git 仓库状态（可选） */
  gitInfo?: GitInfo
  /** CLAUDE.md 记忆内容（可选） */
  claudeMdContent?: string
}

/** Git 仓库信息 */
export interface GitInfo {
  /** 当前分支 */
  branch: string
  /** 是否有未提交更改 */
  hasChanges: boolean
  /** 最近一条 commit */
  lastCommit: string
  /** 远程仓库地址（可选） */
  remote?: string
}

/**
 * 收集系统上下文信息
 *
 * 从运行环境中提取日期、目录、Git 等信息
 */
export function collectSystemContext(cwd: string): SystemContext {
  const context: SystemContext = {
    currentDate: new Date().toISOString().split("T")[0],  // YYYY-MM-DD
    workingDirectory: cwd,
    platform: process.platform,
    shell: getShellType(),
  }

  // 尝试收集 Git 信息
  try {
    context.gitInfo = collectGitInfo(cwd)
  } catch {
    // 不在 Git 仓库中，跳过
  }

  // 尝试读取 CLAUDE.md
  const claudeMdPath = resolve(cwd, "CLAUDE.md")
  if (existsSync(claudeMdPath)) {
    try {
      context.claudeMdContent = readFileSync(claudeMdPath, "utf-8")
    } catch {
      // 读取失败，跳过
    }
  }

  return context
}

/** 检测当前 Shell 类型 */
function getShellType(): string {
  if (process.env.SHELL) return process.env.SHELL.split("/").pop() || "unknown"
  if (process.platform === "win32") return process.env.COMSPEC ? "cmd" : "powershell"
  return "bash"
}

/** 收集 Git 仓库信息 */
function collectGitInfo(cwd: string): GitInfo {
  const git = (cmd: string) => {
    try {
      return execSync(`git ${cmd}`, { cwd, encoding: "utf-8", timeout: 5000 }).trim()
    } catch {
      return ""
    }
  }

  const branch = git("rev-parse --abbrev-ref HEAD")
  const status = git("status --porcelain")
  const lastCommit = git("log -1 --oneline")
  const remote = git("remote get-url origin")

  return {
    branch,
    hasChanges: status.length > 0,
    lastCommit,
    remote: remote || undefined,
  }
}

// ============================================================
// 系统提示分段构建
// ============================================================

/**
 * 构建基础指令段
 *
 * 定义 AI 的角色、能力和行为约束
 */
function buildBasePrompt(): string {
  return `你是一个专业的 AI 编程助手，运行在终端环境中。

核心能力：
- 读取、搜索、创建和编辑文件
- 执行 Shell 命令
- 回答编程相关问题
- 分析和重构代码

行为准则：
1. 在执行修改操作前，先理解用户意图
2. 对于危险操作（如删除文件），先确认再执行
3. 使用中文回答问题，代码注释使用英文
4. 保持回答简洁，避免不必要的重复
5. 遇到不确定的内容，明确告知用户`
}

/**
 * 构建上下文信息段
 *
 * 注入当前日期、工作目录、Git 状态等环境信息
 */
function buildContextPrompt(context: SystemContext): string {
  const lines: string[] = []

  lines.push(`当前日期: ${context.currentDate}`)
  lines.push(`工作目录: ${context.workingDirectory}`)
  lines.push(`操作系统: ${context.platform}`)
  lines.push(`Shell: ${context.shell}`)

  if (context.gitInfo) {
    lines.push("")
    lines.push("Git 状态:")
    lines.push(`  分支: ${context.gitInfo.branch}`)
    lines.push(`  最近提交: ${context.gitInfo.lastCommit}`)
    if (context.gitInfo.hasChanges) {
      lines.push("  状态: 有未提交的更改")
    }
    if (context.gitInfo.remote) {
      lines.push(`  远程: ${context.gitInfo.remote}`)
    }
  }

  return lines.join("\n")
}

/**
 * 构建工具说明段
 *
 * 列出所有可用工具及其使用规则
 */
function buildToolDocsPrompt(tools: ToolDefinition[]): string {
  const lines: string[] = ["可用工具:"]

  for (const tool of tools) {
    const sourceTag = tool.source === "mcp" ? `[MCP:${tool.mcpServer}]` : "[内置]"
    lines.push("")
    lines.push(`  ${tool.name} ${sourceTag}`)
    lines.push(`    ${tool.description}`)
    const params = Object.entries(tool.inputSchema.properties)
    if (params.length > 0) {
      const paramStr = params.map(([k, v]) => {
        const desc = (v as { description?: string }).description || ""
        const required = tool.inputSchema.required?.includes(k) ? "(必填)" : "(可选)"
        return `${k}: ${desc} ${required}`
      }).join(", ")
      lines.push(`    参数: ${paramStr}`)
    }
  }

  lines.push("")
  lines.push("工具使用规则:")
  lines.push("  - 优先使用 Read 工具了解代码结构，再进行修改")
  lines.push("  - 使用 Bash 执行命令时，注意命令安全性")
  lines.push("  - 使用 Glob 搜索文件，使用 Grep 搜索内容")

  return lines.join("\n")
}

/**
 * 构建记忆段
 *
 * 注入 CLAUDE.md 中的项目级记忆
 */
function buildMemoryPrompt(claudeMdContent?: string): string {
  if (!claudeMdContent) return ""

  return `项目记忆 (来自 CLAUDE.md):\n${claudeMdContent}`
}

// ============================================================
// 主构建函数
// ============================================================

/**
 * 构建完整的系统提示
 *
 * 将所有分段按顺序拼接，用分隔符区分
 *
 * @param config - 运行配置
 * @param tools - 工具池中的所有工具
 * @returns 完整的系统提示字符串
 */
export function buildSystemPrompt(config: Config, tools: ToolDefinition[]): string {
  // 收集运行时上下文
  const context = collectSystemContext(config.cwd)

  // 分段构建
  const sections: string[] = []

  // 段 1：基础指令
  sections.push(buildBasePrompt())

  // 段 2：上下文信息
  sections.push(buildContextPrompt(context))

  // 段 3：工具说明
  sections.push(buildToolDocsPrompt(tools))

  // 段 4：项目记忆（CLAUDE.md）
  const memoryPrompt = buildMemoryPrompt(context.claudeMdContent)
  if (memoryPrompt) {
    sections.push(memoryPrompt)
  }

  // 拼接并返回
  return sections.join("\n\n---\n\n")
}

/**
 * 构建简短系统提示（用于子 Agent）
 *
 * 子 Agent 不需要完整提示，只需核心指令和工具说明
 */
export function buildMinimalPrompt(
  roleDescription: string,
  tools: ToolDefinition[]
): string {
  const toolNames = tools.map(t => t.name).join(", ")
  return `${roleDescription}\n\n可用工具: ${toolNames}`
}
