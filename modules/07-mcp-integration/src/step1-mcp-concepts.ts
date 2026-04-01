/**
 * 模块 7 - Step 1: MCP 核心概念
 *
 * 本文件展示 MCP 协议的核心概念，包括：
 * - JSON-RPC 2.0 消息格式
 * - MCP 消息类型：request / response / notification
 * - 工具发现流程（initialize → tools/list → tools/call）
 * - 资源读取流程（resources/list → resources/read）
 *
 * 这些类型定义帮助你理解 MCP 的底层通信协议。
 */

// ============================================================================
// JSON-RPC 2.0 基础类型
// ============================================================================

/**
 * JSON-RPC 请求消息
 *
 * 客户端发送给服务器的请求，期望得到响应。
 * 关键字段：
 * - jsonrpc: 固定为 "2.0"，标识协议版本
 * - id: 请求标识，用于匹配响应
 * - method: 要调用的方法名
 * - params: 方法参数（可选）
 */
interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: number | string
  method: string
  params?: Record<string, unknown>
}

/**
 * JSON-RPC 成功响应
 *
 * 服务器处理请求后返回的结果。
 * id 必须与对应的请求 id 一致。
 */
interface JsonRpcResponse {
  jsonrpc: "2.0"
  id: number | string
  result: unknown
}

/**
 * JSON-RPC 错误响应
 *
 * 服务器处理请求失败时返回的错误信息。
 */
interface JsonRpcErrorResponse {
  jsonrpc: "2.0"
  id: number | string
  error: {
    code: number          // 错误码，如 -32600 (无效请求)
    message: string       // 错误描述
    data?: unknown        // 附加错误信息
  }
}

/**
 * JSON-RPC 通知消息
 *
 * 单向消息，不期望得到响应。没有 id 字段。
 * 常用于：进度通知、状态更新、日志输出
 */
interface JsonRpcNotification {
  jsonrpc: "2.0"
  method: string
  params?: Record<string, unknown>
}

// ============================================================================
// MCP 协议类型定义
// ============================================================================

/**
 * MCP 工具定义
 *
 * 描述一个 MCP 服务器提供的工具。
 * 与 Anthropic API 的工具格式类似，但增加了 annotations 字段。
 */
interface McpToolDefinition {
  name: string                           // 工具名称，如 "read_file"
  description: string                    // 工具描述，帮助 LLM 理解用途
  inputSchema: {                         // 输入参数的 JSON Schema
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
  annotations?: {                        // 工具元信息（可选）
    title?: string                       // 人类可读的标题
    readOnlyHint?: boolean               // 是否只读
    destructiveHint?: boolean            // 是否有破坏性
    idempotentHint?: boolean             // 是否幂等
  }
}

/**
 * MCP 工具调用结果
 *
 * 工具执行后返回的内容，支持多种类型。
 */
interface McpToolResult {
  content: Array<
    | { type: "text"; text: string }           // 文本内容
    | { type: "image"; data: string; mimeType: string }  // 图片内容
    | { type: "resource"; resource: unknown }   // 嵌入资源
  >
  isError?: boolean                      // 是否为错误结果
}

/**
 * MCP 资源定义
 *
 * 资源是 MCP 服务器暴露的可读数据。
 * 与工具不同，资源是被动提供的（由应用主动拉取）。
 */
interface McpResourceDefinition {
  uri: string                            // 资源 URI，如 "file:///path/to/file"
  name: string                           // 资源名称
  description?: string                   // 资源描述
  mimeType?: string                      // MIME 类型，如 "text/plain"
}

// ============================================================================
// MCP 通信流程模拟
// ============================================================================

/**
 * MCP 工具发现与调用流程
 *
 * 整个流程分为三个阶段：
 * 1. 初始化（initialize）— 协商双方能力
 * 2. 发现（tools/list）— 获取可用工具列表
 * 3. 调用（tools/call）— 执行具体工具
 */
function simulateToolDiscoveryFlow(): void {
  console.log("=".repeat(60))
  console.log("MCP 工具发现与调用流程")
  console.log("=".repeat(60))

  // 阶段 1：初始化
  const initRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},        // 客户端声明自己支持的能力
      clientInfo: { name: "my-client", version: "1.0.0" }
    }
  }
  console.log("\n[客户端 → 服务器] 初始化请求:")
  console.log(JSON.stringify(initRequest, null, 2))

  const initResponse: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: true } },   // 服务器声明支持工具
      serverInfo: { name: "my-server", version: "1.0.0" }
    }
  }
  console.log("\n[服务器 → 客户端] 初始化响应:")
  console.log(JSON.stringify(initResponse, null, 2))

  // 阶段 2：工具发现
  const listToolsRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
  }
  console.log("\n[客户端 → 服务器] 列出工具请求:")
  console.log(JSON.stringify(listToolsRequest, null, 2))

  const listToolsResponse: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: 2,
    result: {
      tools: [
        {
          name: "calculate",
          description: "执行数学表达式计算",
          inputSchema: {
            type: "object",
            properties: { expression: { type: "string" } },
            required: ["expression"]
          }
        },
        {
          name: "json_format",
          description: "格式化 JSON 字符串",
          inputSchema: {
            type: "object",
            properties: { json: { type: "string" } },
            required: ["json"]
          }
        }
      ] as McpToolDefinition[]
    }
  }
  console.log("\n[服务器 → 客户端] 工具列表响应:")
  console.log(JSON.stringify(listToolsResponse, null, 2))

  // 阶段 3：工具调用
  const callToolRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "calculate",
      arguments: { expression: "Math.PI * 2" }
    }
  }
  console.log("\n[客户端 → 服务器] 工具调用请求:")
  console.log(JSON.stringify(callToolRequest, null, 2))

  const callToolResponse: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: 3,
    result: {
      content: [{ type: "text", text: "6.283185307179586" }],
      isError: false
    } as McpToolResult
  }
  console.log("\n[服务器 → 客户端] 工具调用响应:")
  console.log(JSON.stringify(callToolResponse, null, 2))
}

/**
 * MCP 资源读取流程
 *
 * 资源读取分为两步：
 * 1. resources/list — 获取可用资源列表
 * 2. resources/read — 读取指定资源内容
 */
function simulateResourceReadFlow(): void {
  console.log("\n" + "=".repeat(60))
  console.log("MCP 资源读取流程")
  console.log("=".repeat(60))

  // 步骤 1：列出资源
  const listResourcesRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: 4,
    method: "resources/list"
  }
  console.log("\n[客户端 → 服务器] 列出资源请求:")
  console.log(JSON.stringify(listResourcesRequest, null, 2))

  const listResourcesResponse: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: 4,
    result: {
      resources: [
        {
          uri: "file:///project/package.json",
          name: "package.json",
          mimeType: "application/json"
        },
        {
          uri: "file:///project/README.md",
          name: "README.md",
          mimeType: "text/markdown"
        }
      ] as McpResourceDefinition[]
    }
  }
  console.log("\n[服务器 → 客户端] 资源列表响应:")
  console.log(JSON.stringify(listResourcesResponse, null, 2))

  // 步骤 2：读取资源
  const readResourceRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: 5,
    method: "resources/read",
    params: { uri: "file:///project/package.json" }
  }
  console.log("\n[客户端 → 服务器] 读取资源请求:")
  console.log(JSON.stringify(readResourceRequest, null, 2))

  const readResourceResponse: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: 5,
    result: {
      contents: [
        {
          uri: "file:///project/package.json",
          mimeType: "application/json",
          text: '{ "name": "my-project", "version": "1.0.0" }'
        }
      ]
    }
  }
  console.log("\n[服务器 → 客户端] 资源内容响应:")
  console.log(JSON.stringify(readResourceResponse, null, 2))
}

/**
 * JSON-RPC 消息解析器
 *
 * 将原始 JSON 字符串解析为具体的 JSON-RPC 消息类型。
 * 这是 MCP 客户端/服务器处理消息的基础。
 */
function parseJsonRpcMessage(raw: string): JsonRpcRequest | JsonRpcResponse | JsonRpcNotification {
  const msg = JSON.parse(raw) as Record<string, unknown>

  // 有 id 且有 method → 请求
  if ("id" in msg && "method" in msg) {
    return msg as unknown as JsonRpcRequest
  }
  // 有 id 且有 result 或 error → 响应
  if ("id" in msg && ("result" in msg || "error" in msg)) {
    return msg as unknown as JsonRpcResponse
  }
  // 有 method 但没有 id → 通知
  if ("method" in msg) {
    return msg as unknown as JsonRpcNotification
  }

  throw new Error("无法识别的 JSON-RPC 消息格式")
}

// ============================================================================
// 演示代码
// ============================================================================

async function demo(): Promise<void> {
  console.log("模块 7 - Step 1: MCP 核心概念\n")

  // 演示工具发现与调用流程
  simulateToolDiscoveryFlow()

  // 演示资源读取流程
  simulateResourceReadFlow()

  // 演示消息解析
  console.log("\n" + "=".repeat(60))
  console.log("JSON-RPC 消息解析演示")
  console.log("=".repeat(60))

  const rawRequest = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  const parsed = parseJsonRpcMessage(rawRequest)
  console.log("\n原始消息:", rawRequest)
  console.log("解析结果:", "id" in parsed && "method" in parsed ? "Request" : "Unknown")

  const rawNotification = '{"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":50}}'
  const parsedNotif = parseJsonRpcMessage(rawNotification)
  console.log("\n原始消息:", rawNotification)
  console.log("解析结果:", !("id" in parsedNotif) ? "Notification" : "Unknown")

  console.log("\n" + "=".repeat(60))
  console.log("演示完成！")
}

// 运行演示
demo().catch(console.error)
