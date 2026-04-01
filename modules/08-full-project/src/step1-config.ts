/**
 * 模块 8 - Step 1: 配置管理
 *
 * 本文件实现多层级配置管理系统：
 * - Config 接口：定义所有配置项
 * - loadDotEnv：从 .env 文件加载
 * - loadFromEnv：从环境变量加载
 * - mergeConfig：按优先级合并
 * - validateConfig：校验配置合法性
 *
 * 配置优先级：CLI 参数 > 环境变量 > .env 文件 > 默认值
 */

import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

// ============================================================
// 配置接口定义
// ============================================================

/** 权限模式：控制工具的执行权限 */
export type PermissionMode = "ask" | "auto" | "readonly"

/** 运行模式：REPL 交互 or 无头单次执行 */
export type RunMode = "repl" | "headless"

/**
 * 核心配置接口
 *
 * 涵盖 API 密钥、模型选择、上下文窗口、权限模式等所有配置项
 */
export interface Config {
  /** API 密钥（Anthropic 或 OpenAI） */
  apiKey: string
  /** LLM 模型名称 */
  model: string
  /** 上下文窗口大小（Token 数） */
  contextWindow: number
  /** 最大输出 Token 数 */
  maxTokens: number
  /** 权限模式：ask(每次确认) | auto(自动执行) | readonly(只读) */
  permissionMode: PermissionMode
  /** 运行模式：repl(交互) | headless(无头) */
  runMode: RunMode
  /** 工作目录 */
  cwd: string
  /** 是否启用调试日志 */
  debug: boolean
  /** MCP 服务器配置 */
  mcpServers: Record<string, McpServerConfig>
  /** 无头模式的提示文本 */
  prompt?: string
}

/** MCP 服务器配置 */
export interface McpServerConfig {
  /** 启动命令 */
  command: string
  /** 命令参数 */
  args: string[]
  /** 环境变量 */
  env?: Record<string, string>
  /** 是否启用 */
  enabled: boolean
}

// ============================================================
// 默认配置
// ============================================================

/** 默认配置值 — 最低优先级 */
const DEFAULT_CONFIG: Partial<Config> = {
  model: "claude-sonnet-4-20250514",
  contextWindow: 200000,
  maxTokens: 4096,
  permissionMode: "ask",
  runMode: "repl",
  cwd: process.cwd(),
  debug: false,
  mcpServers: {},
}

// ============================================================
// 配置加载函数
// ============================================================

/**
 * 从 .env 文件加载配置
 *
 * 解析 KEY=VALUE 格式，跳过注释和空行
 * 优先级：高于默认值，低于环境变量
 */
export function loadDotEnv(filePath?: string): Record<string, string> {
  const envPath = filePath || resolve(process.cwd(), ".env")
  if (!existsSync(envPath)) return {}

  const content = readFileSync(envPath, "utf-8")
  const result: Record<string, string> = {}

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith("#")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    // 去除引号包裹
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  return result
}

/**
 * 从 process.env 读取配置
 *
 * 环境变量优先级高于 .env 文件
 */
export function loadFromEnv(): Partial<Config> {
  const config: Partial<Config> = {}

  if (process.env.ANTHROPIC_API_KEY) {
    config.apiKey = process.env.ANTHROPIC_API_KEY
  } else if (process.env.OPENAI_API_KEY) {
    config.apiKey = process.env.OPENAI_API_KEY
  }

  if (process.env.MODEL) config.model = process.env.MODEL
  if (process.env.CONTEXT_WINDOW) {
    config.contextWindow = parseInt(process.env.CONTEXT_WINDOW, 10)
  }
  if (process.env.MAX_TOKENS) {
    config.maxTokens = parseInt(process.env.MAX_TOKENS, 10)
  }
  if (process.env.PERMISSION_MODE) {
    config.permissionMode = process.env.PERMISSION_MODE as PermissionMode
  }
  if (process.env.DEBUG) {
    config.debug = process.env.DEBUG === "true" || process.env.DEBUG === "1"
  }

  return config
}

/**
 * CLI 参数覆盖
 *
 * CLI 参数具有最高优先级
 */
export function loadFromCli(cliArgs: Partial<Config>): Partial<Config> {
  const config: Partial<Config> = {}

  if (cliArgs.apiKey) config.apiKey = cliArgs.apiKey
  if (cliArgs.model) config.model = cliArgs.model
  if (cliArgs.contextWindow) config.contextWindow = cliArgs.contextWindow
  if (cliArgs.maxTokens) config.maxTokens = cliArgs.maxTokens
  if (cliArgs.permissionMode) config.permissionMode = cliArgs.permissionMode
  if (cliArgs.runMode) config.runMode = cliArgs.runMode
  if (cliArgs.cwd) config.cwd = cliArgs.cwd
  if (cliArgs.debug !== undefined) config.debug = cliArgs.debug
  if (cliArgs.prompt) config.prompt = cliArgs.prompt
  if (cliArgs.mcpServers) config.mcpServers = cliArgs.mcpServers

  return config
}

// ============================================================
// 配置合并与校验
// ============================================================

/**
 * 合并配置 — 按优先级从低到高依次覆盖
 *
 * 默认值 < .env 文件 < 环境变量 < CLI 参数
 */
export function mergeConfig(
  dotEnvPath?: string,
  cliArgs: Partial<Config> = {}
): Config {
  // 第 1 层：默认值
  const base = { ...DEFAULT_CONFIG }

  // 第 2 层：.env 文件
  const dotEnv = loadDotEnv(dotEnvPath)
  const dotEnvConfig: Partial<Config> = {}
  if (dotEnv.ANTHROPIC_API_KEY) dotEnvConfig.apiKey = dotEnv.ANTHROPIC_API_KEY
  if (dotEnv.OPENAI_API_KEY) dotEnvConfig.apiKey = dotEnv.OPENAI_API_KEY
  if (dotEnv.MODEL) dotEnvConfig.model = dotEnv.MODEL
  if (dotEnv.CONTEXT_WINDOW) {
    dotEnvConfig.contextWindow = parseInt(dotEnv.CONTEXT_WINDOW, 10)
  }

  // 第 3 层：环境变量
  const envConfig = loadFromEnv()

  // 第 4 层：CLI 参数
  const cliConfig = loadFromCli(cliArgs)

  // 按优先级合并
  return {
    ...base,
    ...dotEnvConfig,
    ...envConfig,
    ...cliConfig,
  } as Config
}

/**
 * 校验配置合法性
 *
 * 检查必填项和数据范围，返回错误列表
 */
export function validateConfig(config: Config): string[] {
  const errors: string[] = []

  // API Key 必填
  if (!config.apiKey) {
    errors.push("缺少 API Key。请设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY 环境变量")
  }

  // 模型名称不能为空
  if (!config.model) {
    errors.push("缺少模型名称。请设置 --model 或 MODEL 环境变量")
  }

  // 上下文窗口范围校验
  if (config.contextWindow < 1000 || config.contextWindow > 1000000) {
    errors.push(`上下文窗口 ${config.contextWindow} 超出合理范围 (1000-1000000)`)
  }

  // 最大输出 Token 范围校验
  if (config.maxTokens < 100 || config.maxTokens > 64000) {
    errors.push(`最大输出 Token ${config.maxTokens} 超出合理范围 (100-64000)`)
  }

  // 权限模式校验
  const validModes: PermissionMode[] = ["ask", "auto", "readonly"]
  if (!validModes.includes(config.permissionMode)) {
    errors.push(`无效的权限模式: ${config.permissionMode}，可选: ${validModes.join(", ")}`)
  }

  return errors
}

/**
 * 加载并校验配置的主入口
 *
 * 整合加载、合并、校验三个步骤
 */
export function loadConfig(cliArgs?: Partial<Config>): Config {
  const config = mergeConfig(undefined, cliArgs)
  const errors = validateConfig(config)

  if (errors.length > 0) {
    console.error("配置错误：")
    errors.forEach(e => console.error("  - " + e))
    process.exit(1)
  }

  return config
}
