/**
 * 模块 8 - Step 4: 主入口
 *
 * 本文件是整个 AI 编程助手的启动入口：
 * - Commander 命令行解析
 * - 初始化序列（配置 → LLM Provider → 工具池 → 系统提示）
 * - REPL 交互模式启动
 * - 无头模式（单次执行）
 * - 信号处理（SIGINT / SIGTERM 优雅关闭）
 *
 * 这是整个项目的 "总调度"
 */

import { Command } from "commander"
import { createInterface } from "readline"
import { loadConfig, type Config } from "./step1-config"
import {
  getBuiltinTools,
  getMcpTools,
  assembleToolPool,
  getToolPoolSummary,
  type ToolDefinition,
} from "./step2-tool-pool"
import { buildSystemPrompt } from "./step3-system-prompt"

// ============================================================
// 版本信息
// ============================================================

const VERSION = "1.0.0"
const APP_NAME = "create-own-claude-code"

// ============================================================
// 命令行解析
// ============================================================

/**
 * 解析命令行参数
 *
 * 使用 Commander.js 定义所有支持的选项
 */
function parseCliArgs(): Config & { headless?: boolean } {
  const program = new Command()

  program
    .name(APP_NAME)
    .description("从零构建的 AI 编程助手")
    .version(VERSION)
    .option("-m, --model <model>", "LLM 模型名称")
    .option("--api-key <key>", "API 密钥")
    .option("--context-window <number>", "上下文窗口大小", parseInt)
    .option("--max-tokens <number>", "最大输出 Token 数", parseInt)
    .option("-p, --permission <mode>", "权限模式: ask | auto | readonly")
    .option("--cwd <path>", "工作目录")
    .option("--debug", "启用调试日志")
    .option("-r, --repl", "启动交互模式（默认）")
    .option("--prompt <text>", "无头模式：直接执行提示")
    .option("--headless", "无头模式（需配合 --prompt）")

  program.parse()
  const opts = program.opts()

  return {
    apiKey: opts.apiKey,
    model: opts.model,
    contextWindow: opts.contextWindow,
    maxTokens: opts.maxTokens,
    permissionMode: opts.permission,
    runMode: opts.headless || opts.prompt ? "headless" : "repl",
    cwd: opts.cwd || process.cwd(),
    debug: opts.debug || false,
    prompt: opts.prompt,
    mcpServers: {},
  } as Config & { headless?: boolean }
}

// ============================================================
// 初始化序列
// ============================================================

/** 应用状态 — 初始化后持有所有核心组件 */
interface AppState {
  config: Config
  tools: ToolDefinition[]
  systemPrompt: string
}

/**
 * 执行初始化序列
 *
 * 按固定顺序初始化所有组件：
 * 1. 加载配置
 * 2. 组装工具池
 * 3. 构建系统提示
 *
 * 这是整个应用的启动核心
 */
async function initialize(cliArgs: Partial<Config> = {}): Promise<AppState> {
  console.log("正在初始化...")

  // 步骤 1：加载配置
  console.log("  [1/3] 加载配置...")
  const config = loadConfig(cliArgs)

  // 步骤 2：组装工具池
  console.log("  [2/3] 组装工具池...")
  const builtinTools = getBuiltinTools()
  const mcpTools = await getMcpTools(config.mcpServers)
  const tools = assembleToolPool(builtinTools, mcpTools)

  if (config.debug) {
    console.log(getToolPoolSummary(tools))
  }

  // 步骤 3：构建系统提示
  console.log("  [3/3] 构建系统提示...")
  const systemPrompt = buildSystemPrompt(config, tools)

  console.log("初始化完成！\n")

  return { config, tools, systemPrompt }
}

// ============================================================
// REPL 交互模式
// ============================================================

/**
 * 启动 REPL 交互循环
 *
 * 不断读取用户输入，发送给 LLM，展示响应
 * 支持 Ctrl+C 中断当前请求
 */
async function startRepl(state: AppState): Promise<void> {
  console.log(`欢迎使用 ${APP_NAME} v${VERSION}`)
  console.log(`模型: ${state.config.model}`)
  console.log(`输入你的问题，按 Enter 发送。输入 /exit 退出。\n`)

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  })

  // 中断状态跟踪
  let interrupted = false
  let interruptCount = 0

  // 模拟 LLM 调用（实际项目中会连接 Anthropic/OpenAI API）
  const queryLLM = async (userMessage: string): Promise<string> => {
    if (interrupted) return "[已中断]"

    // 模拟流式输出
    const lines = [
      `收到你的问题: "${userMessage}"`,
      "",
      "系统提示预览（前 200 字符）:",
      state.systemPrompt.slice(0, 200) + "...",
      "",
      `当前工具池: ${state.tools.length} 个工具`,
      `可用工具: ${state.tools.map(t => t.name).join(", ")}`,
      "",
      "[注意] 这是模块 8 的集成演示。实际运行需要连接 LLM API。",
      "请参考模块 1 (LLM API 通信) 实现真实的 API 调用。",
    ]

    let result = ""
    for (const line of lines) {
      if (interrupted) break
      result += line + "\n"
      process.stdout.write(line + "\n")
      // 模拟流式延迟
      await new Promise(r => setTimeout(r, 50))
    }

    return result
  }

  rl.prompt()

  rl.on("line", async (input) => {
    const trimmed = input.trim()

    // 命令处理
    if (trimmed === "/exit" || trimmed === "/quit") {
      console.log("再见！")
      rl.close()
      return
    }

    if (trimmed === "/help") {
      console.log("可用命令:")
      console.log("  /exit   — 退出程序")
      console.log("  /help   — 显示帮助")
      console.log("  /tools  — 显示工具列表")
      console.log("  /config — 显示当前配置")
      rl.prompt()
      return
    }

    if (trimmed === "/tools") {
      console.log(getToolPoolSummary(state.tools))
      rl.prompt()
      return
    }

    if (trimmed === "/config") {
      console.log(JSON.stringify(state.config, null, 2))
      rl.prompt()
      return
    }

    if (!trimmed) {
      rl.prompt()
      return
    }

    // 重置中断状态
    interrupted = false
    interruptCount = 0

    // 发送给 LLM
    await queryLLM(trimmed)
    console.log("")
    rl.prompt()
  })

  rl.on("close", () => {
    console.log("\n会话结束。")
    process.exit(0)
  })
}

// ============================================================
// 无头模式
// ============================================================

/**
 * 无头模式 — 执行单条指令后退出
 *
 * 适用于脚本集成和 CI/CD 场景
 */
async function runHeadless(state: AppState): Promise<void> {
  if (!state.config.prompt) {
    console.error("错误：无头模式需要 --prompt 参数")
    process.exit(1)
  }

  // 模拟执行
  console.log(`[无头模式] 执行: ${state.config.prompt}`)
  console.log(`[模型] ${state.config.model}`)
  console.log(`[工具] ${state.tools.length} 个可用`)
  console.log("")

  // 在实际项目中，这里会调用 LLM API 并输出结果
  console.log("执行完成。（模块 8 集成演示）")
  process.exit(0)
}

// ============================================================
// 信号处理
// ============================================================

/**
 * 注册信号处理器
 *
 * SIGINT (Ctrl+C):
 *   第一次 → 中断当前操作
 *   第二次 → 保存并退出
 *
 * SIGTERM → 优雅关闭
 */
function setupSignalHandlers(): void {
  let interruptCount = 0

  process.on("SIGINT", () => {
    interruptCount++

    if (interruptCount === 1) {
      console.log("\n\n按 Ctrl+C 再次退出，或继续输入...")
    } else {
      console.log("\n正在关闭...")
      gracefulShutdown()
    }
  })

  process.on("SIGTERM", () => {
    console.log("\n收到 SIGTERM，正在关闭...")
    gracefulShutdown()
  })

  process.on("uncaughtException", (error) => {
    console.error("未捕获的异常:", error)
    gracefulShutdown(1)
  })
}

/** 优雅关闭 */
function gracefulShutdown(exitCode = 0): void {
  // 在实际项目中，这里会：
  // 1. 保存对话历史到文件
  // 2. 关闭 MCP 服务器连接
  // 3. 清理临时文件
  console.log("清理完成。再见！")
  process.exit(exitCode)
}

// ============================================================
// 主入口
// ============================================================

/**
 * 程序入口
 *
 * 解析参数 → 初始化 → 选择模式 → 运行
 */
async function main(): Promise<void> {
  // 注册信号处理
  setupSignalHandlers()

  try {
    // 解析 CLI 参数
    const cliArgs = parseCliArgs()

    // 初始化所有组件
    const state = await initialize(cliArgs)

    // 选择运行模式
    if (state.config.runMode === "headless") {
      await runHeadless(state)
    } else {
      await startRepl(state)
    }
  } catch (error) {
    console.error("启动失败:", error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// 启动！
main()
