/**
 * 模块 6 - Step 1: Agent 接口定义
 *
 * 本文件定义 Agent 的核心接口和类型，包括：
 * - AgentConfig: Agent 的配置信息
 * - AgentTool: 将 Agent 包装为可调用工具
 * - AgentResult: Agent 执行结果
 *
 * 理解这些接口是构建多 Agent 系统的基础。
 */

import { Anthropic } from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'

// ============================================================
// 类型定义
// ============================================================

/**
 * 权限模式 - 控制 Agent 可以执行的操作范围
 *
 * - read_only: 只读模式，只能读取文件、搜索代码
 * - read_write: 读写模式，可以读取和写入文件
 * - full: 完全模式，可以执行任何操作（慎用）
 */
export type PermissionMode = 'read_only' | 'read_write' | 'full'

/**
 * Agent 状态 - 反映 Agent 当前的生命周期
 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'timeout'

/**
 * 工具定义接口 - 来自 Module 2 的工具系统
 */
export interface Tool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute: (input: unknown) => Promise<unknown>
}

/**
 * Agent 配置接口 - 定义一个 Agent 的所有属性
 */
export interface AgentConfig {
  name: string
  description: string
  model: string
  systemPrompt: string
  tools: Tool[]
  permissionMode: PermissionMode
  maxExecutionTime?: number
  maxToolCalls?: number
}

/**
 * Agent 执行结果
 */
export interface AgentResult {
  id: string
  agentName: string
  status: AgentStatus
  output: string
  toolCalls: ToolCallRecord[]
  usage?: { inputTokens: number; outputTokens: number }
  error?: string
  duration: number
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  index: number
  tool: string
  input: unknown
  result: unknown
  duration: number
}

// ============================================================
// AgentTool 类
// ============================================================

/**
 * AgentTool - 将 Agent 包装为可调用的工具
 *
 * 这是 Claude Code 的核心设计模式：
 * 子 Agent 作为工具暴露给主 Agent，实现统一的抽象。
 */
export class AgentTool implements Tool {
  public readonly name: string
  public readonly description: string
  public readonly input_schema: Tool['input_schema']

  private readonly config: AgentConfig
  private readonly client: Anthropic

  constructor(config: AgentConfig) {
    this.config = config
    this.name = 'agent_' + config.name.toLowerCase().replace(/\s+/g, '_')
    this.description = config.description
    this.input_schema = {
      type: 'object',
      properties: {
        task: { type: 'string', description: '要执行的任务描述' },
        context: { type: 'object', description: '额外的上下文信息', properties: {}, required: [] }
      },
      required: ['task']
    }
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  /**
   * 执行 Agent
   */
  async execute(input: unknown): Promise<AgentResult> {
    const startTime = Date.now()
    const resultId = uuidv4()
    const typedInput = input as { task: string; context?: Record<string, unknown> }
    const task = typedInput.task
    const context = typedInput.context || {}

    const systemPrompt = this.buildSystemPrompt(context)
    const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
      { role: 'user', content: task }
    ]
    const toolCalls: ToolCallRecord[] = []
    let toolCallCount = 0
    const maxToolCalls = this.config.maxToolCalls || 50

    try {
      while (toolCallCount < maxToolCalls) {
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages as any,
          tools: this.config.tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema
          }))
        })

        messages.push({ role: 'assistant', content: response.content })

        const toolUses = response.content.filter((block: any) => block.type === 'tool_use')

        if (toolUses.length === 0) {
          const textContent = response.content.find((block: any) => block.type === 'text')
          return {
            id: resultId,
            agentName: this.config.name,
            status: 'completed',
            output: textContent?.text || '',
            toolCalls,
            duration: Date.now() - startTime
          }
        }

        for (const toolUse of toolUses) {
          toolCallCount++
          const toolStartTime = Date.now()
          const tool = this.config.tools.find(t => t.name === toolUse.name)
          if (!tool) throw new Error('Unknown tool: ' + toolUse.name)

          this.checkPermission(tool.name)
          const result = await tool.execute(toolUse.input)

          toolCalls.push({
            index: toolCallCount,
            tool: toolUse.name,
            input: toolUse.input,
            result,
            duration: Date.now() - toolStartTime
          })

          messages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: String(result) }]
          })
        }
      }

      return {
        id: resultId,
        agentName: this.config.name,
        status: 'failed',
        output: 'Maximum tool call limit reached',
        toolCalls,
        duration: Date.now() - startTime,
        error: 'Exceeded maximum tool call count'
      }
    } catch (error) {
      return {
        id: resultId,
        agentName: this.config.name,
        status: 'failed',
        output: '',
        toolCalls,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private buildSystemPrompt(context: Record<string, unknown>): string {
    const parts = [this.config.systemPrompt]
    parts.push('\n\n[权限模式: ' + this.config.permissionMode + ']')
    if (this.config.permissionMode === 'read_only') {
      parts.push('你只能读取文件和搜索代码，不能修改文件或执行命令。')
    }
    if (Object.keys(context).length > 0) {
      parts.push('\n\n[上下文信息]\n' + JSON.stringify(context, null, 2))
    }
    return parts.join('')
  }

  private checkPermission(toolName: string): void {
    const dangerousTools = ['shell_exec', 'delete_file', 'format_disk']
    if (dangerousTools.includes(toolName) && this.config.permissionMode === 'read_only') {
      throw new Error('Tool ' + toolName + ' is not allowed in read_only mode')
    }
  }
}

export function createAgentTool(config: AgentConfig): AgentTool {
  return new AgentTool(config)
}
