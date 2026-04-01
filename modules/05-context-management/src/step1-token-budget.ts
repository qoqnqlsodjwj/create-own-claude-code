// =============================================================================
// Step 1: Token 预算管理 — 计数、预算分配与状态报告
// =============================================================================
//
// 学习目标：
//   - 理解 Token 计数的启发式估算方法
//   - 掌握上下文窗口的预算分配策略
//   - 实现 checkBudget() 多级预算检查
//   - 生成格式化的 Token 使用报告
//
// 运行方式：
//   npx tsx src/step1-token-budget.ts
// =============================================================================

// ---------------------------------------------------------------------------
// 1. Token 估算函数
// ---------------------------------------------------------------------------
// 真实 Token 计数需要调用 tiktoken 等库，但启发式估算在多数场景下足够使用。
// 规则：ASCII 字符 ~0.25 token/字符，非 ASCII（如中文）~1.5 token/字符
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    // ASCII 字符（英文、数字、符号）大约 4 字符 = 1 token
    // 非 ASCII 字符（中文、日文等）大约 1 字符 = 1.5 token
    tokens += char.charCodeAt(0) < 128 ? 0.25 : 1.5;
  }
  return Math.ceil(tokens);
}

// ---------------------------------------------------------------------------
// 2. 预算检查结果类型
// ---------------------------------------------------------------------------
// checkBudget() 返回四种状态：
//   ok              — 一切正常，无需操作
//   remaining       — 接近阈值，报告剩余空间
//   shouldCompact   — 应该压缩上下文
//   emergencyCompact — 必须立即压缩，否则请求可能失败
type BudgetStatus = 'ok' | 'remaining' | 'shouldCompact' | 'emergencyCompact';

interface BudgetCheckResult {
  status: BudgetStatus;
  usedTokens: number;
  totalBudget: number;
  remainingTokens: number;
  usagePercent: number;
}

// ---------------------------------------------------------------------------
// 3. TokenBudgetManager 类
// ---------------------------------------------------------------------------
// 管理上下文窗口的 Token 预算分配
// Claude Code 的策略：contextWindow - reservedOutput - buffer = 可用输入空间
class TokenBudgetManager {
  private contextWindow: number;   // 上下文窗口总大小（如 200K）
  private reservedOutput: number;  // 为模型输出预留的 token 数
  private buffer: number;          // 安全缓冲区，防止溢出

  constructor(
    contextWindow: number = 200_000,
    reservedOutput: number = 16_000,
    buffer: number = 13_000,
  ) {
    this.contextWindow = contextWindow;
    this.reservedOutput = reservedOutput;
    this.buffer = buffer;
  }

  // 可用于输入的最大 token 数
  // = 总窗口 - 输出预留 - 安全缓冲
  get maxInputTokens(): number {
    return this.contextWindow - this.reservedOutput - this.buffer;
  }

  // 检查当前 token 用量是否在预算内
  // 返回多级状态，方便调用方决定后续动作
  checkBudget(usedTokens: number): BudgetCheckResult {
    const maxInput = this.maxInputTokens;
    const remaining = maxInput - usedTokens;
    const usagePercent = (usedTokens / maxInput) * 100;

    // 判断状态：根据使用百分比分级
    let status: BudgetStatus;
    if (usagePercent >= 95) {
      status = 'emergencyCompact';  // 紧急：>= 95%
    } else if (usagePercent >= 80) {
      status = 'shouldCompact';     // 应该压缩：>= 80%
    } else if (usagePercent >= 60) {
      status = 'remaining';         // 注意：>= 60%
    } else {
      status = 'ok';                // 正常
    }

    return { status, usedTokens, totalBudget: maxInput, remainingTokens: remaining, usagePercent };
  }

  // 生成格式化的使用报告
  getReport(usedTokens: number): string {
    const result = this.checkBudget(usedTokens);
    const barWidth = 30;
    const filled = Math.round((result.usagePercent / 100) * barWidth);
    const bar = '|'.repeat(filled) + '-'.repeat(barWidth - filled);

    const lines = [
      '=== Token 预算报告 ===',
      `窗口总量 : ${this.contextWindow.toLocaleString()} tokens`,
      `输出预留 : ${this.reservedOutput.toLocaleString()} tokens`,
      `安全缓冲 : ${this.buffer.toLocaleString()} tokens`,
      `可用输入 : ${result.totalBudget.toLocaleString()} tokens`,
      `已使用   : ${result.usedTokens.toLocaleString()} tokens (${result.usagePercent.toFixed(1)}%)`,
      `剩余     : ${result.remainingTokens.toLocaleString()} tokens`,
      `[${bar}] ${result.usagePercent.toFixed(0)}%`,
      `状态     : ${result.status}`,
      '=====================',
    ];
    return lines.join('\n');
  }
}

// ---------------------------------------------------------------------------
// 4. 演示
// ---------------------------------------------------------------------------
function demo() {
  const manager = new TokenBudgetManager();

  console.log('=== Token 预算管理演示 ===\n');

  // 测试估算函数
  const samples = [
    'Hello, world!',                                    // 纯 ASCII
    '你好，世界！这是一个测试。',                          // 纯中文
    'Read file src/step1-token-budget.ts successfully',  // 模拟工具结果
    '这是一个混合 mixed 字符串 with 中文 and English.',     // 混合
  ];

  console.log('--- Token 估算 ---');
  for (const text of samples) {
    console.log(`  "${text.substring(0, 30)}..." => ~${estimateTokens(text)} tokens`);
  }

  // 模拟不同使用量的预算检查
  console.log('\n--- 预算检查 ---');
  const scenarios = [
    { label: '对话初期', tokens: 5_000 },
    { label: '对话中期', tokens: 90_000 },
    { label: '需要压缩', tokens: 140_000 },
    { label: '紧急压缩', tokens: 165_000 },
  ];

  for (const s of scenarios) {
    const result = manager.checkBudget(s.tokens);
    console.log(`  ${s.label} (${s.tokens.toLocaleString()} tokens) => ${result.status} (剩余 ${result.remainingTokens.toLocaleString()})`);
  }

  // 完整报告
  console.log('\n' + manager.getReport(90_000));
}

demo();

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * 启发式 Token 估算（ASCII vs 非 ASCII 的不同权重）
//   * 上下文窗口的预算分配：总量 - 输出预留 - 安全缓冲
//   * 多级预算检查：ok / remaining / shouldCompact / emergencyCompact
//   * 格式化报告生成
//
// 关键设计：
//   * 不依赖 tiktoken，用启发式估算即可满足大部分需求
//   * 多级状态让调用方能做出渐进式决策
//
// 下一步：step2-context-window.ts — 上下文窗口管理与消息截断
// ---------------------------------------------------------------------------
