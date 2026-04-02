<div align="center">

# 🛠️ Create Your Own Claude Code

**从零构建你自己的 AI 编程助手**

[![GitHub Stars](https://img.shields.io/github/stars/v2ish1yan/create-own-claude-code?style=social)](https://github.com/v2ish1yan/create-own-claude-code/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/v2ish1yan/create-own-claude-code?style=social)](https://github.com/v2ish1yan/create-own-claude-code/network/members)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/v2ish1yan/create-own-claude-code/pulls)

> **8 Modules** | **52 Files** | **11,756 Lines of Code** | **3 Languages Supported**

[中文](README.md) | [English](README_EN.md) | [日本語](README_JA.md)

---

</div>

## 🎯 这个项目是什么？

你是否好奇 **Claude Code**、**Cursor**、**Copilot CLI** 这类 AI 编程助手是如何工作的？

本项目是一个 **手把手教学项目**，通过 **8 个递进式模块**，带你从零开始构建一个完整的终端 AI 编程助手——从 LLM API 调用到完整的 Agent 系统。

> 💡 **核心理念**：每个模块都包含可运行的代码、详细的中文注释和练习题。80% 写代码，20% 读文档。

<details>
<summary>📖 适合谁？</summary>

- 有一定 Node.js / TypeScript 基础的前端或全栈开发者
- 对 AI 应用开发感兴趣，想深入理解底层机制的学习者
- 想构建自己的 AI 编程工具或工作流的工程师
- 正在准备 AI 相关技术面试，需要系统级实践经验的候选人

</details>

<details>
<summary>🎁 你将获得什么？</summary>

- 深入理解 AI 编程助手的核心架构与实现细节
- 一个自己构建的、可扩展的终端 AI 编程工具
- 对 Tool Calling、Streaming、Agent 等概念的实战经验
- 可用于简历或作品集的完整项目

</details>

---

## ✨ 功能特性

<table>
<tr>
<td width="50%">

### 🔄 流式对话
与 LLM 进行实时流式对话，打字机效果输出，支持多轮工具调用

</td>
<td width="50%">

### 🔧 工具系统
文件读写、Shell 执行、代码搜索等工具，支持权限控制与参数校验

</td>
</tr>
<tr>
<td width="50%">

### 🎨 终端 UI
基于 Ink (React) 构建的终端界面，消息气泡、流式显示、交互控件

</td>
<td width="50%">

### 🧠 上下文管理
Token 预算分配、上下文压缩、滑动窗口、记忆系统 (CLAUDE.md)

</td>
</tr>
<tr>
<td width="50%">

### 🤖 Agent 系统
子 Agent 调度、多智能体协作、任务编排与并行执行

</td>
<td width="50%">

### 🔌 MCP 集成
Model Context Protocol 协议集成，动态发现与注册外部工具

</td>
</tr>
</table>

---

## 🏗️ 架构总览

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

## 📚 学习路线图

```
01-LLM通信 ← 02-工具系统 ← 03-REPL循环 ← 04-终端UI
                                                    ↓
               06-Agent系统 ← 08-完整集成 ← 05-上下文管理
                    ↑
               07-MCP集成 ────────────→ 08-完整集成
```

| 模块 | 主题 | 难度 | 关键技术 |
|:----:|------|:----:|----------|
| 01 | [LLM 通信基础](./modules/01-llm-basics/) | ⭐⭐ | SSE Streaming, Tool Calling, Chat Completion |
| 02 | [工具系统设计](./modules/02-tool-system/) | ⭐⭐⭐ | Tool Interface, Registry, JSON Schema, Permissions |
| 03 | [REPL 交互循环](./modules/03-repl-loop/) | ⭐⭐⭐ | REPL Loop, QueryEngine, Conversation History |
| 04 | [终端 UI (Ink)](./modules/04-terminal-ui/) | ⭐⭐⭐⭐ | Ink, React for Terminal, Yoga Layout |
| 05 | [上下文管理与压缩](./modules/05-context-management/) | ⭐⭐⭐⭐ | Token Budget, Compaction, Memory System |
| 06 | [Agent 与多智能体系统](./modules/06-agent-system/) | ⭐⭐⭐⭐⭐ | Sub-agent, Swarm Pattern, Task Orchestration |
| 07 | [MCP 协议集成](./modules/07-mcp-integration/) | ⭐⭐⭐⭐ | MCP Client/Server, Dynamic Tool Discovery |
| 08 | [完整项目集成](./modules/08-full-project/) | ⭐⭐⭐⭐⭐ | System Integration, E2E Testing, Optimization |

> 📅 详细学习计划见 [docs/roadmap.md](./docs/roadmap.md) — 建议每天 1-2 小时，8 周完成

---

## 🚀 Quick Start

```bash
# 1. 克隆项目
git clone https://github.com/v2ish1yan/create-own-claude-code.git
cd create-own-claude-code

# 2. 安装依赖
npm install

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 API Key
# ANTHROPIC_API_KEY=sk-ant-xxxxx

# 4. 从 Module 1 开始学习
cd modules/01-llm-basics
npx tsx src/step1-simple-call.ts
```

<details>
<summary>📋 前置要求</summary>

- **Node.js 18+** — 本项目基于 Node.js 运行时
- **TypeScript** — 核心代码使用 TypeScript 编写
- **React 基础** — Module 4 使用 React 构建终端 UI
- **API Key** — 至少拥有一个 LLM Provider 的 API Key（推荐 Anthropic Claude）
- **命令行基础** — 熟悉终端操作与 Shell 命令

```bash
node -v     # v18.0.0 或更高
npm -v      # v9.0.0 或更高
```

</details>

---

## 📂 项目结构

```
create-own-claude-code/
├── README.md                    # 项目说明
├── README_EN.md                 # English README
├── README_JA.md                 # 日本語 README
├── docs/
│   └── roadmap.md               # 详细学习路线图 (8 周计划)
├── modules/
│   ├── 01-llm-basics/           # Module 1: LLM 通信基础
│   │   ├── README.md            #   模块说明与学习指南
│   │   ├── exercises.md         #   练习题
│   │   └── src/                 #   可运行的示例代码
│   ├── 02-tool-system/          # Module 2: 工具系统设计
│   ├── 03-repl-loop/            # Module 3: REPL 交互循环
│   ├── 04-terminal-ui/          # Module 4: 终端 UI (Ink)
│   ├── 05-context-management/   # Module 5: 上下文管理
│   ├── 06-agent-system/         # Module 6: Agent 系统
│   ├── 07-mcp-integration/      # Module 7: MCP 协议集成
│   └── 08-full-project/         # Module 8: 完整项目集成
├── .env.example                 # 环境变量模板
├── package.json
└── LICENSE                      # MIT License
```

---

## 📖 参考资源

<details>
<summary>📚 官方文档</summary>

- [Anthropic API Documentation](https://docs.anthropic.com/) — Claude API 官方文档
- [OpenAI API Reference](https://platform.openai.com/docs) — GPT 系列模型 API 文档
- [Ink - React for CLI](https://github.com/vadimdemedes/ink) — 终端 React 渲染框架
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP 协议官方规范

</details>

<details>
<summary>🔧 开源参考项目</summary>

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 官方 AI 编程助手
- [Aider](https://github.com/paul-gauthier/aider) — 开源 AI 结对编程工具
- [Continue](https://github.com/continuedev/continue) — 开源 AI 代码助手
- [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter) — 开源代码解释器
- [Cline](https://github.com/cline/cline) — VS Code 中的自主编码 Agent

</details>

<details>
<summary>💡 学习建议</summary>

1. **先运行** — 每步代码都可以独立运行，先跑通看效果
2. **再修改** — 改参数看变化，理解每个参数的作用
3. **然后理解** — 读注释和 README，理解原理
4. **最后挑战** — 完成 exercises.md 中的练习题

如果时间不够，可以按以下顺序削减模块：
1. 模块 4 (终端 UI) — 可以用 console.log 替代
2. 模块 6 (Agent 系统) — 单 Agent 也能用
3. 模块 7 (MCP) — 内置工具足够使用

</details>

---

## ⭐ Star History

如果这个项目对你有帮助，欢迎给个 Star！

[![Star History Chart](https://api.star-history.com/svg?repos=v2ish1yan/create-own-claude-code&type=Date)](https://star-history.com/#v2ish1yan/create-own-claude-code&Date)

---

## 📄 License

[MIT](./LICENSE) © 2025 v2ish1yan

本项目仅供学习与参考，欢迎 Star ⭐、Fork 🍴 与 PR 🔀。
