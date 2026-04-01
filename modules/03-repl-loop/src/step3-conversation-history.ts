// =============================================================================
// Step 3: 对话历史管理 — 维护、持久化与恢复
// =============================================================================
//
// 学习目标：
//   - 理解对话历史的完整消息类型
//   - 实现消息的规范化处理
//   - 使用 JSONL 格式持久化对话历史
//   - 实现会话恢复功能
//
// 运行方式：
//   npx tsx src/step3-conversation-history.ts
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// 1. 类型定义
// ---------------------------------------------------------------------------

// 统一的消息类型
// Claude API 有多种消息格式，这里定义我们自己的统一格式
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  timestamp: number; // 消息时间戳，用于记录和调试
}

// 内容块类型 — 支持文本和工具调用
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

// 会话元数据
interface SessionMetadata {
  id: string;            // 会话唯一 ID
  createdAt: number;     // 创建时间戳
  updatedAt: number;     // 最后更新时间戳
  messageCount: number;  // 消息数量
  totalTokens: number;   // 累计 token 数
}

// ---------------------------------------------------------------------------
// 2. ConversationHistory 类
// ---------------------------------------------------------------------------
// 封装对话历史的所有管理逻辑
// 包括：添加消息、查询历史、持久化、恢复
class ConversationHistory {
  private messages: ConversationMessage[] = [];
  private filePath: string;
  private metadata: SessionMetadata;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(filePath?: string) {
    // 默认保存到当前目录的 .conversation-history.jsonl
    this.filePath = filePath || path.join(process.cwd(), '.conversation-history.jsonl');

    // 初始化元数据
    this.metadata = {
      id: 'session_' + Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      totalTokens: 0,
    };
  }

  // -----------------------------------------------------------------------
  // 添加消息
  // -----------------------------------------------------------------------

  // 添加用户消息
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content: content,
      timestamp: Date.now(),
    });
    this.onMessageAdded();
  }

  // 添加助手纯文本消息
  addAssistantText(text: string): void {
    this.messages.push({
      role: 'assistant',
      content: text,
      timestamp: Date.now(),
    });
    this.onMessageAdded();
  }

  // 添加助手消息（包含工具调用）
  addAssistantMessage(content: ContentBlock[]): void {
    this.messages.push({
      role: 'assistant',
      content: content,
      timestamp: Date.now(),
    });
    this.onMessageAdded();
  }

  // 添加工具结果消息（role 仍然是 user）
  addToolResult(results: ContentBlock[]): void {
    this.messages.push({
      role: 'user',
      content: results,
      timestamp: Date.now(),
    });
    this.onMessageAdded();
  }

  // 消息添加后的处理
  private onMessageAdded(): void {
    this.metadata.messageCount = this.messages.length;
    this.metadata.updatedAt = Date.now();

    // 防抖保存 — 不是每次添加消息都立即写文件
    // 而是等 500ms 没有新消息后再保存
    this.debouncedSave();
  }

  // -----------------------------------------------------------------------
  // 查询消息
  // -----------------------------------------------------------------------

  // 获取所有消息
  getMessages(): ConversationMessage[] {
    return [...this.messages]; // 返回副本，防止外部直接修改
  }

  // 获取消息数量
  getMessageCount(): number {
    return this.messages.length;
  }

  // 转换为 Anthropic API 格式的消息数组
  // 这是最重要的方法 — 它把我们内部的格式转换为 API 需要的格式
  toApiMessages(): Anthropic.MessageParam[] {
    return this.messages.map((msg) => ({
      role: msg.role,
      content: this.convertContentToApi(msg.content),
    }));
  }

  // 将内容转换为 API 格式
  private convertContentToApi(
    content: string | ContentBlock[]
  ): string | Anthropic.ContentBlockParam[] {
    if (typeof content === 'string') {
      return content;
    }

    // 将 ContentBlock[] 转换为 Anthropic.ContentBlockParam[]
    return content.map((block) => {
      switch (block.type) {
        case 'text':
          return { type: 'text' as const, text: block.text };
        case 'tool_use':
          return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input,
          };
        case 'tool_result':
          return {
            type: 'tool_result' as const,
            tool_use_id: block.tool_use_id,
            content: block.content,
            ...(block.is_error ? { is_error: true } : {}),
          };
        default:
          return { type: 'text' as const, text: JSON.stringify(block) };
      }
    });
  }

  // -----------------------------------------------------------------------
  // 搜索消息
  // -----------------------------------------------------------------------

  // 在对话历史中搜索关键词
  search(keyword: string): ConversationMessage[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.messages.filter((msg) => {
      const text = this.extractText(msg);
      return text.toLowerCase().includes(lowerKeyword);
    });
  }

  // 从消息中提取纯文本（用于搜索和显示）
  private extractText(msg: ConversationMessage): string {
    if (typeof msg.content === 'string') {
      return msg.content;
    }
    return msg.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join(' ');
  }

  // -----------------------------------------------------------------------
  // 持久化 — JSONL 格式
  // -----------------------------------------------------------------------

  // JSONL (JSON Lines) 是一种每行一个 JSON 对象的格式
  // 优点：
  //   - 追加友好：不需要读取整个文件就能追加新行
  //   - 流式读取：可以逐行处理，内存友好
  //   - 容错：某行损坏不影响其他行

  // 保存到 JSONL 文件
  save(): void {
    const dir = path.dirname(this.filePath);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入数据
    const lines: string[] = [];

    // 第一行写元数据
    lines.push(JSON.stringify({ type: 'metadata', ...this.metadata }));

    // 后续每行一条消息
    for (const msg of this.messages) {
      lines.push(JSON.stringify(msg));
    }

    fs.writeFileSync(this.filePath, lines.join('\n') + '\n', 'utf-8');
  }

  // 防抖保存 — 避免频繁写文件
  private debouncedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.save();
      this.saveTimer = null;
    }, 500);
  }

  // 从 JSONL 文件加载
  load(): boolean {
    if (!fs.existsSync(this.filePath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const lines = content.trim().split('\n');

      this.messages = [];

      for (const line of lines) {
        if (!line.trim()) continue; // 跳过空行

        const parsed = JSON.parse(line);

        if (parsed.type === 'metadata') {
          // 恢复元数据
          this.metadata = {
            id: parsed.id,
            createdAt: parsed.createdAt,
            updatedAt: parsed.updatedAt,
            messageCount: parsed.messageCount,
            totalTokens: parsed.totalTokens || 0,
          };
        } else {
          // 恢复消息
          this.messages.push(parsed as ConversationMessage);
        }
      }

      console.log('已加载 ' + this.messages.length + ' 条历史消息');
      return true;
    } catch (error) {
      console.error('加载历史失败:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // 清空与统计
  // -----------------------------------------------------------------------

  // 清空历史
  clear(): void {
    this.messages = [];
    this.metadata.messageCount = 0;
    this.metadata.updatedAt = Date.now();
    this.save();
  }

  // 获取元数据
  getMetadata(): SessionMetadata {
    return { ...this.metadata };
  }

  // 更新 token 用量
  addTokenUsage(tokens: number): void {
    this.metadata.totalTokens += tokens;
    this.metadata.updatedAt = Date.now();
  }

  // 打印历史摘要
  printSummary(): void {
    console.log('\n=== 对话历史摘要 ===');
    console.log('会话 ID: ' + this.metadata.id);
    console.log('消息数量: ' + this.messages.length);
    console.log('创建时间: ' + new Date(this.metadata.createdAt).toLocaleString('zh-CN'));
    console.log('最后更新: ' + new Date(this.metadata.updatedAt).toLocaleString('zh-CN'));
    console.log('累计 Token: ' + this.metadata.totalTokens);
    console.log('保存路径: ' + this.filePath);
    console.log('==================\n');
  }
}

// ---------------------------------------------------------------------------
// 3. 简单的 LLM 调用（复用之前的逻辑）
// ---------------------------------------------------------------------------
const client = new Anthropic();

async function callLLM(
  messages: Anthropic.MessageParam[]
): Promise<Anthropic.Message> {
  return await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: messages,
  });
}

// ---------------------------------------------------------------------------
// 4. REPL 主循环
// ---------------------------------------------------------------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function startREPL() {
  console.log('=== 带历史管理的 AI REPL ===');
  console.log('命令:');
  console.log('  /exit   — 退出');
  console.log('  /clear  — 清空历史');
  console.log('  /search <关键词> — 搜索历史');
  console.log('  /history — 查看历史摘要');
  console.log('  /save   — 手动保存');
  console.log('  /load   — 加载上次会话\n');

  // 创建历史管理器
  const history = new ConversationHistory();

  // 尝试加载上次的会话
  const loaded = history.load();
  if (loaded) {
    console.log('(已恢复上次会话)\n');
  }

  while (true) {
    const userInput = await askQuestion('你: ');

    // 处理斜杠命令
    if (userInput.startsWith('/')) {
      const parts = userInput.trim().split(' ');
      const command = parts[0];
      const args = parts.slice(1).join(' ');

      switch (command) {
        case '/exit':
          history.save(); // 退出前保存
          console.log('再见！对话已保存。');
          rl.close();
          return;

        case '/clear':
          history.clear();
          console.log('历史已清空\n');
          continue;

        case '/search':
          if (!args) {
            console.log('用法: /search <关键词>');
            continue;
          }
          const results = history.search(args);
          if (results.length === 0) {
            console.log('未找到包含 "' + args + '" 的消息\n');
          } else {
            console.log('找到 ' + results.length + ' 条匹配消息:');
            results.forEach((msg, i) => {
              const text = typeof msg.content === 'string'
                ? msg.content.substring(0, 80)
                : '(包含工具调用)';
              console.log('  ' + (i + 1) + '. [' + msg.role + '] ' + text + (text.length >= 80 ? '...' : ''));
            });
            console.log('');
          }
          continue;

        case '/history':
          history.printSummary();
          continue;

        case '/save':
          history.save();
          console.log('已保存\n');
          continue;

        case '/load':
          const success = history.load();
          if (!success) {
            console.log('没有找到历史文件\n');
          }
          continue;

        default:
          console.log('未知命令: ' + command + '\n');
          continue;
      }
    }

    // 忽略空输入
    if (userInput.trim() === '') continue;

    // 添加用户消息到历史
    history.addUserMessage(userInput);

    try {
      // 调用 LLM
      const apiMessages = history.toApiMessages();
      const response = await callLLM(apiMessages);

      // 提取文本回复
      const textBlock = response.content.find(
        (block) => block.type === 'text'
      ) as Anthropic.TextBlock | undefined;
      const responseText = textBlock?.text ?? '(无文本回复)';

      // 添加到历史
      history.addAssistantText(responseText);

      // 更新 token 用量
      history.addTokenUsage(
        response.usage.input_tokens + response.usage.output_tokens
      );

      console.log('AI: ' + responseText + '\n');
    } catch (error) {
      console.error('出错了:', error instanceof Error ? error.message : error);
    }
  }
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------
startREPL().catch((error) => {
  console.error('REPL 启动失败:', error);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * 定义统一的消息类型（ConversationMessage）
//   * 处理多种内容块（text、tool_use、tool_result）
//   * 使用 JSONL 格式持久化对话历史
//   * 实现防抖保存（debounce）优化磁盘写入
//   * 从文件恢复对话会话
//   * 在历史中搜索消息
//   * 将内部格式转换为 API 格式
//
// 关键设计：
//   * JSONL 而不是 JSON — 追加友好、流式处理
//   * 防抖保存 — 避免每次消息都写文件
//   * 格式转换层 — 内部格式和 API 格式分离
//
// 下一步：step4-query-engine.ts — 用 QueryEngine 类封装完整查询生命周期
// ---------------------------------------------------------------------------
