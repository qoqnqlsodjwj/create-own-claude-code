/**
 * 模块 7 - Step 2: 构建 MCP 服务器
 *
 * 本文件展示如何使用 @modelcontextprotocol/sdk 构建一个 MCP 服务器，包括：
 * - 创建 MCP 服务器实例
 * - 注册 list_tools / call_tool 处理器
 * - 使用 stdio 传输层
 * - 实现多个实用工具
 *
 * 运行方式：
 *   npx tsx modules/07-mcp-integration/src/step2-build-server.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

// ============================================================================
// 工具定义
// ============================================================================

/**
 * 工具定义列表
 *
 * 每个工具包含名称、描述和输入参数的 JSON Schema。
 * 这些信息会通过 tools/list 方法返回给客户端（LLM）。
 */
const toolDefinitions = [
  {
    name: "calculate",
    description: "执行 JavaScript 数学表达式并返回结果。支持 Math 对象的所有方法。",
    inputSchema: {
      type: "object" as const,
      properties: {
        expression: {
          type: "string",
          description: "要计算的数学表达式，如 '2 + 3 * 4' 或 'Math.sqrt(16)'"
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "json_format",
    description: "格式化 JSON 字符串，支持缩进设置和验证。",
    inputSchema: {
      type: "object" as const,
      properties: {
        json: {
          type: "string",
          description: "要格式化的 JSON 字符串"
        },
        indent: {
          type: "number",
          description: "缩进空格数，默认为 2"
        }
      },
      required: ["json"]
    }
  },
  {
    name: "string_reverse",
    description: "反转字符串。用于测试和简单字符串操作。",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "要反转的字符串"
        }
      },
      required: ["text"]
    }
  },
  {
    name: "base64_encode",
    description: "将字符串编码为 Base64 格式。",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "要编码的字符串"
        }
      },
      required: ["text"]
    }
  }
]

// ============================================================================
// 工具执行函数
// ============================================================================

/**
 * 安全执行数学表达式
 *
 * 使用 Function 构造器在受限作用域中执行表达式，
 * 避免直接使用 eval 带来的安全风险。
 */
function executeCalculate(expression: string): string {
  try {
    // 提供 Math 对象作为上下文，限制可用范围
    const safeContext = `
      "use strict";
      const { abs, ceil, floor, round, max, min, pow, sqrt, PI, E, log, sin, cos, tan, random } = Math;
      return (${expression});
    `
    const fn = new Function(safeContext)
    const result = fn()
    return String(result)
  } catch (error) {
    throw new Error(`表达式计算失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 格式化 JSON 字符串
 */
function executeJsonFormat(json: string, indent: number = 2): string {
  try {
    const parsed = JSON.parse(json)
    return JSON.stringify(parsed, null, indent)
  } catch (error) {
    throw new Error(`JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 反转字符串
 */
function executeStringReverse(text: string): string {
  return text.split("").reverse().join("")
}

/**
 * Base64 编码
 */
function executeBase64Encode(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64")
}

// ============================================================================
// 工具调用分发
// ============================================================================

/**
 * 工具调用分发器
 *
 * 根据工具名称分发到对应的执行函数。
 * 所有工具返回统一格式的结果。
 */
function dispatchToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "calculate":
      return executeCalculate(args.expression as string)

    case "json_format":
      return executeJsonFormat(args.json as string, (args.indent as number) || 2)

    case "string_reverse":
      return executeStringReverse(args.text as string)

    case "base64_encode":
      return executeBase64Encode(args.text as string)

    default:
      throw new Error(`未知工具: ${name}`)
  }
}

// ============================================================================
// 创建 MCP 服务器
// ============================================================================

/**
 * 创建并配置 MCP 服务器实例
 *
 * 服务器配置包括：
 * - 名称和版本号（用于客户端识别）
 * - 能力声明（告知客户端支持哪些功能）
 */
function createMcpServer(): Server {
  const server = new Server(
    // 服务器信息
    {
      name: "example-mcp-server",
      version: "1.0.0",
    },
    // 能力声明：声明支持工具功能
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // 注册 tools/list 处理器
  // 当客户端请求工具列表时，返回所有已注册的工具定义
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions }
  })

  // 注册 tools/call 处理器
  // 当客户端调用工具时，分发到对应的执行函数并返回结果
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      const result = dispatchToolCall(name, args || {})

      // MCP 工具返回格式：content 数组 + 可选的 isError 标志
      return {
        content: [
          {
            type: "text" as const,
            text: result,
          }
        ],
        isError: false,
      }
    } catch (error) {
      // 错误也要以标准格式返回
      return {
        content: [
          {
            type: "text" as const,
            text: `错误: ${error instanceof Error ? error.message : String(error)}`,
          }
        ],
        isError: true,
      }
    }
  })

  return server
}

// ============================================================================
// 启动服务器
// ============================================================================

/**
 * 主函数：启动 MCP 服务器
 *
 * 启动流程：
 * 1. 创建服务器实例
 * 2. 创建 stdio 传输层
 * 3. 将服务器连接到传输层
 * 4. 服务器开始通过 stdin/stdout 接收和处理消息
 */
async function main(): Promise<void> {
  // 注意：MCP 服务器的日志必须输出到 stderr
  // 因为 stdout 被用于 JSON-RPC 消息传输
  console.error("[MCP Server] 正在启动...")

  const server = createMcpServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)

  console.error("[MCP Server] 已启动，通过 stdio 监听消息")
  console.error("[MCP Server] 已注册工具:", toolDefinitions.map(t => t.name).join(", "))
}

// 运行服务器
main().catch((error) => {
  console.error("[MCP Server] 启动失败:", error)
  process.exit(1)
})
