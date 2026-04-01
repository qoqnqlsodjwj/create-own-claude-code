# 模块 5：上下文管理与压缩

> 如何在有限的 Token 窗口中管理无限长的对话

## 为什么上下文管理是核心难题？

LLM 有固定的上下文窗口（如 200K tokens）。但一个编程助手的对话可以非常长：
- 系统提示（~5K tokens）
- CLAUDE.md 记忆文件（~2K tokens）
- 50 轮对话历史（~100K+ tokens）
- 工具执行结果（文件内容可能非常大）

如果没有上下文管理，对话很快就会超出窗口限制。

## Claude Code 的五层压缩体系

```
Level 1: 裁剪压缩 (SnipCompact)
  └── 移除旧的/冗余的工具结果

Level 2: 微压缩 (MicroCompact)
  └── 增量编辑方式压缩工具结果对

Level 3: 上下文折叠 (Context Collapse)
  └── 只读投影，完整历史保留但只显示摘要

Level 4: 自动压缩 (AutoCompact)
  └── LLM 生成摘要替换历史消息

Level 5: 响应式压缩 (ReactiveCompact)
  └── 收到 413 错误后的紧急压缩
```

## 触发压缩的条件

```typescript
// 简化的压缩触发逻辑
function shouldCompact(tokenCount: number, contextWindow: number): boolean {
  const buffer = 13_000  // 保留 13K tokens 的缓冲
  return tokenCount > contextWindow - buffer
}
```

## Token 计数

Claude Code 使用 tiktoken 风格的计数：
- 英文约 4 字符 = 1 token
- 中文约 1.5 字符 = 1 token
- 代码约 3-4 字符 = 1 token
- 工具结果的 JSON 结构也消耗 token

## 本模块学习路径

| Step | 文件 | 学习内容 |
|------|------|---------|
| 1 | `step1-token-budget.ts` | Token 计数与预算管理 |
| 2 | `step2-context-window.ts` | 上下文窗口监控 |
| 3 | `step3-summarization.ts` | LLM 摘要压缩 |
| 4 | `step4-memory-system.ts` | CLAUDE.md 记忆系统 |
| 5 | `step5-session-persistence.ts` | JSONL 会话持久化 |

## 关键概念

### 压缩边界
压缩不是删除所有历史，而是选择一个"边界"：
- 边界前的消息被替换为摘要
- 边界后的消息保持原样
- 最近的消息（用户正在讨论的）永远不压缩

### 会话记忆
CLAUDE.md 文件是 Claude Code 的长期记忆：
- 项目根目录的 `CLAUDE.md`：项目级记忆
- `.claude/CLAUDE.md`：用户级记忆
- 每次对话开始时读取并注入系统提示
