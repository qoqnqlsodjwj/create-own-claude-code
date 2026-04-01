// =============================================================================
// Step 2: 带工具调用的 REPL — 集成 Agent 循环
// =============================================================================
//
// 学习目标：
//   - 将 Module 01 的 Agent 循环集成到 REPL 中
//   - 实现工具执行时的进度展示
//   - 处理 LLM 多轮工具调用的场景
//   - 理解 REPL 和 Agent 循环的双层嵌套结构
//
// 运行方式：
//   npx tsx src/step2-repl-with-tools.ts
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// 1. 初始化
// ---------------------------------------------------------------------------
const client = new Anthropic();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ---------------------------------------------------------------------------
// 2. 工具定义
// ---------------------------------------------------------------------------
// 我们定义两个简单的工具来演示工具调用流程
// 这些工具是"模拟"的 — 在真实场景中会有实际的文件读写等操作

// 工具的类型定义
interface Tool {
  name: string;
  description: string;
  schema: Anthropic.Tool.InputSchema;
  // 执行函数：接收参数，返回结果字符串
  execute: (input: Record<string, unknown>) => Promise<string>;
}

// 工具 1：获取当前时间
const getTimeTool: Tool = {
  name: 'get_current_time',
  description: '获取当前的日期和时间',
  schema: {
    type: 'object' as const,
    properties: {
      timezone: {
        type: 'string',
        description: '时区，如 "Asia/Shanghai"、"US/Eastern"',
      },
    },
  },
  execute: async (input) => {
    const timezone = (input.timezone as string) || 'Asia/Shanghai';
    const now = new Date();
    return '当前时间 (' + timezone + '): ' + now.toLocaleString('zh-CN', { timeZone: timezone });
  },
};

// 工具 2：计算数学表达式
// 注意：这个工具用 Function 构造器来演示，实际项目中要注意安全性！
const calculateTool: Tool = {
  name: 'calculate',
  description: '计算一个数学表达式的结果。支持加减乘除和括号。',
  schema: {
    type: 'object' as const,
    properties: {
      expression: {
        type: 'string',
        description: '数学表达式，如 "2 + 3 * 4"',
      },
    },
    required: ['expression'] as const,
  },
  execute: async (input) => {
    const expression = input.expression as string;
    try {
      // 使用 Function 构造器比 eval 稍安全一些
      // 但在生产环境中，应该使用专门的数学表达式解析库
      const result = new Function('return (' + expression + ')')();
      return '计算结果: ' + expression + ' = ' + result;
    } catch {
      return '计算错误: "' + expression + '" 不是有效的数学表达式';
    }
  },
};

// 工具注册表：将工具名映射到工具对象
const toolMap = new Map<string, Tool>();
toolMap.set(getTimeTool.name, getTimeTool);
toolMap.set(calculateTool.name, calculateTool);

// 转换为 Anthropic API 需要的工具定义格式
const toolDefinitions: Anthropic.Tool[] = Array.from(toolMap.values()).map(
  (tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.schema,
  })
);

// ---------------------------------------------------------------------------
// 3. Agent 循环：处理工具调用的内层循环
// ---------------------------------------------------------------------------
// 这是 Module 01 step5 学到的 Agent 循环模式
// 现在它被嵌入了 REPL 中，成为 REPL 的 "Eval" 部分
//
// 整体结构是双层循环：
//   外层循环：REPL — 读取用户输入 -> 处理 -> 输出 -> 重复
//   内层循环：Agent — LLM 调用 -> 工具执行 -> 结果回传 -> 再次 LLM -> ...
async function runAgentLoop(
  messages: Anthropic.MessageParam[]
): Promise<{ response: string; messages: Anthropic.MessageParam[] }> {
  // Agent 循环：一直运行直到 LLM 不再调用工具
  while (true) {
    // 调用 LLM
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools: toolDefinitions,
      messages: messages,
    });

    // 将助手回复加入历史
    // 注意：response.content 是数组，可能包含 text 和 tool_use
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    // 检查是否包含工具调用
    const toolUseBlocks = response.content.filter(
      (block) => block.type === 'tool_use'
    ) as Anthropic.ToolUseBlock[];

    if (toolUseBlocks.length === 0) {
      // 没有工具调用 — Agent 循环结束
      // 提取文本回复返回给外层 REPL
      const textBlock = response.content.find(
        (block) => block.type === 'text'
      ) as Anthropic.TextBlock | undefined;

      return {
        response: textBlock?.text ?? '(无文本回复)',
        messages: messages,
      };
    }

    // --------------------------------------------------
    // 有工具调用 — 执行工具并将结果加入消息历史
    // --------------------------------------------------

    // 构造 tool_result 消息
    // 一个 assistant 消息中的所有 tool_use，对应的 tool_result
    // 要放在同一个 user 消息中
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const tool = toolMap.get(toolUse.name);

      if (!tool) {
        // 未知工具
        console.log('  [!] 未知工具: ' + toolUse.name);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: '错误：未知工具 "' + toolUse.name + '"',
          is_error: true,
        });
        continue;
      }

      // 展示工具执行进度 — 这对用户体验非常重要
      console.log('\n  [*] 调用工具: ' + toolUse.name);
      console.log('     参数: ' + JSON.stringify(toolUse.input));

      try {
        // 执行工具
        const result = await tool.execute(toolUse.input as Record<string, unknown>);

        console.log('     [ok] ' + result + '\n');

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log('     [fail] 执行失败: ' + errorMsg + '\n');

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: '工具执行错误: ' + errorMsg,
          is_error: true,
        });
      }
    }

    // 将所有 tool_result 作为一条 user 消息加入历史
    // 记住：tool_result 的 role 必须是 'user'
    messages.push({
      role: 'user',
      content: toolResults,
    });

    // 继续循环，让 LLM 看到工具结果后决定下一步
    console.log('  [AI] 正在继续思考...');
  }
}

// ---------------------------------------------------------------------------
// 4. 辅助函数
// ---------------------------------------------------------------------------
function askQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// ---------------------------------------------------------------------------
// 5. REPL 主循环
// ---------------------------------------------------------------------------
async function startREPL() {
  console.log('=== 带工具调用的 AI REPL ===');
  console.log('我可以使用以下工具:');
  console.log('  - get_current_time: 获取当前时间');
  console.log('  - calculate: 计算数学表达式');
  console.log('输入 /exit 退出\n');

  // 对话历史
  const messages: Anthropic.MessageParam[] = [];

  while (true) {
    // Read：读取用户输入
    const userInput = await askQuestion('你: ');

    if (userInput.trim() === '/exit') {
      console.log('再见！');
      break;
    }

    if (userInput.trim() === '') {
      continue;
    }

    // 将用户消息加入历史
    messages.push({
      role: 'user',
      content: userInput,
    });

    // Eval + Print：运行 Agent 循环
    console.log('[AI] 正在思考...');
    console.log('-'.repeat(40));

    try {
      const result = await runAgentLoop(messages);

      // 打印最终回复
      console.log('-'.repeat(40));
      console.log('AI: ' + result.response + '\n');

      // 注意：result.messages 已经包含了所有中间的工具调用消息
      // 但我们的 messages 引用的是同一个数组，所以已经自动更新了
      // 不需要再手动同步
    } catch (error) {
      console.error('出错了:', error instanceof Error ? error.message : error);
      console.log('请重试或输入 /exit 退出\n');
    }
  }

  rl.close();
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
//   * 在 REPL 中集成 Agent 循环
//   * 实现工具执行时的进度展示
//   * 处理 LLM 的多轮工具调用
//   * 理解 REPL（外层）和 Agent（内层）的双层循环结构
//
// 关键理解：
//   * 外层 REPL 循环：用户输入 -> 查询 -> 输出 -> 等待
//   * 内层 Agent 循环：LLM -> 工具 -> 结果 -> LLM -> ...（直到无工具调用）
//   * 两个循环共享同一个 messages 数组
//
// 下一步：step3-conversation-history.ts — 学习对话历史管理与持久化
// ---------------------------------------------------------------------------
