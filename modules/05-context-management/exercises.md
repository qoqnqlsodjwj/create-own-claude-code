# 练习：上下文管理与压缩

## 练习 1：实现多级压缩策略

### 目标

在 step3 的基础上实现 Claude Code 的五级压缩体系。

### 要求

1. 定义 `CompressionLevel` 枚举，包含五个级别：
   - `SnipCompact`：裁剪旧的工具结果（step2 的 snipOldToolResults）
   - `MicroCompact`：增量编辑方式压缩相邻的工具调用/结果对
   - `ContextCollapse`：只读投影，完整历史保留但只显示摘要
   - `AutoCompact`：LLM 生成摘要替换历史消息（step3 的 compact）
   - `ReactiveCompact`：收到 413 错误后的紧急压缩

2. 实现 `CompressionController` 类，按级别依次尝试：
   ```
   SnipCompact → 检查预算 → 还超？
     → MicroCompact → 检查预算 → 还超？
       → AutoCompact → 检查预算 → 还超？
         → ReactiveCompact（强制截断）
   ```

3. 每个级别记录节省的 token 数量，输出压缩报告

### 提示

```typescript
enum CompressionLevel {
  Snip = 'snip',
  Micro = 'micro',
  Auto = 'auto',
  Reactive = 'reactive',
}

class CompressionController {
  async execute(budget: BudgetCheckResult, messages: Message[]): Promise<{
    messages: Message[];
    appliedLevels: CompressionLevel[];
    totalSaved: number;
  }> {
    // 按级别逐步执行，每执行完一个级别就检查预算
    // 如果预算通过，提前返回
  }
}
```

### 验证

- 创建一个模拟的长对话（超过 20 条消息，包含大量工具结果）
- 依次触发各级别压缩
- 验证每级压缩后 Token 数量确实减少
- 验证最少需要几级压缩才能满足预算

---

## 练习 2：实现 JSONL 会话持久化

### 目标

实现会话的完整持久化，支持跨会话恢复对话上下文。

### 要求

1. 定义 `SessionFile` 接口，包含：
   - 版本号（version）
   - 会话 ID（sessionId）
   - 创建时间与更新时间
   - 消息数组
   - 压缩历史记录（哪些消息被压缩过）

2. 实现 `SessionPersistence` 类：
   - `save(messages, filePath)` — 保存到 JSONL 文件（每行一条消息）
   - `load(filePath)` — 从 JSONL 文件恢复
   - `append(message, filePath)` — 追加单条消息（避免重写整个文件）
   - `getSessions(dir)` — 列出某个目录下所有会话文件

3. 在压缩后自动保存会话，记录压缩事件

### 提示

```typescript
// JSONL 格式：第一行是元数据，后续每行一条消息
// {"type":"meta","version":"1.0","sessionId":"sess_xxx","createdAt":"..."}
// {"type":"message","role":"user","content":"...","timestamp":1234567890}
// {"type":"compact","originalCount":10,"summary":"...","compactedAt":1234567890}

interface SessionMeta {
  version: string;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}
```

### 验证

- 创建一个包含 10 条消息的对话
- 保存到文件，退出程序
- 重新启动，加载会话
- 继续对话，验证 LLM 能理解恢复的上下文
- 执行压缩，验证压缩记录也被正确保存和恢复

---

## 练习 3：实现滑动窗口上下文管理

### 目标

实现一种不同于摘要压缩的上下文管理策略——滑动窗口。

### 背景

滑动窗口策略更简单：始终只保留最近 N 条消息。虽然会丢失更早的上下文，但实现简单且不需要 LLM 调用。

### 要求

1. 实现 `SlidingWindowManager` 类：
   - `maxMessages`：最大保留消息数（默认 20）
   - `addMessage()`：添加消息，超过上限时自动移除最旧的
   - `getWindow()`：返回当前窗口内的消息

2. 实现加权滑动窗口：
   - 系统消息（如压缩边界）永远不被移除
   - 工具调用和工具结果作为一个整体，不被拆开
   - 最近的 N 条消息权重更高

3. 对比滑动窗口与摘要压缩的 Token 节省效果

### 提示

```typescript
class SlidingWindowManager {
  private messages: Message[] = [];
  private maxSize: number;

  addMessage(msg: Message): Message | null {
    this.messages.push(msg);
    if (this.messages.length > this.maxSize) {
      // 移除最旧的非系统消息
      // 注意：不要拆开 tool_use / tool_result 对
      return this.removeOldest();
    }
    return null; // 没有被移除的消息
  }
}
```

### 验证

- 添加 30 条消息到滑动窗口（maxMessages = 20）
- 验证窗口中只有最近 20 条
- 验证 tool_use / tool_result 配对没有被拆开
- 对比同样场景下摘要压缩的 Token 节省量

---

## 练习 4：实现记忆的自动学习

### 目标

让 CLAUDE.md 记忆系统能够在对话过程中自动学习和更新。

### 要求

1. 在对话结束时，自动提取重要信息写入 CLAUDE.md：
   - 项目的技术栈信息（如"使用 React + TypeScript"）
   - 用户偏好的代码风格
   - 常用的构建/测试命令
   - 之前犯过的错误和修正方案

2. 实现 `MemoryLearner` 类：
   - `analyze(messages)` — 分析对话历史，提取可学习的信息
   - `shouldUpdate(existing, new)` — 判断新信息是否值得写入（避免重复）
   - `updateFile(filePath, additions)` — 安全更新 CLAUDE.md（不覆盖已有内容）

3. 在更新前显示预览，让用户确认

### 提示

```typescript
class MemoryLearner {
  // 从对话中提取可学习的模式
  extractLearnings(messages: Message[]): string[] {
    const learnings: string[] = [];
    // 搜索包含技术决策的消息
    // 搜索用户明确表达的偏好
    // 搜索错误修复记录
    return learnings;
  }

  // 将新学习内容合并到现有 CLAUDE.md
  mergeWithExisting(existing: string, newLearnings: string[]): string {
    // 在合适的章节下追加新内容
    // 避免重复
    // 保持 Markdown 格式整洁
  }
}
```

### 验证

- 进行一段关于项目配置的对话
- 触发记忆学习
- 检查 CLAUDE.md 是否正确更新
- 开始新对话，验证新会话能利用更新的记忆

---

## 挑战练习：实现完整的上下文生命周期管理器

### 目标

将本模块学到的所有组件整合为一个统一的上下文生命周期管理器。

### 要求

1. 实现 `ContextLifecycleManager` 类，整合：
   - TokenBudgetManager（预算管理）
   - ContextWindowManager（窗口监控）
   - ConversationSummarizer（摘要压缩）
   - MemoryManager（记忆系统）
   - SessionPersistence（会话持久化）

2. 提供统一的生命周期钩子：
   - `onBeforeRequest()` — 发送请求前：检查预算、必要时压缩
   - `onAfterResponse()` — 收到响应后：更新历史、检查 Token
   - `onError(413)` — 收到超出上下文错误：紧急压缩
   - `onSessionStart()` — 会话开始：加载记忆和上次会话
   - `onSessionEnd()` — 会话结束：学习记忆、保存会话

3. 输出完整的上下文管理日志

### 验证

- 模拟一个完整的长时间编程会话
- 验证压缩在正确的时机自动触发
- 验证会话能正确保存和恢复
- 验证记忆在学习后对新会话有正面影响
