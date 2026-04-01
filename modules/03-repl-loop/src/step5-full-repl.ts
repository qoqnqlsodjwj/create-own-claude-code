// =============================================================================
// Step 5: 完整 REPL — 斜杠命令、流式输出、工具展示、错误处理、会话持久化
// =============================================================================
//
// 学习目标：
//   - 实现完整的斜杠命令系统
//   - 流式输出与打字效果
//   - 工具执行的可视化展示
//   - 分级错误处理与恢复
//   - 会话持久化与恢复
//   - Token/成本实时显示
//
// 运行方式：
//   npx tsx src/step5-full-repl.ts
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// =========================================================================
// 类型定义
// =========================================================================

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  timestamp: number;
}

interface Tool {
  name: string;
  description: string;
  schema: Anthropic.Tool.InputSchema;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

interface REPLConfig {
  model?: string;
  maxTokens?: number;
  historyFile?: string;
  // 流式输出时每个字符的延迟（毫秒），0 表示无延迟
  typingDelay?: number;
}

// =========================================================================
// CompleteREPL 类 — 完整的 REPL 实现
// =========================================================================

class CompleteREPL {
  private client: Anthropic;
  private rl: readline.Interface;
  private messages: Message[] = [];
  private tools: Tool[] = [];

  // 配置
  private config: Required<REPLConfig>;

  // Token 和成本追踪
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private readonly INPUT_COST_PER_M = 3;   // $3 / 1M tokens
  private readonly OUTPUT_COST_PER_M = 15;  // $15 / 1M tokens

  // 运行状态
  private isRunning = false;
  private currentQueryAborted = false;

  constructor(config?: REPLConfig) {
    this.client = new Anthropic();

    this.config = {
      model: config?.model ?? 'claude-sonnet-4-20250514',
      maxTokens: config?.maxTokens ?? 2048,
      historyFile: config?.historyFile ?? path.join(process.cwd(), '.repl-session.json'),
      typingDelay: config?.typingDelay ?? 0,
    };

    // 创建 readline 接口
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 处理 Ctrl+C
    // 第一次 Ctrl+C 中断当前查询，第二次退出程序
    let ctrlCCount = 0;
    process.on('SIGINT', () => {
      if (this.currentQueryAborted === false && this.isRunning) {
        // 中断当前查询
        this.currentQueryAborted = true;
        console.log('\n\n(已中断当前回复)');
        ctrlCCount = 0;
      } else {
        ctrlCCount++;
        if (ctrlCCount >= 2) {
          console.log('\n再见！');
          this.saveSession();
          process.exit(0);
        }
        console.log('\n再按一次 Ctrl+C 退出，或输入继续对话');
      }
    });
  }

  // -----------------------------------------------------------------------
  // 工具注册
  // -----------------------------------------------------------------------
  registerTool(tool: Tool): void {
    this.tools.push(tool);
  }

  // -----------------------------------------------------------------------
  // 启动 REPL
  // -----------------------------------------------------------------------
  async start(): Promise<void> {
    this.isRunning = true;
    this.printWelcome();
    this.loadSession();

    while (this.isRunning) {
      try {
        const input = await this.readLine('你: ');

        // 空输入跳过
        if (input.trim() === '') continue;

        // 斜杠命令处理
        if (input.startsWith('/')) {
          await this.handleCommand(input.trim());
          continue;
        }

        // 普通消息 — 提交给 LLM
        await this.processQuery(input);

      } catch (error) {
        // 顶层错误兜底
        if (error instanceof Error && error.message.includes('SIGINT')) {
          continue; // Ctrl+C 已在上面处理
        }
        console.error('发生意外错误:', error instanceof Error ? error.message : error);
      }
    }

    this.rl.close();
  }

  // -----------------------------------------------------------------------
  // 欢迎信息
  // -----------------------------------------------------------------------
  private printWelcome(): void {
    console.log('');
    console.log('+==========================================+');
    console.log('|       完整版 AI REPL 交互终端            |');
    console.log('+==========================================+');
    console.log('');
    console.log('可用命令:');
    console.log('  /help     显示帮助信息');
    console.log('  /clear    清空对话历史');
    console.log('  /compact  压缩对话上下文');
    console.log('  /cost     显示用量与成本');
    console.log('  /save     手动保存会话');
    console.log('  /exit     退出程序');
    console.log('');
    console.log('提示: Ctrl+C 可中断当前回复');
    console.log('');
  }

  // -----------------------------------------------------------------------
  // 斜杠命令处理
  // -----------------------------------------------------------------------
  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(/\s+/);
    const command = parts[0].toLowerCase();
    // const args = parts.slice(1).join(' ');

    switch (command) {
      case '/help':
        this.showHelp();
        break;

      case '/clear':
        this.messages = [];
        console.log('对话历史已清空\n');
        break;

      case '/compact':
        await this.compactHistory();
        break;

      case '/cost':
        this.showCost();
        break;

      case '/save':
        this.saveSession();
        console.log('会话已保存\n');
        break;

      case '/exit':
      case '/quit':
      case '/q':
        this.saveSession();
        this.showFinalStats();
        this.isRunning = false;
        break;

      default:
        console.log('未知命令: ' + command);
        console.log('输入 /help 查看可用命令\n');
    }
  }

  // 显示帮助信息
  private showHelp(): void {
    console.log('');
    console.log('=== 帮助信息 ===');
    console.log('');
    console.log('对话:');
    console.log('  直接输入文字即可与 AI 对话');
    console.log('  AI 会自动调用工具来完成任务');
    console.log('');
    console.log('命令:');
    console.log('  /help     显示本帮助信息');
    console.log('  /clear    清空对话历史');
    console.log('  /compact  压缩对话上下文（节省 Token）');
    console.log('  /cost     显示当前的 Token 用量和预估成本');
    console.log('  /save     手动保存当前会话');
    console.log('  /exit     保存并退出程序');
    console.log('');
    console.log('快捷键:');
    console.log('  Ctrl+C    中断当前回复 / 快速退出');
    console.log('');
  }

  // 显示用量与成本
  private showCost(): void {
    const cost = this.calculateCost();
    console.log('');
    console.log('=== 用量统计 ===');
    console.log('  消息数量:   ' + this.messages.length);
    console.log('  输入 Token: ' + this.totalInputTokens.toLocaleString());
    console.log('  输出 Token: ' + this.totalOutputTokens.toLocaleString());
    console.log('  总 Token:   ' + (this.totalInputTokens + this.totalOutputTokens).toLocaleString());
    console.log('  预估成本:   $' + cost.toFixed(4));
    console.log('================\n');
  }

  // 显示最终统计
  private showFinalStats(): void {
    const cost = this.calculateCost();
    console.log('');
    console.log('=== 会话统计 ===');
    console.log('  消息数量:   ' + this.messages.length);
    console.log('  总 Token:   ' + (this.totalInputTokens + this.totalOutputTokens).toLocaleString());
    console.log('  预估成本:   $' + cost.toFixed(4));
    console.log('再见！');
  }

  // -----------------------------------------------------------------------
  // 核心：处理用户查询
  // -----------------------------------------------------------------------
  private async processQuery(userInput: string): Promise<void> {
    // 重置中断标志
    this.currentQueryAborted = false;

    // 添加用户消息
    this.messages.push({
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    });

    // Agent 循环 — 最多 20 轮工具调用
    const MAX_ROUNDS = 20;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (this.currentQueryAborted) break;

      try {
        // 调用 LLM（流式）
        const stream = this.client.messages.stream({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          tools: this.getToolDefinitions(),
          messages: this.toApiMessages(),
        });

        // 收集助手回复
        let assistantContent: ContentBlock[] = [];
        let currentText = '';
        let currentToolUse: { id: string; name: string; input: string } | null = null;

        // 如果是第一轮，显示 AI 前缀
        if (round === 0) {
          process.stdout.write('AI: ');
        }

        // 处理流式事件
        for await (const event of stream) {
          if (this.currentQueryAborted) break;

          switch (event.type) {
            case 'content_block_start':
              if (event.content_block.type === 'tool_use') {
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: '',
                };
              }
              break;

            case 'content_block_delta':
              if (event.delta.type === 'text_delta') {
                currentText += event.delta.text;
                // 流式输出 — 带可选的打字延迟
                process.stdout.write(event.delta.text);
                if (this.config.typingDelay > 0) {
                  await this.sleep(this.config.typingDelay);
                }
              } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
                currentToolUse.input += event.delta.partial_json;
              }
              break;

            case 'content_block_stop': {
              if (currentText) {
                assistantContent.push({ type: 'text', text: currentText });
                currentText = '';
                if (round === 0) {
                  process.stdout.write('\n');
                }
              }
              if (currentToolUse) {
                let parsedInput: Record<string, unknown> = {};
                try {
                  parsedInput = JSON.parse(currentToolUse.input || '{}');
                } catch { /* 忽略解析错误 */ }

                assistantContent.push({
                  type: 'tool_use',
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input: parsedInput,
                });
                currentToolUse = null;
              }
              break;
            }

            case 'message_start':
              if (event.message.usage) {
                this.totalInputTokens += event.message.usage.input_tokens;
              }
              break;

            case 'message_delta':
              if (event.usage) {
                this.totalOutputTokens += event.usage.output_tokens;
              }
              break;
          }
        }

        // 将助手回复加入历史
        this.messages.push({
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
        });

        // 检查工具调用
        const toolCalls = assistantContent.filter(
          (b) => b.type === 'tool_use'
        ) as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }[];

        if (toolCalls.length === 0) {
          // 无工具调用 — 查询完成
          break;
        }

        // 执行工具
        console.log(''); // 换行
        const toolResults: ContentBlock[] = [];

        for (const toolCall of toolCalls) {
          // 展示工具调用信息
          const shortInput = JSON.stringify(toolCall.input);
          const displayInput = shortInput.length > 60
            ? shortInput.substring(0, 57) + '...'
            : shortInput;
          console.log('  [tool] ' + toolCall.name + '(' + displayInput + ')');

          const tool = this.tools.find((t) => t.name === toolCall.name);
          if (!tool) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: '未知工具: ' + toolCall.name,
              is_error: true,
            });
            console.log('     [fail] 未知工具');
            continue;
          }

          try {
            const result = await tool.execute(toolCall.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: result,
            });
            // 截断过长的结果展示
            const displayResult = result.length > 100
              ? result.substring(0, 97) + '...'
              : result;
            console.log('     [ok] ' + displayResult);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: '执行错误: ' + msg,
              is_error: true,
            });
            console.log('     [fail] ' + msg);
          }
        }

        // 将工具结果加入历史
        this.messages.push({
          role: 'user',
          content: toolResults,
          timestamp: Date.now(),
        });

        console.log('  [AI] 继续思考...');

      } catch (error) {
        // API 错误处理
        if (error instanceof Anthropic.APIError) {
          this.handleAPIError(error);
        } else {
          console.error('\n错误: ' + (error instanceof Error ? error.message : error));
        }
        break; // 出错时退出 Agent 循环
      }
    }

    console.log(''); // 最终换行

    // 每次查询后自动保存
    this.autoSave();
  }

  // -----------------------------------------------------------------------
  // 错误处理
  // -----------------------------------------------------------------------
  private handleAPIError(error: Anthropic.APIError): void {
    switch (error.status) {
      case 401:
        console.error('\n认证失败: API Key 无效或已过期');
        console.error('请检查 ANTHROPIC_API_KEY 环境变量\n');
        break;
      case 429:
        console.error('\n请求过于频繁，请稍后再试\n');
        break;
      case 500:
      case 502:
      case 503:
        console.error('\n服务器暂时不可用，请稍后再试\n');
        break;
      default:
        console.error('\nAPI 错误 (' + error.status + '): ' + error.message + '\n');
    }
  }

  // -----------------------------------------------------------------------
  // 上下文压缩
  // -----------------------------------------------------------------------
  private async compactHistory(): Promise<void> {
    if (this.messages.length <= 4) {
      console.log('消息数量较少，无需压缩\n');
      return;
    }

    console.log('正在压缩上下文...');

    // 保留最近 4 条消息
    const recent = this.messages.slice(-4);
    const toCompact = this.messages.slice(0, -4);

    // 用 LLM 生成摘要
    try {
      const summaryResponse = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: '请用 2-3 句话简洁总结以下对话的关键信息、结论和上下文：\n\n'
              + JSON.stringify(toCompact.map((m) => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content.substring(0, 200) : '(工具调用)',
              }))),
          },
        ],
      });

      const textBlock = summaryResponse.content.find((b) => b.type === 'text') as
        | Anthropic.TextBlock
        | undefined;
      const summary = textBlock?.text ?? '(摘要生成失败)';

      // 用摘要替换旧消息
      const compactedMessages: Message[] = [
        {
          role: 'user',
          content: '[上下文摘要] ' + summary,
          timestamp: Date.now(),
        },
        {
          role: 'assistant',
          content: '好的，我已了解之前的对话内容。',
          timestamp: Date.now(),
        },
        ...recent,
      ];

      const savedCount = toCompact.length - 2; // 减去摘要占用的 2 条
      this.messages = compactedMessages;

      console.log('已压缩 ' + savedCount + ' 条消息\n');
    } catch (error) {
      console.error('压缩失败:', error instanceof Error ? error.message : error);
    }
  }

  // -----------------------------------------------------------------------
  // 会话持久化
  // -----------------------------------------------------------------------
  private saveSession(): void {
    try {
      const dir = path.dirname(this.config.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        type: 'session',
        savedAt: Date.now(),
        messages: this.messages,
        usage: {
          inputTokens: this.totalInputTokens,
          outputTokens: this.totalOutputTokens,
        },
      };

      fs.writeFileSync(
        this.config.historyFile,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      // 保存失败不应该影响程序运行
      console.error('(保存会话失败，不影响使用)');
    }
  }

  private loadSession(): void {
    try {
      if (!fs.existsSync(this.config.historyFile)) return;

      const content = fs.readFileSync(this.config.historyFile, 'utf-8');
      const data = JSON.parse(content);

      if (data.messages && Array.isArray(data.messages)) {
        this.messages = data.messages;
        this.totalInputTokens = data.usage?.inputTokens ?? 0;
        this.totalOutputTokens = data.usage?.outputTokens ?? 0;

        const savedAt = new Date(data.savedAt).toLocaleString('zh-CN');
        console.log('(已恢复会话: ' + this.messages.length + ' 条消息, 保存于 ' + savedAt + ')\n');
      }
    } catch {
      // 加载失败时静默忽略，从新会话开始
    }
  }

  private autoSave(): void {
    // 每次查询后自动保存（不打印提示）
    this.saveSession();
  }

  // -----------------------------------------------------------------------
  // 辅助方法
  // -----------------------------------------------------------------------

  private readLine(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateCost(): number {
    const inputCost = (this.totalInputTokens / 1_000_000) * this.INPUT_COST_PER_M;
    const outputCost = (this.totalOutputTokens / 1_000_000) * this.OUTPUT_COST_PER_M;
    return inputCost + outputCost;
  }

  private getToolDefinitions(): Anthropic.Tool[] {
    if (this.tools.length === 0) return [];
    return this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.schema,
    }));
  }

  private toApiMessages(): Anthropic.MessageParam[] {
    return this.messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((block) => {
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
                return { type: 'text' as const, text: '' };
            }
          }),
    }));
  }
}

// =========================================================================
// 创建并启动 REPL
// =========================================================================

// 定义示例工具
const tools: Tool[] = [
  {
    name: 'get_time',
    description: '获取当前日期和时间',
    schema: {
      type: 'object' as const,
      properties: {
        timezone: {
          type: 'string',
          description: '时区，默认 Asia/Shanghai',
        },
      },
    },
    execute: async (input) => {
      const tz = (input.timezone as string) || 'Asia/Shanghai';
      return new Date().toLocaleString('zh-CN', { timeZone: tz });
    },
  },
  {
    name: 'calculate',
    description: '计算数学表达式，支持四则运算和括号',
    schema: {
      type: 'object' as const,
      properties: {
        expression: { type: 'string', description: '数学表达式' },
      },
      required: ['expression'] as const,
    },
    execute: async (input) => {
      const expr = input.expression as string;
      try {
        const result = new Function('return (' + expr + ')')();
        return expr + ' = ' + result;
      } catch {
        return '"' + expr + '" 不是有效的数学表达式';
      }
    },
  },
  {
    name: 'list_files',
    description: '列出指定目录下的文件',
    schema: {
      type: 'object' as const,
      properties: {
        dir: { type: 'string', description: '目录路径，默认当前目录' },
      },
    },
    execute: async (input) => {
      const dir = (input.dir as string) || '.';
      try {
        const files = fs.readdirSync(dir);
        return files.slice(0, 20).join(', ') + (files.length > 20 ? '...' : '');
      } catch (error) {
        return '读取目录失败: ' + (error instanceof Error ? error.message : String(error));
      }
    },
  },
  {
    name: 'read_file',
    description: '读取文件内容',
    schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: '文件路径' },
      },
      required: ['path'] as const,
    },
    execute: async (input) => {
      const filePath = input.path as string;
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // 截断过长的文件内容
        if (content.length > 2000) {
          return content.substring(0, 2000) + '\n...(内容已截断)';
        }
        return content;
      } catch (error) {
        return '读取文件失败: ' + (error instanceof Error ? error.message : String(error));
      }
    },
  },
];

// 创建 REPL 实例并注册工具
const repl = new CompleteREPL({
  typingDelay: 0,    // 无延迟，直接流式输出（设为 20 可获得打字效果）
  historyFile: path.join(process.cwd(), '.repl-session.json'),
});

tools.forEach((tool) => repl.registerTool(tool));

// 启动
repl.start().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * 实现完整的斜杠命令系统（/help、/clear、/compact、/cost、/save、/exit）
//   * 流式输出与打字效果
//   * 工具执行的可视化展示（显示工具名、参数、结果）
//   * 分级错误处理（API 错误、工具错误、未知错误）
//   * 会话持久化与自动恢复
//   * Token/成本实时追踪
//   * Ctrl+C 中断与优雅退出
//
// 恭喜！你已经构建了一个功能完备的 AI REPL 交互终端。
// 虽然界面还比较朴素（纯文本输出），但核心逻辑和真实 Claude Code 是一致的。
//
// 后续改进方向：
//   - Module 04: 用 Ink 框架构建更美观的终端 UI
//   - Module 05: 实现更智能的上下文管理与压缩
//   - Module 06: 构建多智能体协作系统
// ---------------------------------------------------------------------------
