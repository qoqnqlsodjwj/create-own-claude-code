/**
 * 模块 7 - Step 3: MCP 客户端
 *
 * 本文件展示如何构建 MCP 客户端，包括：
 * - 通过 stdio 连接 MCP 服务器子进程
 * - 发现服务器提供的工具（tools/list）
 * - 调用远程工具（tools/call）
 * - 将 MCP 工具集成到本地工具注册表
 *
 * 运行方式：
 *   npx tsx modules/07-mcp-integration/src/step3-mcp-client.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { spawn, ChildProcess } from "child_process"

// ============================================================================
// 类型定义
// ============================================================================

/**
 * MCP 工具的本地表示
 *
 * 从 MCP 服务器发现的工具，转换为本地可调用的格式。
 * 这样可以无缝集成到已有的工具注册表中。
 */
interface DiscoveredMcpTool {
  serverName: string                  // 所属服务器名称
  name: string                        // 工具名称
  description: string                 // 工具描述
  inputSchema: Record<string, unknown> // 输入参数 Schema
}

/**
 * MCP 客户端配置
 *
 * 定义如何连接到一个 MCP 服务器。
 */
interface McpServerConfig {
  name: string                        // 服务器名称（用于标识和日志）
  command: string                     // 启动命令，如 "npx" 或 "node"
  args: string[]                      // 命令参数
  env?: Record<string, string>        // 环境变量
}

/**
 * MCP 连接状态
 */
type McpConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

// ============================================================================
// MCP 客户端管理器
// ============================================================================

/**
 * McpClientManager - 管理与单个 MCP 服务器的连接
 *
 * 职责：
 * 1. 启动 MCP 服务器子进程
 * 2. 建立 stdio 传输连接
 * 3. 执行初始化握手
 * 4. 发现并缓存工具列表
 * 5. 转发工具调用请求
 */
export class McpClientManager {
  private client: Client | null = null
  private transport: StdioClientTransport | null = null
  private serverProcess: ChildProcess | null = null
  private cachedTools: DiscoveredMcpTool[] = []

  public readonly config: McpServerConfig
  public status: McpConnectionStatus = "disconnected"

  constructor(config: McpServerConfig) {
    this.config = config
  }

  /**
   * 连接到 MCP 服务器
   *
   * 流程：
   * 1. 创建 MCP Client 实例
   * 2. 启动服务器子进程（通过 stdio 传输）
   * 3. 发送 initialize 请求，协商能力
   * 4. 发现工具列表
   */
  async connect(): Promise<void> {
    this.status = "connecting"
    console.log(`[MCP Client ${this.config.name}] 正在连接...`)

    try {
      // 创建客户端实例
      this.client = new Client(
        { name: "mcp-client", version: "1.0.0" },
        { capabilities: {} }
      )

      // 创建 stdio 传输：通过子进程的 stdin/stdout 通信
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: { ...process.env, ...this.config.env } as Record<string, string>,
      })

      // 连接到服务器（自动完成 initialize 握手）
      await this.client.connect(this.transport)

      this.status = "connected"
      console.log(`[MCP Client ${this.config.name}] 已连接`)

      // 发现工具列表
      await this.discoverTools()
    } catch (error) {
      this.status = "error"
      console.error(`[MCP Client ${this.config.name}] 连接失败:`, error)
      throw error
    }
  }

  /**
   * 发现服务器提供的工具列表
   *
   * 调用 tools/list 方法，获取服务器上所有已注册的工具。
   * 将结果缓存到 cachedTools 中，供后续使用。
   */
  async discoverTools(): Promise<DiscoveredMcpTool[]> {
    if (!this.client) throw new Error("客户端未连接")

    const response = await this.client.request(
      { method: "tools/list", params: {} },
      { method: "tools/list" } as any
    )

    const result = response as any
    this.cachedTools = (result.tools || []).map((tool: any) => ({
      serverName: this.config.name,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }))

    console.log(`[MCP Client ${this.config.name}] 发现 ${this.cachedTools.length} 个工具:`,
      this.cachedTools.map(t => t.name).join(", "))

    return this.cachedTools
  }

  /**
   * 调用远程工具
   *
   * 向 MCP 服务器发送 tools/call 请求，并返回执行结果。
   *
   * @param toolName - 工具名称
   * @param args - 工具参数
   * @returns 工具执行结果的文本内容
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) throw new Error("客户端未连接")

    console.log(`[MCP Client ${this.config.name}] 调用工具: ${toolName}`)
    console.log(`  参数:`, JSON.stringify(args))

    const response = await this.client.request(
      {
        method: "tools/call",
        params: { name: toolName, arguments: args }
      },
      { method: "tools/call" } as any
    )

    const result = response as any
    // 提取文本内容
    const textContent = result.content
      ?.filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") || ""

    if (result.isError) {
      throw new Error(`工具调用失败: ${textContent}`)
    }

    return textContent
  }

  /**
   * 获取已缓存的工具列表
   */
  getTools(): DiscoveredMcpTool[] {
    return this.cachedTools
  }

  /**
   * 断开与 MCP 服务器的连接
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    this.transport = null
    this.serverProcess = null
    this.status = "disconnected"
    console.log(`[MCP Client ${this.config.name}] 已断开连接`)
  }
}

// ============================================================================
// 工具注册表集成
// ============================================================================

/**
 * 将 MCP 工具转换为本地工具格式
 *
 * 这个函数演示了如何将 MCP 发现的工具集成到
 * 已有的工具注册表中（参考模块 2 的 ToolRegistry）。
 *
 * 转换逻辑：
 * 1. 从 MCP 服务器获取工具定义
 * 2. 为每个工具创建本地代理
 * 3. 本地代理调用时通过 MCP 转发到远程服务器
 */
interface LocalTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
  execute: (input: unknown) => Promise<string>
}

function createLocalToolProxy(
  mcpTool: DiscoveredMcpTool,
  client: McpClientManager
): LocalTool {
  // 使用服务器名作为前缀，避免名称冲突
  const prefixedName = `${mcpTool.serverName}:${mcpTool.name}`

  return {
    name: prefixedName,
    description: mcpTool.description,
    input_schema: mcpTool.inputSchema,
    execute: async (input: unknown) => {
      const args = input as Record<string, unknown>
      return client.callTool(mcpTool.name, args)
    },
  }
}

// ============================================================================
// 演示代码
// ============================================================================

async function demo(): Promise<void> {
  console.log("模块 7 - Step 3: MCP 客户端演示\n")
  console.log("注意：此演示需要先启动 step2-build-server.ts 作为服务器。")
  console.log("实际使用中，客户端会自动通过 stdio 启动服务器子进程。\n")

  // 定义 MCP 服务器配置
  const serverConfig: McpServerConfig = {
    name: "example-server",
    command: "npx",
    args: ["tsx", "modules/07-mcp-integration/src/step2-build-server.ts"],
  }

  // 创建客户端管理器
  const manager = new McpClientManager(serverConfig)

  try {
    // 连接到 MCP 服务器（自动启动子进程）
    await manager.connect()

    // 获取发现的工具列表
    const tools = manager.getTools()
    console.log("\n" + "=".repeat(60))
    console.log("已发现的 MCP 工具:")
    console.log("-".repeat(60))
    for (const tool of tools) {
      console.log(`  - ${tool.name}: ${tool.description}`)
    }

    // 将 MCP 工具转换为本地工具代理
    const localTools = tools.map(t => createLocalToolProxy(t, manager))
    console.log("\n已转换为本地工具代理:")
    for (const tool of localTools) {
      console.log(`  - ${tool.name}`)
    }

    // 演示工具调用
    console.log("\n" + "=".repeat(60))
    console.log("工具调用演示:")
    console.log("-".repeat(60))

    // 调用 calculate 工具
    const calcResult = await manager.callTool("calculate", {
      expression: "Math.PI * 2"
    })
    console.log(`\ncalculate("Math.PI * 2") = ${calcResult}`)

    // 调用 json_format 工具
    const jsonResult = await manager.callTool("json_format", {
      json: '{"name":"mcp","version":"1.0.0"}'
    })
    console.log(`\njson_format 结果:\n${jsonResult}`)

    // 调用 base64_encode 工具
    const encoded = await manager.callTool("base64_encode", {
      text: "Hello, MCP!"
    })
    console.log(`\nbase64_encode("Hello, MCP!") = ${encoded}`)

  } catch (error) {
    console.error("演示失败:", error instanceof Error ? error.message : error)
    console.error("\n提示：请确保已安装 @modelcontextprotocol/sdk 依赖：")
    console.error("  npm install @modelcontextprotocol/sdk")
  } finally {
    // 清理：断开连接
    await manager.disconnect()
  }

  console.log("\n" + "=".repeat(60))
  console.log("演示完成！")
}

// 运行演示
demo().catch(console.error)
