# 模块 03: REPL 交互循环 — 构建你自己的 AI 对话终端

## 学习目标

通过本模块，你将掌握以下核心知识：

1. **REPL 模式** — 理解 Read-Eval-Print Loop 的设计理念与实现方式
2. **查询循环** — 掌握 Claude Code 背后的核心查询循环模式
3. **对话历史管理** — 学会维护、持久化与恢复多轮对话上下文
4. **成本追踪** — 理解 Token 计量与 API 成本估算的基本方法
5. **完整 REPL 系统** — 将上述所有概念整合为一个功能完备的交互式终端工具

---

## 前置准备

### 依赖安装

```bash
# 本模块依赖 Module 01 和 Module 02 中用到的 SDK
npm install @anthropic-ai/sdk readline
```

### 环境变量

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 运行方式

```bash
# 每一步都可以独立运行
npx tsx src/step1-basic-repl.ts
npx tsx src/step2-repl-with-tools.ts
npx tsx src/step3-conversation-history.ts
npx tsx src/step4-query-engine.ts
npx tsx src/step5-full-repl.ts
```

---

## 什么是 REPL？

### REPL 的概念

REPL 是 **Read-Eval-Print Loop** 的缩写，意为"读取-求值-打印-循环"。这是一种经典的交互式编程环境模式：

```
+---------------------------------------------+
|                                             |
|   Read  ---- 读取用户输入                     |
|     |                                       |
|     v                                       |
|   Eval  ---- 求值/执行                       |
|     |                                       |
|     v                                       |
|   Print ---- 打印结果                        |
|     |                                       |
|     v                                       |
|   Loop  ---- 回到 Read，等待下一次输入         |
|                                             |
+---------------------------------------------+
```

你可能已经很熟悉这些 REPL 工具：

- **Node.js** — 在终端输入 `node` 就进入了 Node.js REPL
- **Python** — 输入 `python` 或 `python3` 进入 Python REPL
- **irb** — Ruby 的交互式控制台
- **psql** — PostgreSQL 的交互式查询终端

### 为什么 AI 编程助手需要 REPL？

Claude Code、ChatGPT、Cursor Agent 等工具本质上都是一个增强版的 REPL：

```
普通 REPL:     Read -> Eval(代码) -> Print -> Loop
AI REPL:       Read -> Eval(LLM+工具) -> Print -> Loop
```

区别在于"Eval"环节：
- 普通 REPL 执行的是代码
- AI REPL 执行的是 LLM 推理 + 工具调用

这种模式的优势：
- **交互性强** — 用户可以即时看到结果并调整方向
- **上下文连续** — 每一轮都保留之前的对话历史
- **灵活组合** — LLM 可以根据上下文自主决定使用哪些工具
- **渐进修正** — 用户可以随时纠正 AI 的理解偏差

---

## Claude Code 的查询循环架构

### 真实架构参考

Claude Code 的核心是一个多层嵌套的循环结构：

```
+----------------------------------------------------------+
|                     外层：主 REPL 循环                     |
|   用户输入 -> 查询处理 -> 展示结果 -> 等待下次输入             |
|                                                          |
|   +------------------------------------------------+     |
|   |              内层：Agent 循环                    |     |
|   |   LLM 调用 -> 工具执行 -> 结果回传 -> 再次 LLM   |     |
|   |              (重复直到 LLM 不再调用工具)          |     |
|   |                                                |     |
|   |   +----------------------------+               |     |
|   |   |       工具执行管线          |               |     |
|   |   |   参数校验 -> 权限检查      |               |     |
|   |   |   -> 执行 -> 结果格式化     |               |     |
|   |   +----------------------------+               |     |
|   +------------------------------------------------+     |
+----------------------------------------------------------+
```

### 核心数据流

```
用户输入 "帮我重构 index.ts"
     |
     v
[1] 构造 user message，加入对话历史
     |
     v
[2] 调用 LLM API（带上 system prompt + 对话历史 + 工具定义）
     |
     v
[3] LLM 返回：读取 index.ts（tool_use: Read）
     |
     v
[4] 执行 Read 工具 -> 获取文件内容
     |
     v
[5] 将 tool_result 加入对话历史
     |
     v
[6] 再次调用 LLM（带上了工具执行结果）
     |
     v
[7] LLM 返回：写入新文件（tool_use: Write）
     |
     v
[8] 执行 Write 工具 -> 文件已更新
     |
     v
[9] 将 tool_result 加入对话历史
     |
     v
[10] 再次调用 LLM
     |
     v
[11] LLM 返回文本：已经帮你重构完成了...（无工具调用）
     |
     v
[12] 展示最终文本回复给用户
     |
     v
[13] 等待用户下次输入（回到步骤 [1]）
```

这个流程包含两层循环：
- **步骤 3-10**：内层 Agent 循环（工具执行循环）
- **步骤 1-13**：外层 REPL 循环（用户交互循环）

### Claude Code 中的实际组件映射

| 组件 | 职责 | 本模块对应 |
|------|------|-----------|
| `QueryEngine` | 管理单次查询的完整生命周期 | step4-query-engine.ts |
| `ConversationManager` | 维护对话历史与上下文 | step3-conversation-history.ts |
| `ToolExecutor` | 执行工具调用并返回结果 | step2-repl-with-tools.ts |
| `REPL` | 顶层循环，处理用户输入与输出 | step5-full-repl.ts |
| `CostTracker` | 追踪 Token 用量与成本 | step4-query-engine.ts |
| `StreamingHandler` | 处理流式输出 | step4-query-engine.ts |

---

## 第一步：最简单的 REPL

### 设计思路

最简 REPL 只需要四个部分：

```typescript
while (true) {
  const input = readInput();       // Read：读取用户输入
  if (input === '/exit') break;    // 退出检查
  const response = callLLM(input); // Eval：调用 LLM
  console.log(response);           // Print：打印结果
}                                  // Loop：回到 while
```

核心是用 Node.js 内置的 `readline` 模块来读取终端输入：

```typescript
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 逐行读取输入
rl.question('你: ', (input) => {
  console.log('收到:', input);
});
```

### 关键设计决策

1. **为什么用 readline？** — Node.js 内置模块，无需额外依赖，支持行编辑、历史导航
2. **为什么同步循环？** — 最简实现用 async/await 让代码看起来像同步的
3. **退出机制** — /exit 是最基础的命令，后续我们会扩展更多斜杠命令

---

## 第二步：带工具调用的 REPL

### 从简单到复杂

Step 1 的 REPL 只能聊天，不能做事。现在我们要把 Module 01 学到的 Agent 循环集成进来：

```
用户输入
  |
  v
调用 LLM（带上工具定义）
  |
  +-- LLM 返回纯文本 -> 直接展示 -> 等待下次输入
  |
  +-- LLM 返回工具调用 -> 执行工具 -> 把结果发回 LLM -> 重复
```

### 工具执行进度展示

在真实工具中，用户需要知道 AI 正在做什么：

```
你: 帮我看看 src/index.ts 有什么问题

正在思考...

调用工具: Read("src/index.ts")
   读取成功 (42 行)

正在分析...

调用工具: Grep("TODO", "src/")
   找到 3 处 TODO

AI: 我检查了你的文件，发现以下问题...
```

这种进度展示对于用户体验至关重要 — 用户不想面对一个毫无反馈的空白终端。

---

## 第三步：对话历史管理

### 为什么需要历史管理？

LLM API 是无状态的 — 每次调用都需要你把完整的对话历史传过去：

```
第一次请求：
  messages: [
    { role: 'user', content: '你好' },
  ]

第二次请求：
  messages: [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好！有什么可以帮你的？' },
    { role: 'user', content: '帮我写个函数' },
  ]
```

如果不维护历史，LLM 就不记得之前说过什么。

### 消息类型

Claude API 中有三种核心消息角色：

```typescript
// 1. 用户消息
{ role: 'user', content: '请帮我读一下 config.json' }

// 2. 助手消息（可能包含文本和工具调用）
{
  role: 'assistant',
  content: [
    { type: 'text', text: '好的，让我来读取这个文件。' },
    { type: 'tool_use', id: 'tool_001', name: 'read_file', input: { path: 'config.json' } }
  ]
}

// 3. 工具结果消息（role 仍然是 user）
{
  role: 'user',
  content: [
    { type: 'tool_result', tool_use_id: 'tool_001', content: '{"name": "my-app"}' }
  ]
}
```

### JSONL 持久化

为什么用 JSONL（JSON Lines）而不是 JSON？

```
JSON 格式：                      JSONL 格式：
[                                {"role":"user","content":"你好"}
  { "role": "user",             {"role":"assistant","content":"你好！"}
    "content": "你好" },        {"role":"user","content":"帮我写代码"
  },                             ...
  ...
]
```

- **追加友好** — JSONL 每行一条记录，追加时不需要读取整个文件
- **内存友好** — 可以逐行读取，不需要一次性加载整个数组
- **容错性好** — 某一行损坏不影响其他行
- **流式处理** — 天然支持流式读写

---

## 第四步：QueryEngine 类

### 设计理念

QueryEngine 封装了单次查询的完整生命周期，它的核心是一个 AsyncGenerator：

```typescript
async *submitMessage(userMessage: string): AsyncGenerator<QueryEvent> {
  // 产生各种事件，外部可以按需处理
  yield { type: 'thinking' };
  yield { type: 'text_delta', text: '你好' };
  yield { type: 'tool_call', name: 'read_file', input: {...} };
  yield { type: 'tool_result', content: '...' };
  yield { type: 'done', usage: {...} };
}
```

为什么用 AsyncGenerator？
- **流式输出** — 外部可以实时接收增量事件
- **解耦** — QueryEngine 不关心 UI 如何渲染，只负责产生事件
- **灵活** — 调用者可以选择监听哪些事件，忽略哪些

### Token 计量与成本估算

Claude API 的定价（以 claude-sonnet-4-20250514 为例）：

| 项目 | 价格 |
|------|------|
| 输入 Token | $3 / 1M tokens |
| 输出 Token | $15 / 1M tokens |

成本计算公式：

```typescript
const inputCost = (inputTokens / 1_000_000) * 3;
const outputCost = (outputTokens / 1_000_000) * 15;
const totalCost = inputCost + outputCost;
```

在 Agent 循环中，一次用户查询可能触发多次 LLM 调用（工具执行后再调用），每次都要累加 token 用量。

### 生命周期钩子

QueryEngine 提供了 beforeQuery 和 afterQuery 钩子：

```typescript
engine.onBeforeQuery(async (message) => {
  console.log('开始处理: ' + message);
});

engine.onAfterQuery(async (result) => {
  console.log('处理完成，消耗 $' + result.cost.toFixed(4));
});
```

这些钩子用于：
- 日志记录
- 成本统计
- 上下文压缩触发
- 用户通知

---

## 第五步：完整 REPL

### 斜杠命令系统

完整的 REPL 需要提供命令机制，让用户能执行特殊操作：

| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空对话历史 |
| `/compact` | 压缩上下文（减少 token 消耗） |
| `/exit` | 退出程序 |
| `/save` | 保存对话到文件 |
| `/load` | 从文件加载对话 |
| `/cost` | 显示当前会话的 token 用量和成本 |

命令解析很简单：

```typescript
if (input.startsWith('/')) {
  const [command, ...args] = input.slice(1).split(' ');
  handleCommand(command, args);
} else {
  // 当作普通消息发给 LLM
  await processQuery(input);
}
```

### 流式输出与打字效果

真实的终端 AI 工具都有"打字"效果，这通过流式 API 实现：

```typescript
// 流式输出的三种策略：

// 1. 即时输出（最简单）
process.stdout.write(delta.text);

// 2. 带延迟的打字效果（更酷但更慢）
await new Promise(r => setTimeout(r, 20));
process.stdout.write(delta.text);

// 3. 缓冲批量输出（推荐，兼顾体验和速度）
let buffer = '';
if (buffer.length > 10) {
  process.stdout.write(buffer);
  buffer = '';
}
```

### 错误处理策略

在 REPL 中，错误不应该让程序崩溃：

```typescript
try {
  await processQuery(input);
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    console.error('API 错误 (' + error.status + '): ' + error.message);
  } else {
    console.error('发生错误: ' + error);
  }
  // 不管什么错误，都回到循环继续等待输入
}
```

### 会话持久化

完整的 REPL 应该支持保存和恢复会话：

```
第一次运行:
  你: 帮我看看这个项目
  AI: (分析项目...)
  你: /save session.json
  对话已保存

第二次运行:
  你: /load session.json
  已加载 12 条历史消息
  你: 继续刚才的工作
  AI: (基于之前的上下文继续...)
```

---

## 代码文件说明

| 文件 | 内容 | 关键学习点 |
|------|------|-----------|
| `step1-basic-repl.ts` | 最简单的 REPL | readline、async 循环、基本输入输出 |
| `step2-repl-with-tools.ts` | 带工具调用的 REPL | Agent 循环集成、进度展示、工具执行反馈 |
| `step3-conversation-history.ts` | 对话历史管理 | 消息类型、JSONL 持久化、会话恢复 |
| `step4-query-engine.ts` | QueryEngine 类 | AsyncGenerator、生命周期管理、成本追踪、流式输出 |
| `step5-full-repl.ts` | 完整 REPL | 斜杠命令、打字效果、错误处理、会话持久化 |

---

## 学习建议

1. **从 step1 开始** — 先理解最基本的 REPL 循环，再逐步增加功能
2. **对比 Module 01** — step2 中的 Agent 循环就是 Module 01 step5 的内容，现在嵌入了 REPL 中
3. **动手修改** — 尝试添加自己的斜杠命令、修改输出样式
4. **完成练习** — exercises.md 中的练习将帮助你深化理解
5. **思考架构** — 注意从 step3 到 step4 的封装过程，理解为什么需要 QueryEngine

---

## 与真实 Claude Code 的对比

| 特性 | 本模块实现 | 真实 Claude Code |
|------|-----------|-----------------|
| 输入方式 | readline | ink + React 组件 |
| 输出渲染 | console.log / stdout.write | ink 自定义组件，支持 Markdown |
| 工具系统 | 简单函数映射 | 完整的 Tool Registry + 权限系统 |
| 上下文管理 | JSONL 文件 | 内存 + 自动压缩 |
| 错误处理 | try-catch + 打印 | 分级错误 + 用户确认 + 重试 |
| 成本追踪 | 累加 token 数 | 详细的使用统计面板 |

本模块是简化版，但核心模式和真实系统完全一致。理解了本模块的内容，你就能理解 Claude Code 的核心工作原理。

---

## 下一步

完成本模块后，你将进入 **Module 04: 终端 UI (Ink)**，学习如何用 React 构建美观的终端界面，替换掉本模块中的 console.log 输出。
