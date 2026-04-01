# 练习：REPL 交互循环

## 练习 1：添加 /save 和 /load 命令

### 目标

在 step5 的基础上实现对话的保存与加载功能。

### 要求

1. `/save [filename]` — 将当前对话历史保存到指定文件
   - 如果不指定文件名，自动生成一个基于时间戳的文件名
   - 保存格式为 JSON（包含元数据：创建时间、消息数量、token 用量）
   - 默认保存到 `.sessions/` 目录下

2. `/load [filename]` — 从文件加载对话历史
   - 加载后，后续的对话基于加载的历史继续
   - 显示加载的消息数量和时间信息
   - 如果文件不存在，给出友好的错误提示

### 提示

```typescript
// 保存格式参考
interface SessionFile {
  version: string;
  createdAt: string;
  messages: Message[];
  metadata: {
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
  };
}

// 你可以参考 step3 中的 JSONL 读写逻辑
// 不同之处在于这里用 JSON 格式，包含元数据
```

### 验证

- 保存一个包含 5 条以上消息的对话
- 退出程序
- 重新启动并加载该对话
- 继续对话，验证 LLM 能记住之前的上下文

---

## 练习 2：实现对话搜索

### 目标

实现一个 `/search` 命令，能在对话历史中搜索关键词。

### 要求

1. `/search <keyword>` — 搜索对话历史中包含关键词的消息
   - 显示匹配的消息及其序号
   - 高亮显示匹配的关键词
   - 搜索范围包括用户消息和助手回复

2. `/search --tool <name>` — 搜索调用了指定工具的消息
   - 例如 `/search --tool read_file` 查找所有读取文件的操作

3. `/search --after <n>` — 只搜索最近 n 条消息

### 提示

```typescript
function searchMessages(
  messages: Message[],
  keyword: string,
  options?: { toolName?: string; after?: number }
): SearchResult[] {
  // 1. 根据 options 过滤消息范围
  // 2. 遍历消息，在 content 中搜索 keyword
  // 3. 对于 assistant 消息，还要检查 tool_use 块
  // 4. 返回匹配结果，包含消息序号和上下文
}
```

### 验证

- 进行一次包含工具调用的对话
- 搜索用户消息中的关键词
- 搜索工具调用记录
- 验证 --after 参数能正确限制范围

---

## 练习 3：添加多行输入支持

### 目标

让 REPL 支持多行输入，而不是遇到换行就提交。

### 背景

当前的 REPL 使用 readline，用户按 Enter 就会提交。但在实际使用中，用户经常需要输入多行内容（比如粘贴代码片段、多段问题描述）。

### 要求

1. 实现"三引号"模式：输入 `"""` 开始多行模式，再输入 `"""` 结束

```
你: 请帮我分析这段代码 """
function hello() {
  console.log("hello");
}
"""
```

2. 实现反斜杠续行：行尾加 `\` 表示下一行是续行

```
你: 请帮我 \
重构这个 \
函数
```

3. 在多行输入模式下，提示符应该变化（如从 "你: " 变成 "... "）

### 提示

```typescript
async function readMultilineInput(rl: readline.Interface): Promise<string> {
  const lines: string[] = [];
  let inMultiline = false;

  while (true) {
    const prompt = inMultiline ? '... ' : '你: ';
    const line = await askQuestion(rl, prompt);

    if (!inMultiline && line.trimEnd() === '"""') {
      inMultiline = true;
      continue;
    }

    if (inMultiline && line.trimEnd() === '"""') {
      break; // 结束多行模式
    }

    if (!inMultiline && line.endsWith('\\')) {
      lines.push(line.slice(0, -1)); // 去掉反斜杠
      inMultiline = true;
      continue;
    }

    lines.push(line);

    if (!inMultiline) break; // 单行模式，直接结束
  }

  return lines.join('\n');
}
```

### 验证

- 使用单行模式正常对话
- 使用三引号模式输入多行代码
- 使用反斜杠续行输入
- 验证 Ctrl+C 能正确中断多行输入

---

## 练习 4：实现自动上下文压缩（Auto Compact）

### 目标

当对话历史超过一定长度时，自动压缩上下文以避免超出 Token 限制。

### 背景

Claude 的上下文窗口是有限的（例如 200K tokens）。在长时间对话中，历史消息会越来越长，最终可能超出限制。真实 Claude Code 通过"compact"功能解决这个问题。

### 要求

1. 在每次发送消息前，检查当前历史的 token 数量
   - 可以用简单的估算方法：中文 1 字约 1-2 tokens，英文 1 词约 1 token
   - 或者调用 Anthropic 的 token 计数 API

2. 当 token 数量超过阈值（如 100K）时，自动触发压缩
   - 用 LLM 总结之前的对话，生成一段摘要
   - 用摘要替换之前的历史消息
   - 保留最近 N 条消息不压缩

3. 添加 `/compact` 命令，让用户可以手动触发压缩

4. 压缩后显示信息：压缩了多少条消息、节省了多少 token

### 提示

```typescript
async function compactHistory(
  messages: Message[],
  keepRecent: number = 4
): Promise<Message[]> {
  // 1. 分离：要压缩的旧消息 + 保留的近期消息
  const toCompact = messages.slice(0, -keepRecent);
  const recent = messages.slice(-keepRecent);

  if (toCompact.length === 0) return messages;

  // 2. 用 LLM 生成摘要
  const summaryPrompt = '请用简洁的中文总结以下对话的关键信息，保留重要的上下文和结论：\n\n'
    + JSON.stringify(toCompact);

  const summary = await callLLM(summaryPrompt);

  // 3. 构造新的历史：摘要 + 近期消息
  const summaryMessage: Message = {
    role: 'user',
    content: '[上下文摘要] ' + summary,
  };

  const assistantAck: Message = {
    role: 'assistant',
    content: '我已了解之前的对话内容，会基于这些上下文继续工作。',
  };

  return [summaryMessage, assistantAck, ...recent];
}
```

### 验证

- 进行一次较长的对话（10+ 轮）
- 执行 `/compact`，观察压缩效果
- 继续对话，验证 LLM 仍然能理解之前的上下文
- 对比压缩前后的 token 数量

---

## 挑战练习：REPL 增强功能

如果你想进一步挑战自己，尝试实现以下功能：

### 挑战 1：Tab 自动补全

在用户输入工具名称、文件路径时，按 Tab 自动补全。

提示：使用 readline 的 `completer` 回调。

### 挑战 2：输入历史导航

用上下方向键浏览之前输入过的消息（类似 bash 的 history 功能）。

提示：readline 默认支持方向键历史，但你需要在每条消息之间正确管理历史栈。

### 挑战 3：管道输入

支持从管道接收输入：

```bash
cat error.log | npx tsx src/step5-full-repl.ts
# 自动将管道内容作为第一条消息发送
```

提示：检查 `process.stdin.isTTY` 判断是否为管道输入。
