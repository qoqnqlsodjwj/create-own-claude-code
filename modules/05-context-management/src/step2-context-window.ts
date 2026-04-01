// =============================================================================
// Step 2: 上下文窗口管理 — 消息存储、Token 监控与截断策略
// =============================================================================
//
// 学习目标：
//   - 设计消息类型与内容块结构
//   - 实现上下文窗口的 Token 监控
//   - 理解 findCompactBoundary() 压缩边界选择算法
//   - 实现 snipOldToolResults() 工具结果截断策略
//
// 运行方式：
//   npx tsx src/step2-context-window.ts
// =============================================================================

// ---------------------------------------------------------------------------
// 1. 类型定义
// ---------------------------------------------------------------------------
// 消息角色类型
type Role = 'user' | 'assistant';

// 内容块：支持文本、工具调用、工具结果
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

// 统一消息类型
interface Message {
  role: Role;
  content: ContentBlock[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// 2. Token 估算（简化版，复用 step1 的逻辑）
// ---------------------------------------------------------------------------
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    tokens += char.charCodeAt(0) < 128 ? 0.25 : 1.5;
  }
  return Math.ceil(tokens);
}

// 计算单条消息的 token 数
function countMessageTokens(msg: Message): number {
  let total = 4; // 每条消息的结构开销（role、timestamp 等）
  for (const block of msg.content) {
    switch (block.type) {
      case 'text':
        total += estimateTokens(block.text);
        break;
      case 'tool_use':
        total += estimateTokens(JSON.stringify(block.input));
        total += estimateTokens(block.name);
        break;
      case 'tool_result':
        total += estimateTokens(block.content);
        break;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// 3. ContextWindowManager 类
// ---------------------------------------------------------------------------
// 管理上下文窗口中的所有消息，监控 token 用量，提供截断策略
class ContextWindowManager {
  private messages: Message[] = [];
  private maxTokens: number;

  constructor(maxTokens: number = 171_000) {
    // 200K - 16K 输出预留 - 13K 缓冲 = 171K
    this.maxTokens = maxTokens;
  }

  // 添加一条消息
  addMessage(msg: Message): void {
    this.messages.push(msg);
  }

  // 获取所有消息的副本
  getMessages(): Message[] {
    return [...this.messages];
  }

  // 计算所有消息的总 token 数
  getTotalTokens(): number {
    return this.messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
  }

  // 是否超出预算
  isOverBudget(): boolean {
    return this.getTotalTokens() > this.maxTokens;
  }

  // -----------------------------------------------------------------------
  // findCompactBoundary() — 寻找压缩边界
  // -----------------------------------------------------------------------
  // 策略：从最新消息往前数，保留 keepRecent 条不压缩，
  //        在此之前的消息就是"可压缩区域"的边界。
  //        但要确保边界不会切断一对关联的 tool_use / tool_result。
  findCompactBoundary(keepRecent: number = 4): number {
    if (this.messages.length <= keepRecent) {
      return 0; // 消息太少，全部保留
    }

    let boundary = this.messages.length - keepRecent;

    // 向前搜索，确保不在 tool_result 中间断开
    // tool_result 后面紧跟的 tool_use 应该一起保留
    while (boundary > 0) {
      const msg = this.messages[boundary];
      const isToolResult = msg.content.some(b => b.type === 'tool_result');
      if (isToolResult && boundary > 0) {
        boundary--; // 把 tool_result 也纳入压缩区域
      } else {
        break;
      }
    }

    return boundary;
  }

  // -----------------------------------------------------------------------
  // snipOldToolResults() — 截断旧的工具结果
  // -----------------------------------------------------------------------
  // 优先移除旧的工具结果，因为它们通常最大（如文件内容）且最不重要。
  // 策略：遍历消息，对工具结果内容做截断，保留前 maxChars 个字符。
  snipOldToolResults(maxChars: number = 500): number {
    let savedTokens = 0;

    for (const msg of this.messages) {
      for (let i = 0; i < msg.content.length; i++) {
        const block = msg.content[i];
        if (block.type === 'tool_result' && block.content.length > maxChars) {
          const original = estimateTokens(block.content);
          // 截断并添加省略提示
          block.content = block.content.substring(0, maxChars) + '\n...[已截断]';
          savedTokens += original - estimateTokens(block.content);
        }
      }
    }

    return savedTokens; // 返回节省的 token 数
  }

  // 打印当前状态摘要
  printSummary(): void {
    const total = this.getTotalTokens();
    console.log(`\n=== 上下文窗口状态 ===`);
    console.log(`消息数量 : ${this.messages.length}`);
    console.log(`Token 用量: ${total.toLocaleString()} / ${this.maxTokens.toLocaleString()}`);
    console.log(`使用率   : ${((total / this.maxTokens) * 100).toFixed(1)}%`);
    console.log(`超出预算 : ${this.isOverBudget() ? '是' : '否'}`);
    console.log('=====================\n');
  }
}

// ---------------------------------------------------------------------------
// 4. 演示
// ---------------------------------------------------------------------------
function demo() {
  console.log('=== 上下文窗口管理演示 ===\n');

  const manager = new ContextWindowManager();

  // 模拟一轮对话：用户提问 -> 助手调用工具 -> 返回结果 -> 助手回复
  const sampleMessages: Message[] = [
    {
      role: 'user', timestamp: Date.now(),
      content: [{ type: 'text', text: '请帮我读取 package.json 的内容' }],
    },
    {
      role: 'assistant', timestamp: Date.now(),
      content: [{ type: 'tool_use', id: 'tool_001', name: 'read_file', input: { path: 'package.json' } }],
    },
    {
      role: 'user', timestamp: Date.now(),
      content: [{ type: 'tool_result', tool_use_id: 'tool_001', content: '{\n  "name": "my-project",\n  "version": "1.0.0",\n'.repeat(20) + '}' }],
    },
    {
      role: 'assistant', timestamp: Date.now(),
      content: [{ type: 'text', text: '这是你的 package.json 内容，项目名称是 my-project...' }],
    },
    {
      role: 'user', timestamp: Date.now(),
      content: [{ type: 'text', text: '请再帮我看看 tsconfig.json' }],
    },
    {
      role: 'assistant', timestamp: Date.now(),
      content: [{ type: 'tool_use', id: 'tool_002', name: 'read_file', input: { path: 'tsconfig.json' } }],
    },
    {
      role: 'user', timestamp: Date.now(),
      content: [{ type: 'tool_result', tool_use_id: 'tool_002', content: '{\n  "compilerOptions": {\n'.repeat(30) + '}' }],
    },
  ];

  for (const msg of sampleMessages) {
    manager.addMessage(msg);
  }

  manager.printSummary();

  // 查找压缩边界
  const boundary = manager.findCompactBoundary(2);
  console.log(`压缩边界（保留最近 2 条）: 索引 ${boundary}`);
  console.log(`  前 ${boundary} 条消息将被压缩，后 ${sampleMessages.length - boundary} 条保持原样\n`);

  // 执行工具结果截断
  const saved = manager.snipOldToolResults(200);
  console.log(`截断工具结果后节省了 ~${saved} tokens`);

  manager.printSummary();
}

demo();

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * 定义消息类型与内容块结构
//   * 实现消息级别的 Token 计数
//   * findCompactBoundary() 选择压缩边界，避免切断关联消息
//   * snipOldToolResults() 优先截断最大的工具结果
//
// 关键设计：
//   * 工具结果通常最大且最不重要，是截断的首选目标
//   * 压缩边界需要尊重 tool_use / tool_result 的配对关系
//
// 下一步：step3-summarization.ts — LLM 摘要压缩
// ---------------------------------------------------------------------------
