// =============================================================================
// Step 3: 摘要压缩 — LLM 生成摘要替换历史消息
// =============================================================================
//
// 学习目标：
//   - 理解压缩流程：选择边界 -> 生成摘要 -> 替换历史
//   - 实现压缩边界消息的格式
//   - 掌握降级策略：LLM 失败时用简单截断
//   - 对比压缩前后的 Token 节省效果
//
// 运行方式：
//   npx tsx src/step3-summarization.ts
// =============================================================================

// ---------------------------------------------------------------------------
// 1. 类型定义（复用 step2 的结构）
// ---------------------------------------------------------------------------
type Role = 'user' | 'assistant';

interface Message {
  role: Role;
  content: string; // 为简化演示，这里用纯字符串
  timestamp: number;
}

// 压缩结果的边界消息格式
// Claude Code 使用这种格式标记压缩区域
interface CompactBoundary {
  isCompactBoundary: true;       // 标记这是压缩边界消息
  originalCount: number;         // 压缩前有多少条消息
  originalTokens: number;        // 压缩前的 token 数
  summary: string;               // LLM 生成的摘要
  compactedAt: number;           // 压缩时间戳
}

// ---------------------------------------------------------------------------
// 2. Token 估算
// ---------------------------------------------------------------------------
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    tokens += char.charCodeAt(0) < 128 ? 0.25 : 1.5;
  }
  return Math.ceil(tokens);
}

// ---------------------------------------------------------------------------
// 3. ConversationSummarizer 类
// ---------------------------------------------------------------------------
// 使用 LLM 生成对话摘要，替换旧消息以节省 Token
class ConversationSummarizer {
  private messages: Message[] = [];

  constructor(messages: Message[]) {
    this.messages = [...messages];
  }

  // 计算 token 总量
  private totalTokens(): number {
    return this.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  }

  // -----------------------------------------------------------------------
  // compact() — 核心压缩方法
  // -----------------------------------------------------------------------
  // 流程：
  //   1. 选择压缩边界（保留最近 keepRecent 条）
  //   2. 将边界前的消息交给 LLM 生成摘要
  //   3. 用摘要替换旧消息
  //   4. 如果 LLM 失败，降级为简单截断
  async compact(keepRecent: number = 4): Promise<{
    messages: Message[];
    boundary: CompactBoundary | null;
    savedTokens: number;
    method: 'llm_summary' | 'truncation' | 'none';
  }> {
    if (this.messages.length <= keepRecent) {
      return { messages: this.messages, boundary: null, savedTokens: 0, method: 'none' };
    }

    const beforeTokens = this.totalTokens();
    const boundaryIndex = this.messages.length - keepRecent;
    const oldMessages = this.messages.slice(0, boundaryIndex);
    const recentMessages = this.messages.slice(boundaryIndex);
    const oldTokens = oldMessages.reduce((s, m) => s + estimateTokens(m.content), 0);

    // 尝试用 LLM 生成摘要
    let summary: string;
    let method: 'llm_summary' | 'truncation';

    try {
      summary = await this.generateSummary(oldMessages);
      method = 'llm_summary';
    } catch {
      // 降级策略：LLM 调用失败时，用简单截断
      summary = this.fallbackTruncate(oldMessages);
      method = 'truncation';
    }

    // 构建压缩边界消息
    const boundary: CompactBoundary = {
      isCompactBoundary: true,
      originalCount: oldMessages.length,
      originalTokens: oldTokens,
      summary,
      compactedAt: Date.now(),
    };

    // 组合新历史：用户摘要 + 助手确认 + 近期消息
    const compactedMessages: Message[] = [
      {
        role: 'user',
        content: `[自动压缩] 以下是之前 ${oldMessages.length} 条对话的摘要：\n${summary}`,
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content: '我已了解之前的对话内容，会基于这些上下文继续工作。',
        timestamp: Date.now(),
      },
      ...recentMessages,
    ];

    const afterTokens = compactedMessages.reduce((s, m) => s + estimateTokens(m.content), 0);

    return {
      messages: compactedMessages,
      boundary,
      savedTokens: beforeTokens - afterTokens,
      method,
    };
  }

  // -----------------------------------------------------------------------
  // generateSummary() — 调用 LLM 生成摘要
  // -----------------------------------------------------------------------
  private async generateSummary(messages: Message[]): Promise<string> {
    // 在真实场景中，这里调用 Anthropic API
    // 这里用模拟摘要演示完整流程
    const conversationText = messages
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n');

    // 模拟 LLM 调用（实际项目中替换为 API 调用）
    if (process.env.ANTHROPIC_API_KEY) {
      // 真实调用路径（需要安装 @anthropic-ai/sdk）
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `请用简洁的中文总结以下对话的关键信息（保留重要结论和决策）:\n\n${conversationText}`,
        }],
      });
      return (response.content[0] as { type: 'text'; text: string }).text;
    }

    // 模拟摘要（无 API Key 时）
    return `对话涉及 ${messages.length} 条消息。` +
      `用户讨论了项目开发和代码审查相关话题。` +
      `主要操作包括文件读取、代码分析和重构建议。`;
  }

  // -----------------------------------------------------------------------
  // fallbackTruncate() — 降级策略
  // -----------------------------------------------------------------------
  // 当 LLM 不可用时，用简单截断保留每条消息的前 N 个字符
  private fallbackTruncate(messages: Message[], maxChars: number = 100): string {
    return messages
      .map(m => {
        const prefix = m.role === 'user' ? '用户' : '助手';
        const content = m.content.length > maxChars
          ? m.content.substring(0, maxChars) + '...'
          : m.content;
        return `${prefix}: ${content}`;
      })
      .join('\n');
  }
}

// ---------------------------------------------------------------------------
// 4. 演示
// ---------------------------------------------------------------------------
async function demo() {
  console.log('=== 摘要压缩演示 ===\n');

  // 模拟一段较长的对话历史
  const messages: Message[] = [
    { role: 'user', content: '请帮我分析一下这个项目的结构', timestamp: Date.now() },
    { role: 'assistant', content: '好的，让我先看看项目的目录结构...', timestamp: Date.now() },
    { role: 'user', content: '找到了 src 目录，里面有 index.ts、utils.ts 和 types.ts 三个文件', timestamp: Date.now() },
    { role: 'assistant', content: '根据目录结构来看，这是一个 TypeScript 项目。index.ts 是入口文件...', timestamp: Date.now() },
    { role: 'user', content: '帮我看看 index.ts 里面有什么问题吗？', timestamp: Date.now() },
    { role: 'assistant', content: 'index.ts 中有一个未处理的 Promise 异步错误，建议添加 try-catch 包裹', timestamp: Date.now() },
    { role: 'user', content: '好的，请帮我修复它', timestamp: Date.now() },
    { role: 'assistant', content: '已经修复完成。现在所有异步操作都有错误处理了。', timestamp: Date.now() },
    // 近期消息（不应被压缩）
    { role: 'user', content: '现在请帮我写一个单元测试', timestamp: Date.now() },
    { role: 'assistant', content: '好的，我来为修复后的代码编写测试用例...', timestamp: Date.now() },
  ];

  console.log(`压缩前: ${messages.length} 条消息, ~${messages.reduce((s, m) => s + estimateTokens(m.content), 0)} tokens\n`);

  const summarizer = new ConversationSummarizer(messages);
  const result = await summarizer.compact(4);

  console.log(`压缩方法: ${result.method}`);
  console.log(`压缩后: ${result.messages.length} 条消息`);
  console.log(`节省: ~${result.savedTokens} tokens`);

  if (result.boundary) {
    console.log(`\n压缩边界信息:`);
    console.log(`  原始消息数: ${result.boundary.originalCount}`);
    console.log(`  原始 Token: ${result.boundary.originalTokens}`);
    console.log(`  摘要预览: ${result.boundary.summary.substring(0, 60)}...`);
  }

  console.log('\n压缩后的消息:');
  result.messages.forEach((m, i) => {
    console.log(`  ${i + 1}. [${m.role}] ${m.content.substring(0, 50)}${m.content.length > 50 ? '...' : ''}`);
  });
}

demo().catch(console.error);

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * 完整的压缩流程：边界选择 -> 摘要生成 -> 历史替换
//   * CompactBoundary 格式标记压缩区域
//   * 降级策略：LLM 失败时用简单截断替代
//   * 压缩效果：显著减少 Token 数量，保留关键上下文
//
// 关键设计：
//   * 压缩不是删除，是用摘要替换，保留语义信息
//   * 降级策略保证系统在 LLM 不可用时仍能工作
//
// 下一步：step4-memory-system.ts — CLAUDE.md 记忆系统
// ---------------------------------------------------------------------------
