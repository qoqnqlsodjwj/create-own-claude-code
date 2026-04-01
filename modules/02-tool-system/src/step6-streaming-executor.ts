import type { Tool, ToolContext, ToolResult } from "./step1-tool-interface"
import { ToolRegistry, buildTool } from "./step1-tool-interface"

export interface ToolCall { id: string; name: string; input: unknown }
export interface ToolEvent { type: string; toolCallId: string; toolName: string; data?: any; timestamp: number }

export class StreamingToolExecutor {
  constructor(private registry: ToolRegistry, private parallel = false) {}

  async *execute(calls: ToolCall[], ctx: ToolContext): AsyncGenerator<ToolEvent> {
    if (this.parallel) {
      const ps = calls.map(c => this.executeOne(c, ctx))
      const rs = await Promise.allSettled(ps)
      for (const r of rs) if (r.status === "fulfilled") yield* r.value
    } else {
      for (const c of calls) yield* this.executeOne(c, ctx)
    }
  }

  private async *executeOne(call: ToolCall, ctx: ToolContext): AsyncGenerator<ToolEvent> {
    yield { type: "start", toolCallId: call.id, toolName: call.name, timestamp: Date.now() }
    try {
      const tool = this.registry.get(call.name)
      if (!tool) throw new Error(`未找到工具: ${call.name}`)
      const result = await tool.call(call.input, ctx)
      yield { type: "result", toolCallId: call.id, toolName: call.name, data: { result }, timestamp: Date.now() }
    } catch (e) {
      yield { type: "error", toolCallId: call.id, toolName: call.name, data: { error: String(e) }, timestamp: Date.now() }
    }
    yield { type: "complete", toolCallId: call.id, toolName: call.name, timestamp: Date.now() }
  }
}

export function eventToSSE(event: ToolEvent): string {
  return `event: tool_${event.type}\ndata: ${JSON.stringify({ toolCallId: event.toolCallId, toolName: event.toolName, ...event.data })}\n\n`
}

export async function executeBatch(calls: ToolCall[], ctx: ToolContext, parallel = false) {
  const exec = new StreamingToolExecutor(new ToolRegistry(), parallel)
  const results = new Map<string, ToolResult>()
  for await (const event of exec.execute(calls, ctx)) {
    if (event.type === "result" && event.data?.result) results.set(event.toolCallId, event.data.result)
  }
  return results
}

async function demo() {
  console.log("Step 6: 流式执行器演示")
  
  const registry = new ToolRegistry()
  registry.register(buildTool({
    name: "echo",
    description: "回显",
    input_schema: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] },
    async execute(i) { return { type: "success", content: `Echo: ${(i as any).msg}` } }
  }))

  const exec = new StreamingToolExecutor(registry, false)
  const calls: ToolCall[] = [
    { id: "1", name: "echo", input: { msg: "Hello" } },
    { id: "2", name: "echo", input: { msg: "World" } }
  ]
  const ctx: ToolContext = { permissionMode: "acceptEdits" }

  console.log("\n串行执行:")
  for await (const e of exec.execute(calls, ctx)) {
    console.log(`  [${e.type}] ${e.toolName}:`, e.data)
  }

  const batch = new StreamingToolExecutor(registry, true)
  console.log("\n并行执行:")
  for await (const e of batch.execute(calls, ctx)) {
    console.log(`  [${e.type}] ${e.toolName}`)
  }
}
demo().catch(console.error)
