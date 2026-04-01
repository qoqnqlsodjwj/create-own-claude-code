// =============================================================================
// Step 2: SSE 流式输出（Streaming）
// =============================================================================
//
// 学习目标：
//   - 理解 SSE（Server-Sent Events）的工作原理
//   - 使用 stream() API 替代 create() 实现流式响应
//   - 处理不同类型的流式事件（delta、start、stop）
//   - 实时逐字输出模型的回复
//
// 运行方式：
//   npx tsx src/step2-streaming.ts
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// 初始化客户端（和 step1 一样）
// ---------------------------------------------------------------------------
const client = new Anthropic();

// ---------------------------------------------------------------------------
// 使用 stream() 方法进行流式调用
// ---------------------------------------------------------------------------
// stream() 和 create() 的参数完全一样，唯一区别是：
//   - create() — 等待模型生成完毕，一次性返回完整响应
//   - stream() — 立即返回一个流对象，通过事件逐块接收数据
//
// 底层区别：
//   - create() — 普通 HTTP 请求-响应
//   - stream() — HTTP 请求，但响应是 SSE 格式（Content-Type: text/event-stream）
const stream = client.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      // 用一个需要较长回复的 prompt，这样能更明显地看到流式效果
      content: '请用三段话介绍 TypeScript 的优势。',
    },
  ],
});

// ---------------------------------------------------------------------------
// 方式一：使用 on() 事件监听（细粒度控制）
// ---------------------------------------------------------------------------
// 流式响应会产生多种事件，我们可以监听每种事件：

// message_start — 消息开始，包含消息的元信息（model、usage 等）
stream.on('message_start', (event) => {
  console.log('--- 消息开始 ---');
  console.log(`模型: ${event.message.model}`);
});

// content_block_start — 一个新的内容块开始
stream.on('content_block_start', (event) => {
  if (event.content_block.type === 'text') {
    console.log('\n--- 文本内容开始 ---');
  }
});

// content_block_delta — 内容增量，这是最重要的！
// 每收到一个 delta 事件，就多了一小段文本
// 这就是"打字机效果"的核心 -- 逐字逐词地输出
stream.on('content_block_delta', (event) => {
  if (event.delta.type === 'text_delta') {
    // delta.text 就是这一小段的文本（可能是一个字、一个词、或几个字）
    // 直接用 process.stdout.write 而不是 console.log，避免换行
    process.stdout.write(event.delta.text);
  }
});

// content_block_stop — 当前内容块结束
stream.on('content_block_stop', () => {
  console.log('\n--- 内容块结束 ---');
});

// message_delta — 消息级别的更新（如 stop_reason 变化）
stream.on('message_delta', (event) => {
  console.log(`\n停止原因: ${event.delta.stop_reason}`);
});

// message_stop — 整个消息结束
stream.on('message_stop', () => {
  console.log('\n--- 消息结束 ---');
});

// ---------------------------------------------------------------------------
// 等待流结束，获取完整的消息对象
// ---------------------------------------------------------------------------
// stream.finalMessage() 返回一个 Promise，在流结束后 resolve
const finalMessage = await stream.finalMessage();

console.log('\n\n=== 最终消息的 token 使用量 ===');
console.log(`输入 tokens: ${finalMessage.usage.input_tokens}`);
console.log(`输出 tokens: ${finalMessage.usage.output_tokens}`);

// ---------------------------------------------------------------------------
// 方式二：使用 for-await-of 迭代（更简洁）
// ---------------------------------------------------------------------------
async function streamingWithForAwait() {
  console.log('\n\n=== 使用 for-await-of 的方式 ===\n');

  const stream2 = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: '用一句话说明什么是 SSE。',
      },
    ],
  });

  // 直接迭代流中的每一个事件
  for await (const event of stream2) {
    switch (event.type) {
      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          process.stdout.write(event.delta.text);
        }
        break;
    }
  }

  console.log('\n');
}

await streamingWithForAwait();

// ---------------------------------------------------------------------------
// 流式 vs 非流式对比
// ---------------------------------------------------------------------------
// | 方面         | create() 非流式         | stream() 流式             |
// |-------------|------------------------|--------------------------|
// | 响应时间      | 等待全部生成完才返回      | 第一个 token 几乎立即到达   |
// | 用户体验      | 需要等待                | 像打字一样逐字出现          |
// | 内存占用      | 一次性加载完整响应        | 增量处理，内存更友好        |
// | 代码复杂度    | 简单                    | 稍复杂，需要处理事件        |
// | 适用场景      | 后台任务、短回复          | 聊天界面、长文本生成        |
//
// 在 Claude Code 这样的交互式工具中，流式输出是必须的 --
// 用户需要实时看到 Claude 正在"思考"和"打字"。
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * 使用 stream() API 进行流式调用
//   * 监听各种 SSE 事件（message_start、content_block_delta 等）
//   * 实时逐字输出文本
//   * 使用 for-await-of 迭代流事件
//   * 理解流式和非流式的区别
//
// 下一步：step3-tool-calling.ts — 学习工具调用，让 LLM 能够执行操作
// ---------------------------------------------------------------------------
