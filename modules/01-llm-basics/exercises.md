# 模块 01 练习题

完成以下练习来巩固你在 LLM 基础模块中学到的知识。每个练习都基于对应的 step 文件，建议先读懂源码再动手。

---

## 练习 1：基础 API 调用（对应 step1）

### 1.1 个性化问候

修改 `step1-simple-call.ts`，实现以下功能：

- 让 LLM 根据你的名字生成一段个性化的问候语
- 将你的名字通过变量传入消息内容
- 打印完整的 token 使用量（输入 + 输出）

**提示：**

```typescript
const myName = '小明';
const messages = [
  { role: 'user' as const, content: `你好，我叫${myName}，请给我一段特别的问候。` },
];
```

### 1.2 系统提示词

在请求中添加 `system` 参数，观察它如何影响 LLM 的回复风格：

```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: '你是一个只说文言文的古代学者。',
  messages: [{ role: 'user', content: '介绍一下今天的学习计划' }],
});
```

**思考：** 改变 system prompt 的内容，回复会发生什么变化？system prompt 和 user message 有什么区别？

---

## 练习 2：流式输出（对应 step2）

### 2.1 流式打字机效果

基于 `step2-streaming.ts`，实现一个"打字机效果"：

- 每个 delta 到达后，添加 50 毫秒的延迟
- 在文本前显示时间戳

**参考代码：**

```typescript
stream.on('content_block_delta', async (event) => {
  if (event.delta.type === 'text_delta') {
    process.stdout.write(event.delta.text);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
});
```

### 2.2 流式 token 计数

在流式输出的过程中，实时统计已接收的 token 数量：

- 监听 `content_block_delta` 事件
- 累计接收的字符数
- 在 `message_stop` 时打印总字符数
- 与最终 `usage.output_tokens` 对比（注意：字符数和 token 数不同）

**思考：** 为什么字符数和 token 数不一样？中文字符和英文字母的 token 比例有什么差异？

---

## 练习 3：工具调用（对应 step3）

### 3.1 添加新工具

在 `step3-tool-calling.ts` 的基础上，添加一个新工具：

**要求：**
- 工具名称：`search`
- 功能：模拟搜索（返回硬编码的搜索结果）
- 参数：`query`（搜索关键词）
- 让 LLM 使用这个工具回答用户的问题

**参考实现：**

```typescript
{
  name: 'search',
  description: '搜索互联网获取信息',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
    },
    required: ['query'],
  },
}
```

### 3.2 并行工具调用

构造一个用户问题，让 LLM 同时调用多个工具。例如：

> "帮我查一下 package.json 的内容，同时列出 src 目录下有什么文件，再算一下 100 * 200 + 50。"

**观察：**
- LLM 会在一次响应中返回多个 `tool_use` 块吗？
- 多个工具结果是放在一条消息中还是分开的？
- 如果某个工具执行失败，其他工具的结果还能正常返回吗？

### 3.3 限制工具使用

研究 `tool_choice` 参数的作用：

```typescript
const response = await client.messages.create({
  // ...
  tool_choice: { type: 'auto' },    // 自动决定（默认）
  // tool_choice: { type: 'any' },    // 必须调用某个工具
  // tool_choice: { type: 'tool', name: 'calculate' }, // 必须调用指定工具
});
```

**实验：** 分别使用 `auto`、`any` 和指定工具名，观察 LLM 的行为差异。

---

## 练习 4：多轮对话（对应 step4）

### 4.1 扩展 ConversationManager

为 `ConversationManager` 类添加以下功能：

1. **上下文窗口管理** — 当消息历史超过指定 token 数时，自动截断最早的消息
2. **消息导出** — 将对话历史导出为 JSON 文件
3. **对话摘要** — 调用 LLM 对历史消息进行摘要，然后用摘要替代旧消息

**提示（上下文窗口管理）：**

```typescript
class ConversationManager {
  // ...

  /**
   * 截断消息历史，只保留最近的消息
   * @param maxMessages - 最多保留的消息条数
   */
  trimHistory(maxMessages: number): void {
    if (this.messages.length > maxMessages) {
      // 确保第一条消息是 user 消息（API 要求交替排列）
      this.messages = this.messages.slice(-maxMessages);
      if (this.messages[0].role !== 'user') {
        this.messages.shift();
      }
    }
  }
}
```

### 4.2 实现一个简易聊天机器人

基于 `step4-multi-turn.ts` 中的交互式对话功能，实现一个完整的聊天机器人：

**要求：**
- 支持多轮对话
- 支持至少 3 个工具（如查时间、计算、查天气）
- 用户输入 `quit` 退出
- 用户输入 `clear` 清空对话历史
- 每轮对话后显示 token 使用量

---

## 练习 5：错误处理（对应 step5）

### 5.1 自定义重试策略

当前的重试策略使用固定倍数（2 倍）的指数退避。请实现以下替代策略：

1. **线性退避** — 每次等待时间固定（如每次都是 2 秒）
2. **斐波那契退避** — 等待时间遵循斐波那契数列（1, 1, 2, 3, 5, 8...）
3. **自适应退避** — 如果是 429 错误，读取响应头中的 `retry-after` 并使用该值

**参考（斐波那契退避）：**

```typescript
function fibonacci(n: number): number {
  if (n <= 1) return 1;
  let a = 1, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

// 使用: delay = baseDelay * fibonacci(attempt)
```

### 5.2 断路器模式

实现一个简单的断路器（Circuit Breaker），防止在服务持续异常时反复发送无意义的请求：

**规则：**
- **关闭状态**（正常）：正常发送请求
- **打开状态**（熔断）：连续 N 次失败后，直接拒绝请求，不调用 API
- **半开状态**（探测）：等待一段时间后，允许一个请求通过，如果成功则关闭断路器

```typescript
class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime = 0;

  constructor(
    private maxFailures = 5,       // 连续失败多少次后熔断
    private resetTimeout = 60000,  // 熔断多久后尝试恢复（毫秒）
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('断路器已打开，请求被拒绝');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }
}
```

### 5.3 综合实战：健壮的 Agent

将本模块学到的所有知识整合，实现一个健壮的 Agent：

**要求：**
1. 支持多轮对话
2. 支持工具调用（至少 3 个工具）
3. 有完善的错误处理（重试、超时）
4. 有断路器保护
5. 记录每次 API 调用的耗时和 token 用量
6. 支持流式输出

**提示架构：**

```
Agent
 ├── ConversationManager   管理消息历史
 ├── ToolRegistry          管理工具注册和执行
 ├── RetryPolicy           重试策略
 ├── CircuitBreaker        断路器
 └── Logger                日志记录
```

---

## 挑战题

### 挑战 1：实现 Markdown 流式渲染

在流式输出的基础上，实现 Markdown 实时渲染：

- 当收到 `` ` `` 开始时，标记为代码块开始
- 当收到 `#` 时，标记为标题
- 在终端中使用颜色区分不同的 Markdown 元素

### 挑战 2：实现 Token 用量估算器

不调用 API，在本地估算一段文本大约会消耗多少 token：

- 使用简单的启发式规则（如英文约 1 token = 4 字符，中文约 1 token = 1.5 字）
- 支持估算消息数组（包括 system prompt、工具定义等）的总 token 数
- 与实际 API 返回的 `usage` 对比，计算误差

### 挑战 3：实现流式工具调用

结合流式输出和工具调用：

- 使用 `client.messages.stream()` 发送带工具的请求
- 在流式事件中识别 `tool_use` 块
- 流式地处理工具调用结果

---

## 学习检查清单

完成所有练习后，确认你理解了以下概念：

- [ ] LLM API 的请求-响应模型
- [ ] 消息格式（role、content、system prompt）
- [ ] 流式输出（SSE 事件类型）
- [ ] 工具定义（JSON Schema）
- [ ] tool_use / tool_result 消息流
- [ ] Agent 循环（while 循环 + 工具调用）
- [ ] 多轮对话的消息历史管理
- [ ] 指数退避重试策略
- [ ] 工具执行中的错误处理
- [ ] 超时、断路器等保护机制

如果你对以上所有概念都有清晰的理解，恭喜你，你已经为后续模块打下了坚实的基础！
