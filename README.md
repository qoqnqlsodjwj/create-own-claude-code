# 🛠️ Create Your Own Claude Code

> 从零构建你自己的 AI 编程助手

你是否好奇 Claude Code、Cursor、Copilot CLI 这类 AI 编程助手是如何工作的？本项目将带你一步步拆解并实现一个类 Claude Code 的终端 AI 编程助手，从 LLM API 调用到完整的 Agent 系统。

## 这个项目是什么？

这是一个**手把手教学项目**，通过 8 个递进式模块，带你从零开始构建一个具备以下能力的 AI 编程助手：

- 与 LLM 进行流式对话
- 调用文件读写、代码搜索、Shell 执行等工具
- 在终端中呈现美观的交互式 UI
- 管理超长上下文与对话历史
- 支持多智能体协作完成复杂任务
- 通过 MCP 协议动态扩展能力

### 适合谁？

- 有一定 Node.js / TypeScript 基础的前端或全栈开发者
- 对 AI 应用开发感兴趣，想深入理解底层机制的学习者
- 想构建自己的 AI 编程工具或工作流的工程师
- 正在准备 AI 相关技术面试，需要系统级实践经验的候选人

### 你将获得什么？

- 深入理解 AI 编程助手的核心架构与实现细节
- 一个自己构建的、可扩展的终端 AI 编程工具
- 对 Tool Calling、Streaming、Agent 等概念的实战经验
- 可用于简历或作品集的完整项目

---

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                      CLI Entry                          │
│                   (bin/cli.ts)                          │
│              命令行参数解析 & 启动入口                    │
├─────────────────────────────────────────────────────────┤
│                      UI Layer                           │
│              (ink + React Terminal UI)                  │
│         终端渲染 / 消息气泡 / 流式输出 / 交互控件         │
├─────────────────────────────────────────────────────────┤
│                     Tool System                         │
│           (Tool Registry & Pipeline)                    │
│      工具注册 / 参数校验 / 执行调度 / 结果格式化          │
├─────────────────────────────────────────────────────────┤
│                    Service Layer                        │
│          (Agent / Context / Conversation)               │
│    对话管理 / 上下文压缩 / Agent 编排 / MCP 集成          │
├─────────────────────────────────────────────────────────┤
│                   Infrastructure                        │
│        (LLM Provider / File System / Shell)             │
│     API 通信 / 文件操作 / 进程管理 / 配置存储             │
└─────────────────────────────────────────────────────────┘

         数据流:  User Input → REPL Loop → LLM API
                       ↑                      ↓
                  Tool Result ← Tool Execution
```

---

## 学习路线图

### Module 1: LLM API 通信基础

- **学习内容**: 掌握与 LLM API 通信的核心技术，包括 SSE (Server-Sent Events) 流式传输、Tool Calling 协议、多 Provider 适配
- **关键概念**: Streaming SSE、Chat Completion API、Tool Calling、Function Calling、Provider Abstraction
- **难度**: ⭐⭐
- **目录**: [modules/01-llm-api](./modules/01-llm-api/)

### Module 2: 工具系统设计

- **学习内容**: 设计可扩展的工具系统，包括工具接口定义、注册中心、执行管线、参数校验与结果处理
- **关键概念**: Tool Interface、Tool Registry、Execution Pipeline、JSON Schema Validation、Permission Control
- **难度**: ⭐⭐⭐
- **目录**: [modules/02-tool-system](./modules/02-tool-system/)

### Module 3: REPL 交互循环

- **学习内容**: 构建终端交互循环，包括查询处理、上下文管理、对话历史的持久化与恢复
- **关键概念**: REPL Loop、Query Processing、Context Management、Conversation History、Interruption Handling
- **难度**: ⭐⭐⭐
- **目录**: [modules/03-repl-loop](./modules/03-repl-loop/)

### Module 4: 终端 UI (Ink)

- **学习内容**: 使用 Ink 框架构建终端 UI，掌握 React 在终端中的渲染原理与 Yoga 布局引擎
- **关键概念**: Ink Framework、React for Terminal、Yoga Layout Engine、Message Rendering、Streaming Output Display
- **难度**: ⭐⭐⭐⭐
- **目录**: [modules/04-terminal-ui](./modules/04-terminal-ui/)

### Module 5: 上下文管理与压缩

- **学习内容**: 解决 LLM 上下文窗口限制问题，实现上下文压缩、记忆管理与智能截断策略
- **关键概念**: Context Window、Token Counting、Context Compaction、Memory Management、Sliding Window
- **难度**: ⭐⭐⭐⭐
- **目录**: [modules/05-context-management](./modules/05-context-management/)

### Module 6: Agent 与多智能体系统

- **学习内容**: 构建智能体系统，包括 Sub-agent 调度、Swarm 协作模式、任务编排与并行执行
- **关键概念**: Agent Architecture、Sub-agent、Swarm Pattern、Task Orchestration、Parallel Execution、Agent Communication
- **难度**: ⭐⭐⭐⭐⭐
- **目录**: [modules/06-agent-system](./modules/06-agent-system/)

### Module 7: MCP 协议集成

- **学习内容**: 集成 Model Context Protocol，实现工具的动态发现与注册，扩展系统能力边界
- **关键概念**: Model Context Protocol (MCP)、Tool Discovery、Dynamic Registration、Protocol Buffers、Server-Sent Events
- **难度**: ⭐⭐⭐⭐
- **目录**: [modules/07-mcp-protocol](./modules/07-mcp-protocol/)

### Module 8: 完整项目集成

- **学习内容**: 将前面所有模块整合为一个完整的、可运行的 AI 编程助手，进行端到端测试与优化
- **关键概念**: System Integration、End-to-End Testing、Performance Optimization、Error Recovery、User Experience
- **难度**: ⭐⭐⭐⭐⭐
- **目录**: [modules/08-integration](./modules/08-integration/)

---

## 前置要求

在开始之前，请确保你具备以下条件：

- **Node.js 18+** — 本项目基于 Node.js 运行时
- **TypeScript** — 核心代码使用 TypeScript 编写，需要熟悉基本类型系统
- **React 基础** — Module 4 使用 React 构建终端 UI
- **API Key** — 至少拥有一个 LLM Provider 的 API Key（推荐 Anthropic Claude 或 OpenAI）
- **命令行基础** — 熟悉终端操作与 Shell 命令
- **Git** — 用于版本管理与项目组织

推荐开发环境：

```bash
node -v     # v18.0.0 或更高
npm -v      # v9.0.0 或更高
tsc -v      # TypeScript 5.x
```

---

## Quick Start

```bash
# 1. 克隆项目
git clone https://github.com/your-username/create-own-claude-code.git
cd create-own-claude-code

# 2. 安装依赖
npm install

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 API Key
# ANTHROPIC_API_KEY=sk-ant-xxxxx
# 或
# OPENAI_API_KEY=sk-xxxxx

# 4. 从 Module 1 开始学习
cd modules/01-llm-api
npm run dev

# 5. 或直接运行完整项目
npm run start
```

---

## 项目结构

```
create-own-claude-code/
├── README.md                    # 项目说明（你正在看的这个文件）
├── docs/
│   └── roadmap.md               # 详细学习路线图
├── modules/
│   ├── 01-llm-api/              # Module 1: LLM API 通信基础
│   │   ├── README.md
│   │   ├── src/
│   │   └── exercises/
│   ├── 02-tool-system/          # Module 2: 工具系统设计
│   │   ├── README.md
│   │   ├── src/
│   │   └── exercises/
│   ├── 03-repl-loop/            # Module 3: REPL 交互循环
│   │   ├── README.md
│   │   ├── src/
│   │   └── exercises/
│   ├── 04-terminal-ui/          # Module 4: 终端 UI (Ink)
│   │   ├── README.md
│   │   ├── src/
│   │   └── exercises/
│   ├── 05-context-management/   # Module 5: 上下文管理与压缩
│   │   ├── README.md
│   │   ├── src/
│   │   └── exercises/
│   ├── 06-agent-system/         # Module 6: Agent 与多智能体系统
│   │   ├── README.md
│   │   ├── src/
│   │   └── exercises/
│   ├── 07-mcp-protocol/         # Module 7: MCP 协议集成
│   │   ├── README.md
│   │   ├── src/
│   │   └── exercises/
│   └── 08-integration/          # Module 8: 完整项目集成
│       ├── README.md
│       ├── src/
│       └── exercises/
├── packages/
│   ├── core/                    # 核心库：LLM 通信、工具系统
│   ├── cli/                     # CLI 入口
│   ├── ui/                      # 终端 UI 组件
│   └── utils/                   # 通用工具函数
├── .env.example                 # 环境变量模板
├── package.json
├── tsconfig.json
└── LICENSE                      # MIT License
```

---

## 参考资源

### 官方文档

- [Anthropic API Documentation](https://docs.anthropic.com/) — Claude API 官方文档，包括 Streaming 与 Tool Calling
- [OpenAI API Reference](https://platform.openai.com/docs) — GPT 系列模型 API 文档
- [Ink - React for CLI](https://github.com/vadimdemedes/ink) — 终端 React 渲染框架
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP 协议官方规范

### 教程与文章

- [Build a CLI with Node.js](https://nodejs.org/en/learn/command-line-apps) — Node.js 官方 CLI 构建教程
- [Understanding Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) — MDN SSE 文档
- [React for CLI — How Ink Works](https://github.com/vadimdemedes/ink/blob/main/readme.md) — Ink 工作原理
- [Yoga Layout Engine](https://yogalayout.com/) — Yoga 布局引擎文档

### 开源参考项目

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 官方 AI 编程助手
- [Aider](https://github.com/paul-gauthier/aider) — 开源 AI 结对编程工具
- [Continue](https://github.com/continuedev/continue) — 开源 AI 代码助手
- [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter) — 开源代码解释器

---

## License

[MIT](./LICENSE)

本项目仅供学习与参考，欢迎 Star、Fork 与 PR。
