# 模块 07: MCP 协议集成

## 学习目标

通过本模块，你将掌握以下核心知识：

1. **MCP 协议本质** — 理解 Model Context Protocol 的设计动机与核心架构
2. **JSON-RPC 2.0 基础** — 掌握 MCP 底层通信协议的消息格式
3. **三大原语** — 深入理解 Tools、Resources、Prompts 三种能力原语
4. **传输机制** — 理解 stdio 与 SSE 两种传输方式的适用场景
5. **构建 MCP 服务器** — 使用 @modelcontextprotocol/sdk 构建自定义服务器
6. **MCP 客户端开发** — 连接 MCP 服务器并集成到工具注册表
7. **Claude Code 集成** — 理解 Claude Code 如何通过 MCP 扩展能力

---

## 前置准备

### 本模块结构

```
07-mcp-integration/
├── README.md                       # 本文件：教程文档
├── exercises.md                    # 练习题
└── src/
    ├── step1-mcp-concepts.ts       # MCP 核心概念与 JSON-RPC 基础
    ├── step2-build-server.ts       # 构建 MCP 服务器
    ├── step3-mcp-client.ts         # MCP 客户端开发
    └── step4-dynamic-registration.ts # 动态注册与多服务器管理
```

### 安装依赖

```bash
npm install @modelcontextprotocol/sdk
```

---

## 第一步：什么是 MCP？

### MCP 的设计动机

在 AI 应用开发中，一个核心痛点是**能力扩展**。每个 AI 应用都需要：

- 让 LLM 调用外部工具（读文件、查数据库、调用 API）
- 向 LLM 提供上下文信息（代码库、文档、数据）
- 为 LLM 定制提示词模板

但每个应用都在重复实现这些集成，而且格式不统一。MCP（Model Context Protocol）的出现就是为了解决这个问题——它定义了一个**开放标准**，让 AI 应用和外部工具之间有一个统一的通信协议。

### 类比：USB 协议

```
没有 MCP 的世界：
  ┌──────────┐     专用接口     ┌──────────┐
  │ Claude   │ ────自定义─────→ │ 文件系统  │
  │ Code     │ ────自定义─────→ │ 数据库    │
  │          │ ────自定义─────→ │ GitHub   │
  └──────────┘                  └──────────┘

有了 MCP 的世界：
  ┌──────────┐     MCP 标准协议     ┌──────────┐
  │ Claude   │ ────MCP───────────→ │ 文件系统  │
  │ Code     │ ────MCP───────────→ │ 数据库    │
  │          │ ────MCP───────────→ │ GitHub   │
  └──────────┘                      └──────────┘
```

就像 USB 协议统一了设备接口一样，MCP 统一了 AI 应用与外部工具的接口。

---

## 第二步：MCP 客户端-服务器架构

### 核心架构

MCP 采用经典的**客户端-服务器**架构：

```
┌──────────────────────────────────────┐
│           AI 应用 (Claude Code)       │
│                                       │
│   ┌─────────────────────────────┐    │
│   │        MCP Client            │    │
│   │   - 发现工具                  │    │
│   │   - 调用工具                  │    │
│   │   - 读取资源                  │    │
│   └──────────┬──────────────────┘    │
└──────────────┼───────────────────────┘
               │  MCP 协议 (JSON-RPC 2.0)
               │
┌──────────────┼───────────────────────┐
│   ┌──────────┴──────────────────┐    │
│   │        MCP Server            │    │
│   │   - 注册工具                  │    │
│   │   - 提供资源                  │    │
│   │   - 定义提示词                │    │
│   └─────────────────────────────┘    │
│           外部能力提供者               │
└──────────────────────────────────────┘
```

### 关键概念

| 概念 | 说明 |
|------|------|
| Host | 运行 AI 应用的宿主环境（如 Claude Code） |
| Client | MCP 客户端，在 Host 内部，负责与 Server 通信 |
| Server | MCP 服务器，提供工具、资源、提示词等能力 |
| Transport | 传输层，负责 Client 和 Server 之间的消息传递 |

---

## 第三步：三大原语

MCP 定义了三种核心原语（Primitive），对应三种能力：

### 1. Tools（工具）

让 LLM 能够执行操作：

```
用户: "读取 package.json 文件"
  → LLM 决定调用 read_file 工具
  → MCP Client 发送 tools/call 请求
  → MCP Server 执行文件读取
  → 返回文件内容给 LLM
  → LLM 总结文件内容给用户
```

工具定义示例：

```json
{
  "name": "read_file",
  "description": "读取指定路径的文件内容",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "文件路径" }
    },
    "required": ["path"]
  }
}
```

### 2. Resources（资源）

向 LLM 提供结构化数据：

```
LLM: "我想了解项目结构"
  → MCP Client 发送 resources/list 请求
  → MCP Server 返回可用资源列表
  → MCP Client 发送 resources/read 请求
  → MCP Server 返回资源内容
  → LLM 基于资源内容回答问题
```

资源可以是文件、数据库记录、API 响应等任何数据。

### 3. Prompts（提示词）

预定义的提示词模板：

```json
{
  "name": "code_review",
  "description": "代码审查提示词模板",
  "arguments": [
    { "name": "code", "required": true },
    { "name": "language", "required": false }
  ]
}
```

---

## 第四步：传输类型

MCP 支持两种传输方式：

### stdio 传输

```
┌──────────┐    stdin/stdout    ┌──────────┐
│  Client   │ ←─────────────→ │  Server   │
│  (进程 A) │                   │  (进程 B) │
└──────────┘                   └──────────┘
```

- 客户端通过 `spawn` 启动服务器进程
- 通过 stdin/stdout 交换 JSON-RPC 消息
- stderr 用于服务器日志输出
- **适用场景**：本地工具、CLI 工具

### SSE 传输

```
┌──────────┐    HTTP POST      ┌──────────┐
│  Client   │ ─────────────→  │  Server   │
│          │ ←───────────── │  (远程)   │
│          │    SSE Events    │           │
└──────────┘                  └──────────┘
```

- 客户端通过 HTTP POST 发送请求
- 服务器通过 SSE（Server-Sent Events）返回响应
- **适用场景**：远程服务、Web 服务、多客户端共享

---

## 第五步：Claude Code 如何集成 MCP

### 配置方式

Claude Code 通过配置文件管理 MCP 服务器：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "xxx"
      }
    }
  }
}
```

### 集成流程

```
1. Claude Code 启动
2. 读取 MCP 配置
3. 为每个服务器启动子进程（stdio 传输）
4. 发送 initialize 请求，协商能力
5. 发送 tools/list，获取工具列表
6. 将 MCP 工具注册到内部工具注册表
7. LLM 调用工具时，通过 MCP Client 转发请求
8. MCP Server 执行并返回结果
```

### 名称空间与冲突处理

当多个 MCP 服务器提供同名工具时，Claude Code 使用前缀区分：

```
filesystem:read_file    → 服务器 "filesystem" 的 read_file
http-api:read_file      → 服务器 "http-api" 的 read_file
```

---

## 第六步：构建自己的 MCP 服务器

### 最简服务器

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new McpServer({ name: 'my-server', version: '1.0.0' })

server.tool('hello', { name: z.string() }, async ({ name }) => ({
  content: [{ type: 'text', text: `Hello, ${name}!` }]
}))

const transport = new StdioServerTransport()
await server.connect(transport)
```

### 服务器生命周期

```
创建 → 注册工具/资源/提示词 → 绑定传输 → 等待请求 → 关闭
```

---

## 关键概念总结

| 概念 | 说明 |
|------|------|
| MCP | Model Context Protocol，AI 应用与外部工具的统一通信协议 |
| JSON-RPC 2.0 | MCP 的底层消息协议，定义 request/response/notification |
| Tools | 让 LLM 执行操作的原语（如读文件、调用 API） |
| Resources | 向 LLM 提供结构化数据的原语（如文件内容、数据库记录） |
| Prompts | 预定义提示词模板的原语 |
| stdio 传输 | 通过标准输入输出通信，适用于本地进程 |
| SSE 传输 | 通过 HTTP + Server-Sent Events 通信，适用于远程服务 |
| MCP Server | 提供工具、资源、提示词的能力提供者 |
| MCP Client | 在 AI 应用内部，负责与 Server 通信的组件 |

---

## 下一步

完成本模块后，继续学习：

- **模块 08**: 完整项目集成
