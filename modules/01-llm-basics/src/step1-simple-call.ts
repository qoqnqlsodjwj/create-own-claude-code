// =============================================================================
// Step 1: 最简单的 LLM API 调用
// =============================================================================
//
// 学习目标：
//   - 学会初始化 Anthropic SDK 客户端
//   - 理解消息（messages）的数据结构
//   - 发送一次完整的请求并获取响应
//   - 解析响应中的文本内容
//
// 运行方式：
//   npx tsx src/step1-simple-call.ts
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// 1. 初始化客户端
// ---------------------------------------------------------------------------
// Anthropic 构造函数会自动从环境变量 ANTHROPIC_API_KEY 读取密钥。
// 你也可以手动传入: new Anthropic({ apiKey: 'sk-xxx' })
//
// SDK 底层会向 https://api.anthropic.com/v1/messages 发送 HTTP POST 请求。
const client = new Anthropic();

// ---------------------------------------------------------------------------
// 2. 发送消息
// ---------------------------------------------------------------------------
// messages.create() 是最核心的方法，它做了以下事情：
//   a) 将参数序列化为 JSON
//   b) 发送 HTTP POST 到 Anthropic API
//   c) 等待服务器返回完整响应（非流式）
//   d) 解析 JSON 为 TypeScript 对象
//
// 参数说明：
//   model       — 使用哪个模型，claude-sonnet-4-20250514 是性价比最高的选择
//   max_tokens  — 模型最多生成多少个 token（可以理解为"字数上限"）
//   messages    — 对话消息数组，每条消息有 role 和 content
//                 role: 'user' 表示用户消息，'assistant' 表示助手消息
const response = await client.messages.create({
  // 模型名称：claude-sonnet-4-20250514
  // 这是 Anthropic 的中端模型，兼顾速度和智能
  model: 'claude-sonnet-4-20250514',

  // max_tokens 限制模型回复的最大长度
  // 1 个 token 大约对应 0.75 个英文单词，中文大约 1-2 个字
  // 1024 tokens 大约能生成 500-800 个中文字符
  max_tokens: 1024,

  // messages 是对话历史数组
  // 这里只有一条用户消息，是最简单的场景
  // 每条消息必须包含 role 和 content
  messages: [
    {
      role: 'user',        // 'user' 表示这是用户（人类）发送的消息
      content: 'Hello!'    // 消息内容，可以是字符串或复杂内容块
    }
  ],
});

// ---------------------------------------------------------------------------
// 3. 打印响应
// ---------------------------------------------------------------------------
// response 的结构大致如下：
// {
//   id: 'msg_xxx',              // 消息唯一 ID
//   type: 'message',            // 固定为 'message'
//   role: 'assistant',          // 固定为 'assistant'
//   content: [                   // 内容数组，可能包含多种类型
//     {
//       type: 'text',           // 文本类型的内容块
//       text: '你好！...'       // 实际的文本内容
//     }
//   ],
//   model: 'claude-sonnet-4-20250514',
//   stop_reason: 'end_turn',    // 停止原因：end_turn（正常结束）、max_tokens（达到上限）等
//   usage: {                     // token 使用统计
//     input_tokens: 10,
//     output_tokens: 50
//   }
// }
//
// 注意：content 是一个数组！因为模型的回复可能包含多种类型的内容块：
//   - type: 'text' — 普通文本
//   - type: 'tool_use' — 工具调用（后面步骤会学到）
//
// 通常文本回复只有一个 content 块，所以用 content[0].text 就能获取文本。
console.log('=== 完整响应结构 ===');
console.log(JSON.stringify(response, null, 2));

console.log('\n=== 只看回复文本 ===');
console.log(response.content[0].text);

console.log('\n=== Token 使用量 ===');
console.log(`输入 tokens: ${response.usage.input_tokens}`);
console.log(`输出 tokens: ${response.usage.output_tokens}`);

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * 初始化 Anthropic SDK 客户端
//   * 发送一条用户消息给 LLM
//   * 解析并打印 LLM 的文本回复
//   * 查看 token 使用量
//
// 下一步：step2-streaming.ts — 学习流式输出，让回复像打字一样逐字出现
// ---------------------------------------------------------------------------
