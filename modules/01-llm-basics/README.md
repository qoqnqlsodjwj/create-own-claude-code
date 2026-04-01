# 模块 01: LLM 基础 — API 通信、流式输出与工具调用

## 学习目标

通过本模块，你将掌握以下核心知识：

1. **LLM API 通信** — 理解如何通过 HTTP 与大语言模型 API 交互
2. **基础 API 调用** — 使用 Node.js 调用 Claude / OpenAI API
3. **SSE 流式输出** — 理解 Server-Sent Events 流式传输原理
4. **工具调用协议** — 掌握 Function Calling / Tool Use 的工作方式
5. **Agent 循环** — 理解 Claude Code 等工具背后的核心循环模式

---

## 前置准备

### 安装依赖

```bash
npm install @anthropic-ai/sdk
```

### 配置 API Key

```bash
# 方式一：设置环境变量
export ANTHROPIC_API_KEY="your-api-key-here"

# 方式二：在代码中传入
# const client = new Anthropic({ apiKey: 'your-key' });
```

### TypeScript 运行

```bash
# 推荐使用 tsx 直接运行
npx tsx src/step1-simple-call.ts

# 或者先编译再运行
npx tsc src/step1-simple-call.ts && node src/step1-simple-call.js
```

---

## 第一步：理解 LLM API 通信

### 什么是 LLM API？

LLM API 本质上就是一个 **HTTP 请求-响应** 服务：

```
你的程序  ──── HTTP POST ────>  LLM API 服务器
   ^                                  |
   |                                  v
   └──── HTTP Response ─────── JSON 响应
```

核心流程：

1. **构造请求** — 将用户的输入（prompt）组装成 JSON 格式
2. **发送请求** — 通过 HTTP POST 发送到 API 端点
3. **接收响应** — 解析返回的 JSON，提取模型生成的文本

### 原始 HTTP 请求长什么样？

如果不用 SDK，直接用 `fetch` 调用 Claude API 是这样的：

```typescript
// 底层 HTTP 调用示例（仅供理解，实际开发请用 SDK）
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key',
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
  }),
});

const data = await response.json();
// data.content[0].text 就是模型的回复
```

SDK（如 `@anthropic-ai/sdk`）帮我们封装了这些底层细节，让调用更简洁。

### 消息格式

Claude API 使用 **消息数组** 来表示对话：

```typescript
const messages = [
  { role: 'user', content: '你好' },                          // 用户消息
  { role: 'assistant', content: '你好！有什么可以帮你的？' },    // 助手回复
  { role: 'user', content: '今天天气怎么样？' },                 // 用户追问
];
```

这种设计天然支持多轮对话 -- 每次请求都带上完整的对话历史。

---

## 第二步：SSE 流式输出（Streaming）

### 为什么需要流式输出？

普通调用（非流式）的问题：

```
用户提问 ────> 等待...等待...等待... ────> 一次性返回完整回复
                    （可能要等好几秒）
```

流式调用的体验：

```
用户提问 ────> "你" ──> "好" ──> "！" ──> "我" ──> "是" ──> ...
               （几乎立刻看到输出，像打字一样逐字出现）
```

### SSE（Server-Sent Events）是什么？

SSE 是一种服务器向客户端 **单向推送** 数据的 HTTP 技术：

```
客户端 ──── HTTP POST (stream: true) ────> 服务器
客户端 <──── event: message_start      ──── 服务器
客户端 <──── event: content_block_start ──── 服务器
客户端 <──── event: content_block_delta ──── 服务器  (一个 token)
客户端 <──── event: content_block_delta ──── 服务器  (又一个 token)
客户端 <──── event: content_block_stop  ──── 服务器
客户端 <──── event: message_stop        ──── 服务器
```

每个 `content_block_delta` 事件携带一小段文本（通常是一个词或几个字），客户端收到后立即显示，实现 "打字机" 效果。

### 关键事件类型

| 事件类型 | 含义 |
|---------|------|
| `message_start` | 消息开始，包含元信息（模型、用量等） |
| `content_block_start` | 一个内容块开始（文本块或工具调用块） |
| `content_block_delta` | 内容增量 -- 一小段文本或工具调用的部分数据 |
| `content_block_stop` | 当前内容块结束 |
| `message_delta` | 消息级别的更新（如 stop_reason） |
| `message_stop` | 整个消息结束 |

---

## 第三步：工具调用（Tool Calling / Function Calling）

### 什么是工具调用？

工具调用让 LLM 能够 **执行具体操作**，而不仅仅是生成文本。

```
用户: "北京今天天气怎么样？"
           |
           v
    LLM 判断: 我需要调用天气查询工具
           |
           v
    返回 tool_use 响应: { name: "get_weather", input: { city: "北京" } }
           |
           v
    你的程序执行 get_weather("北京")
           |
           v
    将结果发送回 LLM: tool_result: { temperature: 22, condition: "晴" }
           |
           v
    LLM 生成最终回复: "北京今天天气晴朗，气温 22 度。"
```

### 工具调用的消息流

```typescript
// 第一轮：用户提问 + 模型返回工具调用
[
  { role: 'user', content: '北京天气怎么样？' },
  { role: 'assistant', content: [
    { type: 'tool_use', id: 'tool_001', name: 'get_weather', input: { city: '北京' } }
  ]},
]

// 第二轮：加入工具执行结果，获取最终回复
[
  { role: 'user', content: '北京天气怎么样？' },
  { role: 'assistant', content: [
    { type: 'tool_use', id: 'tool_001', name: 'get_weather', input: { city: '北京' } }
  ]},
  { role: 'user', content: [
    { type: 'tool_result', tool_use_id: 'tool_001', content: '晴天，22°C' }
  ]},
  // 模型继续生成...
]
```

**重要理解**：`tool_result` 的 `role` 是 `user`！因为从 API 的角度看，是你的程序（相当于用户侧）在把工具执行结果发给模型。

### 工具定义格式

```typescript
const tools = [
  {
    name: 'get_weather',
    description: '获取指定城市的天气信息',
    input_schema: {
      type: 'object' as const,
      properties: {
        city: {
          type: 'string',
          description: '城市名称，如"北京"、"上海"',
        },
      },
      required: ['city'],
    },
  },
];
```

模型通过 `description` 理解工具的用途，通过 `input_schema` 知道需要什么参数。

---

## 第四步：多轮工具调用

实际场景中，模型可能：

1. **一次调用多个工具** -- 同时查询天气和新闻
2. **链式调用** -- 先查城市代码，再查天气
3. **多次迭代** -- 根据第一次结果决定是否继续调用

这要求我们实现一个 **循环**，不断检查模型是否还需要调用工具。

---

## 第五步：Agent 循环（核心模式）

### 什么是 Agent 循环？

这是 Claude Code、AutoGPT 等所有 Agent 系统的核心模式：

```
        +------------------------------+
        |     发送用户消息给 LLM         |
        +---------------+--------------+
                        |
                        v
              +----------------+
              |  LLM 返回响应   |<---------------+
              +-------+--------+                |
                      |                         |
                      v                         |
              +----------------+                |
              | 需要调用工具？   |                |
              +---+---------+--+                |
               是 |         | 否                |
                  v         v                   |
        +----------+   +----------+             |
        | 执行工具  |   | 返回文本  | -- 结束     |
        +-----+----+   +----------+             |
              |                                  |
              v                                  |
        +--------------+                        |
        | 将结果加到消息 | -----------------------+
        +--------------+
```

用伪代码表示：

```
messages = [用户消息]

while True:
    response = call_llm(messages)

    if 没有工具调用:
        返回 response  # 结束

    for tool_call in response.tool_calls:
        result = execute_tool(tool_call)
        messages.append(tool_result)

    # 继续循环，让 LLM 看到工具结果后决定下一步
```

**这就是 Claude Code 的核心！** Claude Code 本质上就是：

1. 用户输入 -> 构造消息
2. 调用 Claude API（带工具定义：读文件、写文件、执行命令...）
3. 如果 Claude 要用工具 -> 执行工具 -> 把结果返回给 Claude
4. 重复步骤 2-3，直到 Claude 不再需要工具
5. 展示最终结果给用户

---

## 代码文件说明

| 文件 | 内容 | 关键学习点 |
|------|------|-----------|
| `step1-simple-call.ts` | 最简单的 API 调用 | SDK 初始化、消息格式、响应解析 |
| `step2-streaming.ts` | 流式输出实现 | SSE 事件处理、增量文本拼接 |
| `step3-tool-calling.ts` | 工具调用实现 | 工具定义、tool_use/tool_result 消息流 |
| `step4-multi-turn.ts` | 多轮工具对话 | 消息历史管理、多工具处理 |
| `step5-agentic-loop.ts` | Agent 循环 | while 循环模式、自动工具执行 |

---

## 学习建议

1. **按顺序阅读代码** -- 每一步都建立在前一步的基础上
2. **动手运行** -- 修改代码，观察输出变化
3. **完成练习** -- 见 `exercises.md`
4. **理解核心** -- 重点理解 step5 的 Agent 循环，这是后续所有模块的基础
