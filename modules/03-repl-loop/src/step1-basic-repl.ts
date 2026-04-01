// =============================================================================
// Step 1: 最简单的 REPL — 读取-求值-打印-循环
// =============================================================================
//
// 学习目标：
//   - 理解 REPL（Read-Eval-Print-Loop）模式
//   - 使用 Node.js readline 模块读取终端输入
//   - 用 async/await 构建异步循环
//   - 实现最基本的用户输入 -> LLM 调用 -> 输出回复循环
//
// 运行方式：
//   npx tsx src/step1-basic-repl.ts
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// 1. 初始化
// ---------------------------------------------------------------------------
const client = new Anthropic();

// 创建 readline 接口
// readline 是 Node.js 内置模块，用于逐行读取终端输入
// 它提供了基本的行编辑功能（退格、删除、左右移动等）
const rl = readline.createInterface({
  input: process.stdin,   // 标准输入
  output: process.stdout, // 标准输出（这样提示符才能正确显示）
});

// ---------------------------------------------------------------------------
// 2. 辅助函数：将 readline.question 包装为 Promise
// ---------------------------------------------------------------------------
// readline.question 是基于回调的 API，我们用 Promise 包装它
// 这样就能在 async 函数中用 await 来等待用户输入
function askQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// ---------------------------------------------------------------------------
// 3. 辅助函数：调用 LLM
// ---------------------------------------------------------------------------
// 封装 LLM 调用，只传入消息数组，其他参数用默认值
// 这样 REPL 主循环中的代码会更简洁
async function callLLM(messages: Anthropic.MessageParam[]): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: messages,
  });

  // 从响应中提取文本内容
  // response.content 是数组，第一个元素通常是文本
  const textBlock = response.content.find((block) => block.type === 'text');

  if (textBlock && textBlock.type === 'text') {
    return textBlock.text;
  }

  return '(无文本回复)';
}

// ---------------------------------------------------------------------------
// 4. REPL 主循环
// ---------------------------------------------------------------------------
// 这就是 REPL 的核心 — 一个无限循环，不断：
//   Read:   读取用户输入
//   Eval:   调用 LLM 处理
//   Print:  打印结果
//   Loop:   回到 Read
async function startREPL() {
  console.log('=== 最简单的 AI REPL ===');
  console.log('输入你的问题，按 Enter 发送');
  console.log('输入 /exit 退出\n');

  // 对话历史：每次请求都需要带上完整的历史
  // 这是因为 LLM API 是无状态的 — 它不记得之前的请求
  const messages: Anthropic.MessageParam[] = [];

  // REPL 主循环
  while (true) {
    // ========================================
    // R — Read：读取用户输入
    // ========================================
    const userInput = await askQuestion('你: ');

    // 检查是否要退出
    if (userInput.trim() === '/exit') {
      console.log('再见！');
      break;
    }

    // 忽略空输入
    if (userInput.trim() === '') {
      continue;
    }

    // ========================================
    // 将用户消息加入历史
    // ========================================
    // 每次用户输入都保存到 messages 数组
    // 后续每次调用 LLM 时，都会把完整的 messages 传过去
    messages.push({
      role: 'user',
      content: userInput,
    });

    // ========================================
    // E — Eval：调用 LLM 进行求值
    // ========================================
    // 这里显示一个简单的"思考中"提示
    // 在真实工具中，这里会用流式输出来展示进度
    console.log('AI: (思考中...)');

    try {
      const response = await callLLM(messages);

      // ========================================
      // P — Print：打印结果
      // ========================================
      console.log('AI: ' + response + '\n');

      // 将助手回复也加入历史，保持对话连续性
      messages.push({
        role: 'assistant',
        content: response,
      });
    } catch (error) {
      // 错误处理 — 在 REPL 中，错误不应该让程序崩溃
      // 而是打印错误信息，然后继续循环等待下次输入
      console.error('出错了:', error instanceof Error ? error.message : error);
      console.log('请重试或输入 /exit 退出\n');

      // 注意：出错时我们不把 assistant 消息加入历史
      // 因为这次调用可能没有产生有效的回复
      // 但用户消息已经在历史中了 — 下次 LLM 会看到这条没被回复的消息
      // 在更健壮的实现中，应该把失败的用户消息也从历史中移除
    }

    // ========================================
    // L — Loop：回到 while(true) 继续下一次循环
    // ========================================
  }

  // 关闭 readline 接口，释放资源
  rl.close();
}

// ---------------------------------------------------------------------------
// 5. 启动 REPL
// ---------------------------------------------------------------------------
startREPL().catch((error) => {
  console.error('REPL 启动失败:', error);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * 使用 readline 创建终端交互界面
//   * 用 Promise 包装基于回调的 API
//   * 构建 Read-Eval-Print-Loop 主循环
//   * 维护对话历史数组实现多轮对话
//   * 在 REPL 中进行错误处理（不让错误导致程序退出）
//
// 存在的问题：
//   * 没有流式输出 — 用户需要等待完整回复
//   * 没有工具调用 — LLM 只能聊天，不能执行操作
//   * 没有持久化 — 程序退出后对话丢失
//
// 下一步：step2-repl-with-tools.ts — 集成工具调用，让 REPL 变得更强大
// ---------------------------------------------------------------------------
