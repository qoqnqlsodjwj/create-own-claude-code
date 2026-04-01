// =============================================================================
// Step 4: QueryEngine 类 — 封装完整查询生命周期
// =============================================================================
//
// 学习目标：
//   - 设计 QueryEngine 类封装查询的完整生命周期
//   - 使用 AsyncGenerator 实现流式事件输出
//   - 实现 Token 计量与成本追踪
//   - 理解生命周期钩子（before/after query）
//   - 将对话管理、工具执行、流式输出整合为一个统一接口
//
// 运行方式：
//   npx tsx src/step4-query-engine.ts
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// 1. 类型定义
// ---------------------------------------------------------------------------

// 查询事件 — QueryEngine 通过 AsyncGenerator 产生的事件流
// 这是 QueryEngine 与外部 UI 的通信协议
type QueryEvent =
  | { type: 'thinking' }                                          // 正在思考
  | { type: 'text_delta'; text: string }                          // 文本增量
  | { type: 'text_done'; fullText: string }                       // 文本完成
  | { type: 'tool_call'; name: string; id: string; input: Record<string, unknown> }  // 工具调用开始
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean }   // 工具执行结果
  | { type: 'usage'; inputTokens: number; outputTokens: number }  // Token 用量
  | { type: 'cost'; totalCost: number }                           // 成本信息
  | { type: 'done'; response: string; usage: UsageSummary }       // 查询完成
  | { type: 'error'; error: string };                             // 错误

// 用量摘要
interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// 工具接口
interface Tool {
  name: string;
  description: string;
  schema: Anthropic.Tool.InputSchema;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

// 生命周期钩子类型
type BeforeQueryHook = (message: string, messages: Message[]) => void | Promise<void>;
type AfterQueryHook = (result: string, usage: UsageSummary) => void | Promise<void>;

// 统一消息类型
interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

// ---------------------------------------------------------------------------
// 2. QueryEngine 类
// ---------------------------------------------------------------------------
// QueryEngine 是本模块的核心类，它封装了一次完整查询的所有逻辑：
//   - 接收用户消息
//   - 管理对话历史
//   - 调用 LLM（带流式输出）
//   - 处理工具调用
//   - 追踪 Token 用量和成本
//   - 通过 AsyncGenerator 产生事件供外部消费
export class QueryEngine {
  // 对话历史
  private messages: Message[] = [];

  // 可用工具列表
  private tools: Tool[] = [];

  // Token 累计用量
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;

  // 成本累计
  // Claude Sonnet 定价: 输入 $3/M, 输出 $15/M tokens
  private readonly INPUT_COST_PER_MILLION = 3;
  private readonly OUTPUT_COST_PER_MILLION = 15;

  // 最大工具调用轮次（防止无限循环）
  private readonly MAX_TOOL_ROUNDS = 20;

  // 生命周期钩子
  private beforeQueryHooks: BeforeQueryHook[] = [];
  private afterQueryHooks: AfterQueryHook[] = [];

  // Anthropic 客户端
  private client: Anthropic;

  constructor(config?: { apiKey?: string; tools?: Tool[] }) {
    this.client = new Anthropic({
      apiKey: config?.apiKey,
    });

    if (config?.tools) {
      this.tools = config.tools;
    }
  }

  // -----------------------------------------------------------------------
  // 注册工具
  // -----------------------------------------------------------------------
  registerTool(tool: Tool): void {
    this.tools.push(tool);
  }

  // -----------------------------------------------------------------------
  // 生命周期钩子
  // -----------------------------------------------------------------------
  onBeforeQuery(hook: BeforeQueryHook): void {
    this.beforeQueryHooks.push(hook);
  }

  onAfterQuery(hook: AfterQueryHook): void {
    this.afterQueryHooks.push(hook);
  }

  // 执行 before 钩子
  private async runBeforeHooks(message: string): Promise<void> {
    for (const hook of this.beforeQueryHooks) {
      await hook(message, this.messages);
    }
  }

  // 执行 after 钩子
  private async runAfterHooks(result: string, usage: UsageSummary): Promise<void> {
    for (const hook of this.afterQueryHooks) {
      await hook(result, usage);
    }
  }

  // -----------------------------------------------------------------------
  // 核心方法：提交消息并返回事件流
  // -----------------------------------------------------------------------
  // 这是 AsyncGenerator 方法 — 调用方可以用 for-await-of 来消费事件
  //
  // 使用示例：
  //   for await (const event of engine.submitMessage("你好")) {
  //     if (event.type === 'text_delta') {
  //       process.stdout.write(event.text);
  //     }
  //   }
  async *submitMessage(userMessage: string): AsyncGenerator<QueryEvent> {
    // 1. 执行 before 钩子
    await this.runBeforeHooks(userMessage);

    // 2. 添加用户消息到历史
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    // 3. 进入 Agent 循环（内层循环）
    let currentResponse = '';
    let roundUsage = { inputTokens: 0, outputTokens: 0 };

    for (let round = 0; round < this.MAX_TOOL_ROUNDS; round++) {
      yield { type: 'thinking' };

      // 3a. 调用 LLM（流式）
      const stream = this.client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        tools: this.getToolDefinitions(),
        messages: this.toApiMessages(),
      });

      // 收集完整的助手回复
      let assistantContent: ContentBlock[] = [];
      let currentText = '';
      let currentToolUse: { id: string; name: string; input: string } | null = null;

      // 3b. 处理流式事件
      for await (const event of stream) {
        switch (event.type) {
          // 内容块开始
          case 'content_block_start':
            if (event.content_block.type === 'tool_use') {
              // 工具调用开始
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: '',
              };
            }
            break;

          // 内容增量
          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              // 文本增量 — 产生 text_delta 事件
              currentText += event.delta.text;
              yield { type: 'text_delta', text: event.delta.text };
            } else if (event.delta.type === 'input_json_delta') {
              // 工具参数的增量 JSON
              if (currentToolUse) {
                currentToolUse.input += event.delta.partial_json;
              }
            }
            break;

          // 内容块结束
          case 'content_block_stop': {
            if (currentText) {
              // 文本块结束
              assistantContent.push({ type: 'text', text: currentText });
              yield { type: 'text_done', fullText: currentText };
              currentResponse = currentText;
              currentText = '';
            }
            if (currentToolUse) {
              // 工具调用块结束
              let parsedInput: Record<string, unknown> = {};
              try {
                parsedInput = JSON.parse(currentToolUse.input || '{}');
              } catch {
                parsedInput = {};
              }

              assistantContent.push({
                type: 'tool_use',
                id: currentToolUse.id,
                name: currentToolUse.name,
                input: parsedInput,
              });

              yield {
                type: 'tool_call',
                name: currentToolUse.name,
                id: currentToolUse.id,
                input: parsedInput,
              };

              currentToolUse = null;
            }
            break;
          }

          // 消息结束 — 包含 token 用量
          case 'message_delta':
            if (event.usage) {
              roundUsage.outputTokens += event.usage.output_tokens;
            }
            break;

          // 消息开始 — 包含 input token 用量
          case 'message_start':
            if (event.message.usage) {
              roundUsage.inputTokens += event.message.usage.input_tokens;
            }
            break;
        }
      }

      // 将助手回复加入历史
      this.messages.push({
        role: 'assistant',
        content: assistantContent,
      });

      // 报告本轮用量
      yield {
        type: 'usage',
        inputTokens: roundUsage.inputTokens,
        outputTokens: roundUsage.outputTokens,
      };

      // 3c. 检查是否有工具调用
      const toolCalls = assistantContent.filter(
        (block) => block.type === 'tool_use'
      ) as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }[];

      if (toolCalls.length === 0) {
        // 没有工具调用 — Agent 循环结束
        break;
      }

      // 3d. 执行工具
      const toolResults: ContentBlock[] = [];

      for (const toolCall of toolCalls) {
        const tool = this.tools.find((t) => t.name === toolCall.name);

        if (!tool) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: '错误：未知工具 "' + toolCall.name + '"',
            is_error: true,
          });
          yield {
            type: 'tool_result',
            toolUseId: toolCall.id,
            content: '未知工具: ' + toolCall.name,
            isError: true,
          };
          continue;
        }

        try {
          const result = await tool.execute(toolCall.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: result,
          });
          yield {
            type: 'tool_result',
            toolUseId: toolCall.id,
            content: result,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: '执行错误: ' + errorMsg,
            is_error: true,
          });
          yield {
            type: 'tool_result',
            toolUseId: toolCall.id,
            content: errorMsg,
            isError: true,
          };
        }
      }

      // 将工具结果加入历史
      this.messages.push({
        role: 'user',
        content: toolResults,
      });

      // 重置本轮用量，准备下一轮
      roundUsage = { inputTokens: 0, outputTokens: 0 };
    }

    // 4. 汇总用量
    this.totalInputTokens += roundUsage.inputTokens;
    this.totalOutputTokens += roundUsage.outputTokens;

    const usage: UsageSummary = {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      estimatedCost: this.calculateCost(),
    };

    // 5. 产出最终事件
    yield { type: 'cost', totalCost: usage.estimatedCost };
    yield { type: 'done', response: currentResponse, usage };

    // 6. 执行 after 钩子
    await this.runAfterHooks(currentResponse, usage);
  }

  // -----------------------------------------------------------------------
  // 辅助方法
  // -----------------------------------------------------------------------

  // 获取工具定义（Anthropic API 格式）
  private getToolDefinitions(): Anthropic.Tool[] {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.schema,
    }));
  }

  // 将内部消息转换为 API 格式
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

  // 计算累计成本（美元）
  private calculateCost(): number {
    const inputCost = (this.totalInputTokens / 1_000_000) * this.INPUT_COST_PER_MILLION;
    const outputCost = (this.totalOutputTokens / 1_000_000) * this.OUTPUT_COST_PER_MILLION;
    return inputCost + outputCost;
  }

  // 获取累计用量
  getUsage(): UsageSummary {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      estimatedCost: this.calculateCost(),
    };
  }

  // 清空对话（保留工具注册和用量）
  clearConversation(): void {
    this.messages = [];
  }

  // 获取消息数量
  getMessageCount(): number {
    return this.messages.length;
  }
}

// ---------------------------------------------------------------------------
// 3. 演示：使用 QueryEngine 构建 REPL
// ---------------------------------------------------------------------------

// 定义演示工具
const demoTools: Tool[] = [
  {
    name: 'get_time',
    description: '获取当前时间',
    schema: {
      type: 'object' as const,
      properties: {},
    },
    execute: async () => {
      return '当前时间: ' + new Date().toLocaleString('zh-CN');
    },
  },
  {
    name: 'calculate',
    description: '计算数学表达式',
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
        return '计算错误: "' + expr + '" 不是有效的表达式';
      }
    },
  },
];

// 创建 QueryEngine 实例
const engine = new QueryEngine({ tools: demoTools });

// 注册生命周期钩子
engine.onBeforeQuery((message) => {
  console.log('\n[开始处理] 消息长度: ' + message.length + ' 字符');
});

engine.onAfterQuery((_result, usage) => {
  console.log('\n[处理完成] Token: ' + usage.totalTokens + ', 成本: $' + usage.estimatedCost.toFixed(4));
});

// readline 接口
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

// REPL 主循环
async function startREPL() {
  console.log('=== QueryEngine REPL ===');
  console.log('使用 AsyncGenerator 驱动的流式 REPL');
  console.log('输入 /exit 退出，/cost 查看用量\n');

  while (true) {
    const input = await askQuestion('你: ');

    if (input.trim() === '/exit') {
      const usage = engine.getUsage();
      console.log('\n本次会话统计:');
      console.log('  消息数: ' + engine.getMessageCount());
      console.log('  总 Token: ' + usage.totalTokens);
      console.log('  预估成本: $' + usage.estimatedCost.toFixed(4));
      console.log('再见！');
      rl.close();
      return;
    }

    if (input.trim() === '/cost') {
      const usage = engine.getUsage();
      console.log('\n=== 用量统计 ===');
      console.log('  输入 Token: ' + usage.inputTokens);
      console.log('  输出 Token: ' + usage.outputTokens);
      console.log('  总 Token: ' + usage.totalTokens);
      console.log('  预估成本: $' + usage.estimatedCost.toFixed(4));
      console.log('===============\n');
      continue;
    }

    if (input.trim() === '/clear') {
      engine.clearConversation();
      console.log('对话已清空\n');
      continue;
    }

    if (input.trim() === '') continue;

    try {
      // 消费 QueryEngine 的事件流
      for await (const event of engine.submitMessage(input)) {
        switch (event.type) {
          case 'thinking':
            // 可以在这里显示"思考中"动画
            break;

          case 'text_delta':
            // 流式输出文本
            process.stdout.write(event.text);
            break;

          case 'text_done':
            // 文本输出完毕，换行
            process.stdout.write('\n');
            break;

          case 'tool_call':
            console.log('\n  [tool] ' + event.name + '(' + JSON.stringify(event.input) + ')');
            break;

          case 'tool_result':
            const icon = event.isError ? '[fail]' : '[ok]';
            console.log('     ' + icon + ' ' + event.content);
            break;

          case 'usage':
            console.log('\n  [token] +' + event.inputTokens + ' 输入 / +' + event.outputTokens + ' 输出');
            break;

          case 'cost':
            console.log('  [cost] 累计成本: $' + event.totalCost.toFixed(4));
            break;

          case 'done':
            console.log('-'.repeat(40));
            break;

          case 'error':
            console.error('\n错误: ' + event.error);
            break;
        }
      }
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
//   * 用 QueryEngine 类封装完整的查询生命周期
//   * 使用 AsyncGenerator 产生事件流
//   * 实现流式 LLM 调用并解析 SSE 事件
//   * Token 计量与成本估算
//   * 生命周期钩子（before/after query）
//   * 将复杂逻辑封装为简洁的外部接口
//
// 关键设计：
//   * AsyncGenerator 解耦 — Engine 不关心 UI 如何渲染
//   * 事件驱动 — 所有信息通过事件传递
//   * 成本透明 — 每次查询都追踪用量
//   * 钩子机制 — 灵活扩展（日志、压缩、通知等）
//
// 下一步：step5-full-repl.ts — 在此基础上构建完整的 REPL 工具
// ---------------------------------------------------------------------------
