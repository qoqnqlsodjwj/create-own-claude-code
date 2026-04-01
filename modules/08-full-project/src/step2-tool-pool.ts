/**
 * 模块 8 - Step 2: 工具池组装
 *
 * 本文件实现工具池的组装逻辑：
 * - ToolDefinition：统一的工具定义格式
 * - getBuiltinTools()：获取内置工具集合
 * - getMcpTools()：获取 MCP 远程工具集
 * - assembleToolPool()：合并、去重、排序
 * - 工具冲突解决策略
 *
 * 工具池是 Agent 能力的核心载体，决定 AI 能做什么。
 */

import { readFile, writeFile } from "fs/promises"
import { exec } from "child_process"
import { resolve, join } from "path"

// ============================================================
// 工具定义接口
// ============================================================

/** 工具来源类型 */
export type ToolSource = "builtin" | "mcp"

/**
 * 统一工具定义
 *
 * 无论工具来自内置还是 MCP，都使用相同的接口
 */
export interface ToolDefinition {
  /** 工具名称（全局唯一标识） */
  name: string
  /** 工具描述（给 LLM 看的说明文档） */
  description: string
  /** JSON Schema 格式的参数定义 */
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
  /** 工具来源：内置 or MCP */
  source: ToolSource
  /** MCP 服务器名称（仅 MCP 工具） */
  mcpServer?: string
  /** 工具执行函数 */
  execute: (input: unknown) => Promise<ToolResult>
}

/** 工具执行结果 */
export interface ToolResult {
  success: boolean
  output: string
  error?: string
}

// ============================================================
// 内置工具集
// ============================================================

/**
 * 获取所有内置工具
 *
 * 内置工具是核心功能，不依赖外部 MCP 服务器
 */
export function getBuiltinTools(): ToolDefinition[] {
  return [
    // 文件读取工具
    {
      name: "Read",
      description: "读取指定路径的文件内容。支持文本文件和图片。",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "文件绝对路径" },
          offset: { type: "number", description: "起始行号" },
          limit: { type: "number", description: "读取行数" },
        },
        required: ["file_path"],
      },
      source: "builtin" as ToolSource,
      async execute(input) {
        const { file_path, offset, limit } = input as {
          file_path: string; offset?: number; limit?: number
        }
        try {
          let content = await readFile(file_path, "utf-8")
          if (offset || limit) {
            const lines = content.split("\n")
            const start = (offset || 1) - 1
            const end = limit ? start + limit : lines.length
            content = lines.slice(start, end).join("\n")
          }
          return { success: true, output: content }
        } catch (e) {
          return { success: false, output: "", error: (e as Error).message }
        }
      },
    },

    // 文件写入工具
    {
      name: "Write",
      description: "将内容写入指定文件。如果文件已存在则覆盖。",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "文件绝对路径" },
          content: { type: "string", description: "要写入的内容" },
        },
        required: ["file_path", "content"],
      },
      source: "builtin" as ToolSource,
      async execute(input) {
        const { file_path, content } = input as {
          file_path: string; content: string
        }
        try {
          await writeFile(file_path, content, "utf-8")
          return { success: true, output: `已写入 ${file_path} (${Buffer.byteLength(content)} 字节)` }
        } catch (e) {
          return { success: false, output: "", error: (e as Error).message }
        }
      },
    },

    // Shell 命令执行工具
    {
      name: "Bash",
      description: "在 Shell 中执行命令。支持所有系统命令。",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "要执行的 Shell 命令" },
          timeout: { type: "number", description: "超时时间（毫秒）" },
        },
        required: ["command"],
      },
      source: "builtin" as ToolSource,
      async execute(input) {
        const { command, timeout = 30000 } = input as {
          command: string; timeout?: number
        }
        return new Promise((resolve) => {
          exec(command, { timeout, cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
              resolve({ success: false, output: stderr || error.message, error: String(error.code) })
            } else {
              resolve({ success: true, output: stdout + (stderr ? "\n" + stderr : "") })
            }
          })
        })
      },
    },

    // 文件搜索工具
    {
      name: "Glob",
      description: "使用 glob 模式搜索文件路径。",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob 匹配模式，如 **/*.ts" },
          path: { type: "string", description: "搜索根目录" },
        },
        required: ["pattern"],
      },
      source: "builtin" as ToolSource,
      async execute(input) {
        const { pattern, path: searchPath } = input as {
          pattern: string; path?: string
        }
        try {
          const { glob } = await import("glob")
          const files = await glob(pattern, { cwd: searchPath || process.cwd() })
          return { success: true, output: files.join("\n") || "未找到匹配文件" }
        } catch (e) {
          return { success: false, output: "", error: (e as Error).message }
        }
      },
    },
  ]
}

// ============================================================
// MCP 工具集
// ============================================================

/**
 * 获取 MCP 远程工具
 *
 * 通过 MCP 协议从外部服务器动态发现工具
 * 每个 MCP 服务器提供一组工具
 */
export async function getMcpTools(
  servers: Record<string, { command: string; args: string[]; enabled: boolean }>
): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = []

  for (const [serverName, config] of Object.entries(servers)) {
    if (!config.enabled) continue

    try {
      // 模拟 MCP 工具发现过程
      // 在实际项目中，这里会通过 stdio/SSE 连接 MCP 服务器
      const discoveredTools = await discoverMcpTools(serverName, config)
      tools.push(...discoveredTools)
    } catch (e) {
      console.warn(`MCP 服务器 ${serverName} 连接失败: ${(e as Error).message}`)
    }
  }

  return tools
}

/**
 * 模拟 MCP 工具发现
 *
 * 实际实现会通过 JSON-RPC 调用 tools/list 方法
 */
async function discoverMcpTools(
  serverName: string,
  _config: { command: string; args: string[] }
): Promise<ToolDefinition[]> {
  // 模拟不同 MCP 服务器提供的工具
  const mockTools: Record<string, ToolDefinition[]> = {
    filesystem: [
      {
        name: "read_file",
        description: "[MCP] 读取文件内容",
        inputSchema: {
          type: "object" as const,
          properties: { path: { type: "string" } },
          required: ["path"],
        },
        source: "mcp" as ToolSource,
        mcpServer: serverName,
        async execute(input) {
          const { path } = input as { path: string }
          try {
            return { success: true, output: await readFile(path, "utf-8") }
          } catch (e) {
            return { success: false, output: "", error: (e as Error).message }
          }
        },
      },
    ],
  }

  return mockTools[serverName] || []
}

// ============================================================
// 工具池组装
// ============================================================

/**
 * 组装工具池 — 合并、去重、排序
 *
 * 去重策略：同名工具保留内置版本（source=builtin）
 * 排序规则：内置工具按名称字母序，MCP 工具按服务器分组
 */
export function assembleToolPool(
  builtinTools: ToolDefinition[],
  mcpTools: ToolDefinition[] = []
): ToolDefinition[] {
  const toolMap = new Map<string, ToolDefinition>()

  // 先添加 MCP 工具（优先级低）
  for (const tool of mcpTools) {
    const key = tool.mcpServer ? `mcp__${tool.mcpServer}__${tool.name}` : tool.name
    toolMap.set(key, tool)
  }

  // 再添加内置工具（覆盖同名 MCP 工具）
  for (const tool of builtinTools) {
    toolMap.set(tool.name, tool)
  }

  // 排序：内置工具在前，MCP 工具在后
  const tools = Array.from(toolMap.values())
  tools.sort((a, b) => {
    if (a.source === b.source) return a.name.localeCompare(b.name)
    return a.source === "builtin" ? -1 : 1
  })

  return tools
}

/**
 * 获取工具池摘要（用于调试和日志）
 */
export function getToolPoolSummary(tools: ToolDefinition[]): string {
  const builtin = tools.filter(t => t.source === "builtin")
  const mcp = tools.filter(t => t.source === "mcp")
  const lines = [
    `工具池: 共 ${tools.length} 个工具`,
    `  内置工具: ${builtin.map(t => t.name).join(", ")}`,
    `  MCP 工具: ${mcp.length > 0 ? mcp.map(t => `${t.mcpServer}/${t.name}`).join(", ") : "无"}`,
  ]
  return lines.join("\n")
}
