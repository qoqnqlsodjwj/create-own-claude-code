/**
 * 模块 6 - Step 2: 启动子 Agent
 *
 * 本文件展示两种启动子 Agent 的方式：
 * 1. 进程内 Agent - 使用 AsyncLocalStorage 实现隔离
 * 2. 子进程 Agent - 使用 child_process.spawn 实现完全隔离
 */

import { spawn, ChildProcess } from "child_process"
import { AsyncLocalStorage } from "async_hooks"
import { EventEmitter } from "events"
import { AgentConfig, AgentResult, AgentStatus } from "./step1-agent-interface"

// 进程内 Agent（AsyncLocalStorage 隔离）
interface AgentContext {
  agentId: string
  agentName: string
  startTime: number
  parentAgentId?: string
  metadata: Record<string, unknown>
}

const agentStorage = new AsyncLocalStorage<AgentContext>()

/**
 * 进程内 Agent 类 - 在当前进程内运行，使用 AsyncLocalStorage 实现隔离
 */
export class InProcessAgent {
  public readonly id: string
  public readonly config: AgentConfig
  public status: AgentStatus = "idle"

  constructor(config: AgentConfig) {
    this.id = "agent_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    this.config = config
  }

  async execute(task: string, parentAgentId?: string): Promise<AgentResult> {
    const startTime = Date.now()
    this.status = "running"
    try {
      const result = await agentStorage.run(
        { agentId: this.id, agentName: this.config.name, startTime, parentAgentId, metadata: {} },
        () => this.runAgentLoop(task)
      )
      this.status = "completed"
      return result
    } catch (error) {
      this.status = "failed"
      return { id: this.id, agentName: this.config.name, status: "failed", output: "", toolCalls: [], duration: Date.now() - startTime, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async runAgentLoop(task: string): Promise<AgentResult> {
    const ctx = agentStorage.getStore()
    console.log("[Agent " + ctx?.agentName + "] Starting task")
    await this.simulateWork()
    return { id: this.id, agentName: this.config.name, status: "completed", output: "Task completed", toolCalls: [], duration: Date.now() - (ctx?.startTime || Date.now()) }
  }

  private async simulateWork(): Promise<void> {
    const ctx = agentStorage.getStore()
    for (let i = 0; i < 3; i++) {
      console.log("[Agent " + ctx?.agentName + "] Step " + (i + 1))
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  static getCurrentContext(): AgentContext | undefined {
    return agentStorage.getStore()
  }
}

// 子进程 Agent（完全隔离）
interface IPCMessage {
  type: "init" | "execute" | "result" | "error" | "progress"
  id: string
  payload: unknown
}

class IPCSender {
  constructor(private proc: ChildProcess) {}
  send(msg: IPCMessage): void {
    if (this.proc.stdin) this.proc.stdin.write(JSON.stringify(msg) + "
")
  }
}

class IPCReceiver extends EventEmitter {
  private buffer = ""
  constructor(private proc: ChildProcess) {
    super()
    this.proc.stdout?.on("data", (data: Buffer) => {
      this.buffer += data.toString()
      const lines = this.buffer.split("
")
      this.buffer = lines.pop() || ""
      for (const line of lines) {
        if (line.trim()) {
          try { this.emit("message", JSON.parse(line) as IPCMessage) }
          catch { console.error("Failed to parse IPC message") }
        }
      }
    })
  }
}

export interface SpawnAgentOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  debug?: boolean
}

/**
 * 子进程 Agent 类 - 在独立进程中运行，完全隔离
 */
export class SpawnAgent {
  private proc?: ChildProcess
  private sender?: IPCSender
  private receiver?: IPCReceiver
  private pending = new Map<string, { resolve: (v: AgentResult) => void; reject: (e: Error) => void; timeout: NodeJS.Timeout }>()

  public readonly id: string
  public readonly config: AgentConfig
  public status: AgentStatus = "idle"
  private readonly options: SpawnAgentOptions

  constructor(config: AgentConfig, options: SpawnAgentOptions = {}) {
    this.id = "spawn_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    this.config = config
    this.options = { timeout: 300000, debug: false, ...options }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.proc = spawn("node", ["agent-worker.js"], {
        cwd: this.options.cwd || process.cwd(),
        env: { ...process.env, ...this.options.env },
        stdio: ["pipe", "pipe", "pipe"]
      })
      this.sender = new IPCSender(this.proc)
      this.receiver = new IPCReceiver(this.proc)
      this.receiver.on("message", msg => this.handleMessage(msg))
      this.proc.on("error", err => { console.error("[SpawnAgent] Error:", err); this.rejectAll(err) })
      this.proc.on("exit", code => { console.log("[SpawnAgent] Exit:", code); this.status = "exited"; this.rejectAll(new Error("Process exited")) })
      setTimeout(() => { this.status = "ready"; resolve() }, 100)
    })
  }

  async execute(task: string): Promise<AgentResult> {
    if (!this.sender) throw new Error("Agent not started")
    return new Promise((resolve, reject) => {
      const reqId = "req_" + Date.now()
      const timeout = setTimeout(() => { this.pending.delete(reqId); reject(new Error("Timeout")) }, this.options.timeout)
      this.pending.set(reqId, { resolve, reject, timeout })
      this.sender!.send({ type: "execute", id: reqId, payload: { task, config: this.config } })
    })
  }

  private handleMessage(msg: IPCMessage): void {
    const p = this.pending.get(msg.id)
    if (p) {
      clearTimeout(p.timeout)
      this.pending.delete(msg.id)
      if (msg.type === "error") p.reject(new Error(msg.payload as string))
      else {
        const payload = msg.payload as any
        p.resolve({ id: this.id, agentName: this.config.name, status: payload.status, output: payload.output, toolCalls: [], duration: 0, error: payload.error })
      }
    }
  }

  private rejectAll(err: Error): void {
    for (const p of this.pending.values()) { clearTimeout(p.timeout); p.reject(err) }
    this.pending.clear()
  }

  terminate(): void {
    if (this.proc) { this.proc.kill("SIGTERM"); this.proc = undefined; this.sender = undefined; this.receiver = undefined }
    this.status = "idle"
  }
}

/**
 * Agent 池 - 管理多个 Agent 实例
 */
export class AgentPool {
  private agents: SpawnAgent[] = []
  private available: SpawnAgent[] = []
  private readonly maxSize: number
  private readonly factory: () => AgentConfig

  constructor(factory: () => AgentConfig, maxSize: number = 5) {
    this.factory = factory
    this.maxSize = maxSize
  }

  async initialize(): Promise<void> {
    for (let i = 0; i < this.maxSize; i++) {
      const agent = new SpawnAgent(this.factory())
      await agent.start()
      this.agents.push(agent)
      this.available.push(agent)
    }
  }

  async acquire(): Promise<SpawnAgent> {
    if (this.available.length === 0) {
      if (this.agents.length < this.maxSize) {
        const agent = new SpawnAgent(this.factory())
        await agent.start()
        this.agents.push(agent)
        return agent
      }
      await new Promise(r => setTimeout(r, 100))
      return this.acquire()
    }
    return this.available.pop()!
  }

  release(agent: SpawnAgent): void {
    if (agent.status === "ready" && !this.available.includes(agent)) this.available.push(agent)
  }

  async shutdown(): Promise<void> {
    for (const a of this.agents) a.terminate()
    this.agents = []
    this.available = []
  }
}
