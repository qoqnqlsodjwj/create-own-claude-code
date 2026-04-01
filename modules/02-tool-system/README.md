# 模块 02: 工具系统设计

## 学习目标

通过本模块，你将掌握以下核心知识：

1. **工具接口设计** — 理解 Claude Code 工具系统的核心抽象
2. **工具注册中心** — 实现可扩展的工具注册与管理机制
3. **工具执行管道** — 构建安全的工具执行流程
4. **内置工具实现** — 掌握文件、Shell、Web 等核心工具的实现模式
5. **权限控制** — 实现细粒度的操作权限检查

---

## 前置准备

### 安装依赖

```bash
npm install zod node-fetch
```

### 运行代码

```bash
npx tsx src/step1-tool-interface.ts
```

---

## 第一步：理解工具系统的设计哲学

### 为什么需要工具系统？

在没有工具系统之前，LLM 只能：
- 生成文本
- 提供建议
- 回答问题

但无法：
- 实际修改文件
- 执行代码
- 访问实时信息

工具系统让 LLM 拥有了"动手能力"，可以真正完成编程任务。

### Claude Code 工具系统的设计原则

核心架构：

1. LLM 返回 tool_use
2. 工具注册表管理所有可用工具
3. 权限检查管道确保操作安全
4. 工具执行器调用具体实现
5. 返回 ToolResult 给 LLM

### 核心设计原则

1. **接口一致性** — 所有工具遵循统一的 `Tool` 接口
2. **注册与执行分离** — 工具注册和执行逻辑解耦
3. **权限可控** — 每个工具执行前必须通过权限检查
4. **结果标准化** — 所有工具返回统一的 `ToolResult` 格式
5. **可扩展** — 新工具可以无缝接入系统

---

## 第二步：Tool 接口的设计

### 核心类型

```typescript
// 工具规范
interface ToolSpec {
  name: string
  description: string
  input_schema: object
}

// 工具上下文
interface ToolContext {
  allowedDirectories?: string[]
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions'
  isAutoMode?: boolean
}

// 工具执行结果
interface ToolResult {
  type: 'success' | 'error'
  content: string
  truncated?: boolean
  error?: string
}

// 核心工具接口
interface Tool {
  spec(): ToolSpec
  call(input: unknown, context: ToolContext): Promise<ToolResult>
}
```

---

## 第三步：工具注册表模式

### ToolRegistry 类

```typescript
class ToolRegistry {
  register(tool: Tool): void
  get(name: string): Tool | undefined
  list(): Tool[]
  has(name: string): boolean
  getToolSpecs(): ToolSpec[]
}
```

---

## 第四步：工具执行管道

### 执行管道步骤

1. 参数验证
2. 权限检查
3. 执行工具
4. 结果处理
5. 日志记录

---

## 第五步：权限检查集成

### 权限模式

- **default**: 默认模式，每次操作需要用户确认
- **acceptEdits**: 允许编辑，不允许危险操作
- **bypassPermissions**: 绕过权限检查（CI 模式）

### 权限规则

```typescript
interface PermissionRule {
  toolPattern?: string
  pathPattern?: string
  commandPattern?: string
  action: 'allow' | 'deny'
}
```

---

## 第六步：内置工具实现模式

### 文件操作工具

- **FileReadTool**: 读取文件内容
- **FileWriteTool**: 写入文件内容
- **FileEditTool**: 编辑文件内容
- **GlobTool**: glob 模式搜索

### Shell 工具

- **BashTool**: 执行 shell 命令
- 安全措施：危险命令拦截、超时控制、输出限制

### Web 工具

- **WebFetchTool**: 获取网页内容
- **WebSearchTool**: 网络搜索（DuckDuckGo API）

---

## 第七步：流式执行器

### StreamingToolExecutor

使用 AsyncGenerator 实现流式输出：

```typescript
async function* streamToolExecution(
  tools: ToolCall[],
  registry: ToolRegistry,
  context: ToolContext
): AsyncGenerator<ToolResultEvent>
```

---

## 代码文件说明

| 文件 | 内容 | 关键学习点 |
|------|------|-----------|
| `step1-tool-interface.ts` | 核心工具接口与注册表 | Tool 接口设计、ToolRegistry 实现 |
| `step2-file-tools.ts` | 文件操作工具集 | 文件读取、写入、编辑、glob 搜索 |
| `step3-shell-tool.ts` | Shell 工具实现 | Bash 执行、安全验证、超时控制 |
| `step4-web-tools.ts` | Web 工具实现 | HTTP 请求、搜索 API 集成 |
| `step5-permissions.ts` | 权限系统 | 权限模式、规则匹配、用户确认 |
| `step6-streaming-executor.ts` | 流式执行器 | AsyncGenerator、并行执行、SSE 集成 |

---

## 与真实 Claude Code 的对应关系

| 本模块概念 | Claude Code 对应实现 |
|-----------|---------------------|
| `Tool` 接口 | Tool 基类 (bash, edit, write, read, grep, glob 等) |
| `ToolRegistry` | 内部工具注册机制 |
| `input_schema` | 每个工具的 inputSchema 定义 |
| 权限检查 | 用户确认弹窗 |
| 执行管线 | Agent 循环中的 tool_use 处理 |
| 流式执行器 | SSE 流式响应集成 |

---

## 学习建议

1. **从接口开始** — 先理解 Tool 接口的设计理念
2. **动手实现** — 按照步骤自己实现一遍
3. **关注安全** — 特别注意权限检查和安全验证部分
4. **完成练习** — 见 exercises.md，巩固所学知识
5. **扩展思考** — 想想如何添加新工具（数据库、Git 等）

---

## 运行示例

```bash
# 安装依赖
npm install

# 运行各个步骤
npx tsx src/step1-tool-interface.ts
npx tsx src/step2-file-tools.ts
npx tsx src/step3-shell-tool.ts
npx tsx src/step4-web-tools.ts
npx tsx src/step5-permissions.ts
npx tsx src/step6-streaming-executor.ts
```

---

## 下一步

完成本模块后，你将进入 Module 03: REPL 交互循环，学习如何构建用户交互界面。
