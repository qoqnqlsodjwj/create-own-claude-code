/**
 * 模块 2 - Step 1: 核心工具接口
 *
 * 本文件定义了 Claude Code 工具系统的核心接口和类型。
 * 参考 Claude Code 源码中的 Tool.ts 设计。
 */

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 工具规范（ToolSpec）
 *
 * 用于 LLM 理解工具的用途和参数格式。
 * 这个规范会被传给 LLM API，让模型知道：
 * - 工具叫什么名字
 * - 工具是做什么的
 * - 需要传什么参数
 */
export interface ToolSpec {
  name: string                    // 工具唯一标识，如 "read"、"write"
  description: string             // 工具描述，帮助 LLM 决定何时使用
  input_schema: object           // JSON Schema，定义输入参数格式
}

/**
 * 工具上下文（ToolContext）
 *
 * 包含工具执行时需要的环境信息。
 * 这些信息来自系统配置和用户设置。
 */
export interface ToolContext {
  // 允许访问的目录列表，用于安全检查
  allowedDirectories?: string[]

  // 权限模式：
  // - default: 默认模式，需要用户确认
  // - acceptEdits: 允许编辑操作
  // - bypassPermissions: 绕过权限检查（CI 模式）
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions'

  // 是否是自动模式
  isAutoMode?: boolean

  // 工作目录
  workingDirectory?: string
}

/**
 * 工具执行结果（ToolResult）
 *
 * 所有工具执行后返回统一格式的结果。
 * 无论是成功还是失败，都使用这个结构。
 */
export interface ToolResult {
  // 结果类型：成功或错误
  type: 'success' | 'error'

  // 结果内容（文本形式，因为 LLM 只能处理文本）
  content: string

  // 可选：结果是否被截断（防止输出过长）
  truncated?: boolean

  // 可选：错误信息
  error?: string
}

// ============================================================================
// 核心工具接口
// ============================================================================

/**
 * 工具接口（Tool）
 *
 * 这是 Claude Code 工具系统的核心抽象。
 * 所有工具都必须实现这个接口，确保一致性。
 *
 * 设计理念：
 * - spec() 方法返回工具的元信息，用于 LLM 理解
 * - call() 方法执行工具逻辑，返回标准化结果
 */
export interface Tool {
  /**
   * 返回工具规范
   *
   * 这个方法返回的信息会传给 LLM，让它理解：
   * - 工具叫什么
   * - 工具做什么
   * - 需要什么参数
   */
  spec(): ToolSpec

  /**
   * 执行工具
   *
   * @param input - LLM 生成的参数（根据 input_schema 格式）
   * @param context - 执行上下文（权限、目录等信息）
   * @returns Promise<ToolResult> - 标准化执行结果
   */
  call(input: unknown, context: ToolContext): Promise<ToolResult>
}

// ============================================================================
// 工具配置与工厂函数
// ============================================================================

/**
 * 工具配置接口
 *
 * 用于简化工具创建过程。
 * 使用 buildTool 工厂函数时传入这个配置。
 */
export interface ToolConfig {
  name: string                    // 工具名称
  description: string            // 工具描述
  input_schema: object           // 输入参数 schema
  execute: (input: unknown, context: ToolContext) => Promise<ToolResult>  // 执行函数
}

/**
 * buildTool 工厂函数
 *
 * 提供一种简便的方式创建工具。
 * 只需提供配置对象，不需要手动实现整个 Tool 接口。
 */
export function buildTool(config: ToolConfig): Tool {
  return {
    spec() {
      return {
        name: config.name,
        description: config.description,
        input_schema: config.input_schema,
      }
    },
    async call(input: unknown, context: ToolContext) {
      return config.execute(input, context)
    },
  }
}

// ============================================================================
// 工具注册表
// ============================================================================

/**
 * 工具注册表（ToolRegistry）
 *
 * 管理所有已注册的工具。
 * 这是工具系统的"电话簿"：
 * - 注册工具：register()
 * - 查找工具：get()
 * - 列出工具：list()
 * - 检查存在：has()
 */
export class ToolRegistry {
  // 内部存储：工具名称 -> 工具实例的映射
  private tools: Map<string, Tool> = new Map()

  /**
   * 注册工具
   */
  register(tool: Tool): void {
    const spec = tool.spec()
    if (this.tools.has(spec.name)) {
      throw new Error(`工具 "${spec.name}" 已存在，不能重复注册`)
    }
    this.tools.set(spec.name, tool)
    console.log(`[注册表] 已注册工具: ${spec.name}`)
  }

  /**
   * 根据名称获取工具
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * 列出所有已注册的工具
   */
  list(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 获取所有工具的规范列表
   */
  getToolSpecs(): ToolSpec[] {
    return this.list().map(tool => tool.spec())
  }

  /**
   * 检查指定名称的工具是否已注册
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 移除工具
   */
  unregister(name: string): boolean {
    const deleted = this.tools.delete(name)
    if (deleted) {
      console.log(`[注册表] 已移除工具: ${name}`)
    }
    return deleted
  }

  /**
   * 获取已注册工具的数量
   */
  get size(): number {
    return this.tools.size
  }
}

// ============================================================================
// 演示代码
// ============================================================================

async function demo() {
  console.log('='.repeat(60))
  console.log('Step 1: 核心工具接口演示')
  console.log('='.repeat(60))

  // 创建注册表
  const registry = new ToolRegistry()

  // 使用 buildTool 工厂函数创建工具
  const echoTool = buildTool({
    name: 'echo',
    description: '回显输入的文字，常用于测试',
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: '要回显的消息'
        }
      },
      required: ['message']
    },
    async execute(input, _context) {
      const { message } = input as { message: string }
      return {
        type: 'success',
        content: `Echo: ${message}`
      }
    }
  })

  // 注册工具
  registry.register(echoTool)

  // 列出所有工具规范
  console.log('\n已注册工具的规范（传给 LLM）:')
  const specs = registry.getToolSpecs()
  specs.forEach(spec => {
    console.log(`\n  - ${spec.name}: ${spec.description}`)
  })

  // 获取并执行工具
  console.log('\n' + '-'.repeat(60))
  console.log('执行 echo 工具:')

  const tool = registry.get('echo')
  if (tool) {
    const result = await tool.call(
      { message: 'Hello, Tool System!' },
      { permissionMode: 'default' }
    )
    console.log(`  结果类型: ${result.type}`)
    console.log(`  结果内容: ${result.content}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('演示完成！')
}

// 运行演示
demo().catch(console.error)
