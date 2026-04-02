<div align="center">

# 🛠️ Create Your Own Claude Code

**Build your own AI coding assistant from scratch**

[![GitHub Stars](https://img.shields.io/github/stars/v2ish1yan/create-own-claude-code?style=social)](https://github.com/v2ish1yan/create-own-claude-code/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/v2ish1yan/create-own-claude-code/pulls)

[中文](README.md) | [English](README_EN.md) | [日本語](README_JA.md)

---

</div>

## 🎯 What is this project?

Have you ever wondered how AI coding assistants like **Claude Code**, **Cursor**, or **Copilot CLI** work under the hood?

This is a **hands-on tutorial project** that walks you through building a complete terminal-based AI coding assistant through **8 progressive modules** — from LLM API calls to a full Agent system.

> 💡 **Core Philosophy**: Every module includes runnable code, detailed comments, and exercises. 80% coding, 20% reading.

<details>
<summary>📖 Who is this for?</summary>

- Frontend or full-stack developers with basic Node.js / TypeScript experience
- Learners interested in AI application development who want to understand the internals
- Engineers who want to build their own AI coding tools or workflows
- Candidates preparing for AI-related technical interviews who need hands-on system-level experience

</details>

<details>
<summary>🎁 What will you gain?</summary>

- Deep understanding of AI coding assistant architecture and implementation details
- A self-built, extensible terminal AI coding tool
- Hands-on experience with Tool Calling, Streaming, Agent concepts
- A complete project suitable for your resume or portfolio

</details>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔄 Streaming Conversation
Real-time streaming dialogue with LLM, typewriter-style output, multi-turn tool calling

</td>
<td width="50%">

### 🔧 Tool System
File read/write, shell execution, code search tools with permission control & parameter validation

</td>
</tr>
<tr>
<td width="50%">

### 🎨 Terminal UI
Terminal interface built with Ink (React), message bubbles, streaming display, interactive controls

</td>
<td width="50%">

### 🧠 Context Management
Token budget allocation, context compaction, sliding window, memory system (CLAUDE.md)

</td>
</tr>
<tr>
<td width="50%">

### 🤖 Agent System
Sub-agent dispatch, multi-agent collaboration, task orchestration & parallel execution

</td>
<td width="50%">

### 🔌 MCP Integration
Model Context Protocol integration, dynamic tool discovery & registration

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLI Entry                          │
│                   (bin/cli.ts)                          │
│            CLI argument parsing & startup               │
├─────────────────────────────────────────────────────────┤
│                      UI Layer                           │
│              (ink + React Terminal UI)                  │
│     Terminal rendering / Message bubbles / Streaming    │
├─────────────────────────────────────────────────────────┤
│                     Tool System                         │
│           (Tool Registry & Pipeline)                    │
│   Registration / Validation / Execution / Formatting    │
├─────────────────────────────────────────────────────────┤
│                    Service Layer                        │
│          (Agent / Context / Conversation)               │
│   Conversation / Context compaction / Agent / MCP       │
├─────────────────────────────────────────────────────────┤
│                   Infrastructure                        │
│        (LLM Provider / File System / Shell)             │
│     API communication / File ops / Process management   │
└─────────────────────────────────────────────────────────┘

         Data Flow:  User Input → REPL Loop → LLM API
                          ↑                      ↓
                    Tool Result ← Tool Execution
```

---

## 📚 Learning Roadmap

```
01-LLM Comm ← 02-Tool System ← 03-REPL Loop ← 04-Terminal UI
                                                       ↓
              06-Agent System ← 08-Integration ← 05-Context Mgmt
                    ↑
              07-MCP Protocol ───────────→ 08-Integration
```

| Module | Topic | Difficulty | Key Technologies |
|:------:|-------|:----------:|------------------|
| 01 | [LLM API Communication](./modules/01-llm-api/) | ⭐⭐ | SSE Streaming, Tool Calling, Chat Completion |
| 02 | [Tool System Design](./modules/02-tool-system/) | ⭐⭐⭐ | Tool Interface, Registry, JSON Schema, Permissions |
| 03 | [REPL Interactive Loop](./modules/03-repl-loop/) | ⭐⭐⭐ | REPL Loop, QueryEngine, Conversation History |
| 04 | [Terminal UI (Ink)](./modules/04-terminal-ui/) | ⭐⭐⭐⭐ | Ink, React for Terminal, Yoga Layout |
| 05 | [Context Management](./modules/05-context-management/) | ⭐⭐⭐⭐ | Token Budget, Compaction, Memory System |
| 06 | [Agent & Multi-Agent System](./modules/06-agent-system/) | ⭐⭐⭐⭐⭐ | Sub-agent, Swarm Pattern, Task Orchestration |
| 07 | [MCP Protocol Integration](./modules/07-mcp-protocol/) | ⭐⭐⭐⭐ | MCP Client/Server, Dynamic Tool Discovery |
| 08 | [Full Project Integration](./modules/08-integration/) | ⭐⭐⭐⭐⭐ | System Integration, E2E Testing, Optimization |

> 📅 See [docs/roadmap.md](./docs/roadmap.md) for the detailed 8-week study plan — recommended 1-2 hours per day

---

## 🚀 Quick Start

```bash
# 1. Clone the project
git clone https://github.com/v2ish1yan/create-own-claude-code.git
cd create-own-claude-code

# 2. Install dependencies
npm install

# 3. Configure API Key
cp .env.example .env
# Edit .env and fill in your API Key
# ANTHROPIC_API_KEY=sk-ant-xxxxx

# 4. Start from Module 1
cd modules/01-llm-api
npx tsx src/step1-hello-api.ts
```

<details>
<summary>📋 Prerequisites</summary>

- **Node.js 18+** — This project runs on Node.js runtime
- **TypeScript** — Core code is written in TypeScript
- **React Basics** — Module 4 uses React to build terminal UI
- **API Key** — At least one LLM Provider API Key (Anthropic Claude recommended)
- **CLI Basics** — Familiarity with terminal operations and Shell commands

```bash
node -v     # v18.0.0 or higher
npm -v      # v9.0.0 or higher
```

</details>

---

## 📂 Project Structure

```
create-own-claude-code/
├── README.md                    # Project documentation (Chinese)
├── README_EN.md                 # English README
├── README_JA.md                 # Japanese README
├── docs/
│   └── roadmap.md               # Detailed learning roadmap (8-week plan)
├── modules/
│   ├── 01-llm-api/              # Module 1: LLM API Communication
│   │   ├── README.md            #   Module guide & learning instructions
│   │   ├── exercises.md         #   Exercises
│   │   └── src/                 #   Runnable example code
│   ├── 02-tool-system/          # Module 2: Tool System Design
│   ├── 03-repl-loop/            # Module 3: REPL Interactive Loop
│   ├── 04-terminal-ui/          # Module 4: Terminal UI (Ink)
│   ├── 05-context-management/   # Module 5: Context Management
│   ├── 06-agent-system/         # Module 6: Agent System
│   ├── 07-mcp-protocol/         # Module 7: MCP Protocol Integration
│   └── 08-integration/          # Module 8: Full Project Integration
├── .env.example                 # Environment variable template
├── package.json
└── LICENSE                      # MIT License
```

---

## 📖 References

<details>
<summary>📚 Official Documentation</summary>

- [Anthropic API Documentation](https://docs.anthropic.com/) — Claude API official docs
- [OpenAI API Reference](https://platform.openai.com/docs) — GPT series model API docs
- [Ink - React for CLI](https://github.com/vadimdemedes/ink) — Terminal React rendering framework
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP protocol official specification

</details>

<details>
<summary>🔧 Open Source References</summary>

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic's official AI coding assistant
- [Aider](https://github.com/paul-gauthier/aider) — Open source AI pair programming tool
- [Continue](https://github.com/continuedev/continue) — Open source AI code assistant
- [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter) — Open source code interpreter
- [Cline](https://github.com/cline/cline) — Autonomous coding agent in VS Code

</details>

<details>
<summary>💡 Learning Tips</summary>

1. **Run first** — Every step's code can run independently; run it to see the effect
2. **Modify next** — Change parameters to see how they affect the output
3. **Understand then** — Read comments and READMEs to understand the principles
4. **Challenge last** — Complete exercises in exercises.md

If you're short on time, you can skip modules in this order:
1. Module 4 (Terminal UI) — can be replaced with console.log
2. Module 6 (Agent System) — single agent works fine
3. Module 7 (MCP) — built-in tools are sufficient

</details>

---

## ⭐ Star History

If this project helps you, please consider giving it a Star!

[![Star History Chart](https://api.star-history.com/svg?repos=v2ish1yan/create-own-claude-code&type=Date)](https://star-history.com/#v2ish1yan/create-own-claude-code&Date)

---

## 📄 License

[MIT](./LICENSE) © 2025 v2ish1yan

This project is for learning and reference purposes. Stars ⭐, Forks 🍴, and PRs 🔀 are welcome!
