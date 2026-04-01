// =============================================================================
// Step 4: 记忆系统 — CLAUDE.md 长期记忆的读写与注入
// =============================================================================
//
// 学习目标：
//   - 理解 CLAUDE.md 文件格式与作用
//   - 实现项目级记忆的加载与解析
//   - 将记忆注入系统提示词
//   - 支持记忆的动态更新
//
// 运行方式：
//   npx tsx src/step4-memory-system.ts
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// 1. CLAUDE.md 格式定义
// ---------------------------------------------------------------------------
// CLAUDE.md 是 Claude Code 的长期记忆文件，使用 Markdown 格式。
// 放置位置：
//   - 项目根目录的 CLAUDE.md  → 项目级记忆（代码风格、项目约定）
//   - .claude/CLAUDE.md        → 用户级记忆（个人偏好、常用操作）
//
// 典型内容结构：
//
// # Project: My App
//
// ## 代码风格
// - 使用 TypeScript strict 模式
// - 中文注释
//
// ## 项目约定
// - 测试文件放在 tests/ 目录
// - 使用 pnpm 作为包管理器
//
// ## 常见任务
// - 构建命令: pnpm build
// - 测试命令: pnpm test

interface MemoryEntry {
  filePath: string;     // 记忆文件路径
  content: string;      // 文件内容
  size: number;         // 文件大小（字节）
  loadedAt: number;     // 加载时间戳
}

// ---------------------------------------------------------------------------
// 2. MemoryManager 类
// ---------------------------------------------------------------------------
// 管理 CLAUDE.md 记忆文件的加载、解析和注入
class MemoryManager {
  private memories: MemoryEntry[] = [];
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  // -----------------------------------------------------------------------
  // loadProjectMemory() — 从 CLAUDE.md 加载项目记忆
  // -----------------------------------------------------------------------
  // 按优先级加载多个位置的 CLAUDE.md 文件
  loadProjectMemory(): void {
    this.memories = [];

    // 按优先级排列的记忆文件路径
    const memoryPaths = [
      path.join(this.projectRoot, 'CLAUDE.md'),           // 项目级
      path.join(this.projectRoot, '.claude', 'CLAUDE.md'), // 用户级
    ];

    for (const filePath of memoryPaths) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.memories.push({
          filePath,
          content,
          size: Buffer.byteLength(content, 'utf-8'),
          loadedAt: Date.now(),
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // getCombinedMemory() — 获取合并后的记忆文本
  // -----------------------------------------------------------------------
  getCombinedMemory(): string {
    return this.memories
      .map((m, i) => {
        const label = path.relative(this.projectRoot, m.filePath);
        return `<!-- 记忆文件: ${label} -->\n${m.content}`;
      })
      .join('\n\n');
  }

  // -----------------------------------------------------------------------
  // injectIntoSystemPrompt() — 将记忆注入系统提示
  // -----------------------------------------------------------------------
  // 系统提示词的典型结构：
  //   [基础角色描述]
  //   [CLAUDE.md 记忆内容]  <-- 记忆注入在这里
  //   [工具使用说明]
  injectIntoSystemPrompt(basePrompt: string): string {
    if (this.memories.length === 0) {
      return basePrompt;
    }

    const memorySection = this.getCombinedMemory();
    const injection = [
      '',
      '=== 项目记忆 (CLAUDE.md) ===',
      '以下是项目的长期记忆，请在回答时参考这些信息：',
      '',
      memorySection,
      '',
      '=== 项目记忆结束 ===',
      '',
    ].join('\n');

    return basePrompt + injection;
  }

  // -----------------------------------------------------------------------
  // saveProjectMemory() — 保存项目记忆到 CLAUDE.md
  // -----------------------------------------------------------------------
  saveProjectMemory(content: string, targetPath?: string): void {
    const filePath = targetPath || path.join(this.projectRoot, 'CLAUDE.md');
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    // 重新加载以更新内存
    this.loadProjectMemory();
  }

  // 获取已加载的记忆数量
  getMemoryCount(): number {
    return this.memories.length;
  }

  // 获取记忆的总大小
  getTotalSize(): number {
    return this.memories.reduce((sum, m) => sum + m.size, 0);
  }

  // 打印记忆摘要
  printSummary(): void {
    console.log('\n=== 记忆系统状态 ===');
    console.log(`项目根目录: ${this.projectRoot}`);
    console.log(`已加载记忆: ${this.memories.length} 个文件`);
    for (const m of this.memories) {
      const rel = path.relative(this.projectRoot, m.filePath);
      console.log(`  - ${rel} (${m.size} 字节)`);
    }
    console.log(`总大小: ${this.getTotalSize()} 字节`);
    console.log('===================\n');
  }
}

// ---------------------------------------------------------------------------
// 3. 演示
// ---------------------------------------------------------------------------
function demo() {
  console.log('=== 记忆系统演示 ===\n');

  // 使用临时目录演示
  const tempDir = path.join(process.cwd(), '.demo-memory-temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const manager = new MemoryManager(tempDir);

  // 创建一个示例 CLAUDE.md
  const sampleMemory = `# Project: Demo App

## 代码风格
- 使用 TypeScript strict 模式
- 中文注释
- 缩进使用 2 个空格

## 项目约定
- 测试文件放在 tests/ 目录
- 使用 pnpm 作为包管理器
- 提交前运行 pnpm lint

## 常见任务
- 构建命令: pnpm build
- 测试命令: pnpm test
`;

  manager.saveProjectMemory(sampleMemory);
  console.log('已创建示例 CLAUDE.md 文件\n');

  // 重新加载
  manager.loadProjectMemory();
  manager.printSummary();

  // 注入到系统提示
  const basePrompt = '你是一个专业的编程助手。请用中文回答问题。';
  const enhancedPrompt = manager.injectIntoSystemPrompt(basePrompt);

  console.log('--- 注入后的系统提示（前 500 字符）---');
  console.log(enhancedPrompt.substring(0, 500));
  console.log('...\n');

  // 清理临时文件
  const tempFile = path.join(tempDir, 'CLAUDE.md');
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  console.log('(已清理临时文件)');
}

demo();

// ---------------------------------------------------------------------------
// 小结
// ---------------------------------------------------------------------------
// 你已经学会了：
//   * CLAUDE.md 的格式定义和放置规则
//   * loadProjectMemory() 从多个位置加载记忆文件
//   * injectIntoSystemPrompt() 将记忆注入系统提示词
//   * 记忆的动态更新与保存
//
// 关键设计：
//   * 记忆分为项目级和用户级，支持多个 CLAUDE.md 文件
//   * 注入位置在系统提示词末尾，确保 LLM 优先参考
//   * 每次对话开始时重新加载，保证记忆是最新的
//
// 这也是模块 5 的最后一个步骤。回顾整个模块：
//   step1 → Token 预算管理（计数与分配）
//   step2 → 上下文窗口管理（监控与截断）
//   step3 → 摘要压缩（LLM 生成摘要替换历史）
//   step4 → 记忆系统（CLAUDE.md 长期记忆）
// ---------------------------------------------------------------------------
