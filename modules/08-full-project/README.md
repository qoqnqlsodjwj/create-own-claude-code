# 模块 08: 完整项目集成

## 学习目标

恭喜你来到了最后一个模块！通过本模块，你将掌握以下核心知识：

1. **系统整合** — 将前面 7 个模块的成果组装为一个完整的、可运行的 AI 编程助手
2. **配置管理** — 理解多层级配置合并（CLI 参数 > 环境变量 > .env 文件 > 默认值）
3. **工具池组装** — 统一管理内置工具与 MCP 外部工具，实现去重与排序
4. **系统提示构建** — 动态注入上下文信息（日期、工作目录、Git 状态、CLAUDE.md 记忆）
5. **主入口设计** — Commander 命令行解析、初始化序列、REPL/无头双模式启动
6. **信号处理** — 优雅关闭、中断恢复与错误兜底

---

## 前置准备

### 回顾：8 个模块的知识地图

```
模块 1: LLM API 通信基础
  └─ SSE 流式传输、Tool Calling、Provider 抽象
模块 2: 工具系统设计
  └─ Tool 接口、注册中心、执行管线、权限控制
模块 3: REPL 交互循环
  └─ 查询处理、上下文管理、对话持久化
模块 4: 终端 UI (Ink)
  └─ React 终端渲染、Yoga 布局、流式输出显示
模块 5: 上下文管理与压缩
  └─ Token 计算、滑动窗口、上下文压缩、记忆管理
模块 6: Agent 与多智能体系统
  └─ Agent 接口、Sub-agent 调度、Swarm 协作
模块 7: MCP 协议集成
  └─ MCP 服务器/客户端、动态发现、工具注册
模块 8: 完整项目集成 ← 你在这里
  └─ 配置管理、工具池、系统提示、主入口、端到端运行
```

### 本模块结构

```
08-full-project/
├── README.md                       # 本文件：教程文档
├── exercises.md                    # 练习题
└── src/
    ├── step1-config.ts             # 配置管理：多层级配置加载与合并
    ├── step2-tool-pool.ts          # 工具池：内置工具 + MCP 工具组装
    ├── step3-system-prompt.ts      # 系统提示：动态构建与上下文注入
    └── step4-main.ts              # 主入口：命令行解析与启动流程
```

### 安装依赖

```bash
npm install commander dotenv
npm install -D @types/node tsx
```

---

## 第一步：完整架构图

### 系统分层架构

```
┌──────────────────────────────────────────────────────────────┐
│                        CLI Entry                              │
│                     (step4-main.ts)                           │
│         Commander 解析 / 初始化 / 信号处理 / 启动入口         │
├──────────────────────────────────────────────────────────────┤
│                        UI Layer                               │
│              (Module 04: Ink + React)                         │
│     消息渲染 / 流式输出 / 交互控件 / 进度条 / Markdown         │
├──────────────────────────────────────────────────────────────┤
│                      REPL Loop                                │
│              (Module 03: 交互循环)                             │
│     用户输入 → LLM 调用 → 工具执行 → 结果展示 → 下一轮        │
├──────────────────────────────────────────────────────────────┤
│                    Service Layer                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │  Agent   │  │ Context  │  │  Memory  │  │   MCP    │   │
│   │ System   │  │ Manager  │  │ Manager  │  │ Client   │   │
│   │ (Mod 06) │  │ (Mod 05) │  │ (Mod 05) │  │ (Mod 07) │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├──────────────────────────────────────────────────────────────┤
│                    Tool System                                │
│              (Module 02 + step2-tool-pool.ts)                 │
│   ┌─────────────────────────────────────────────────────┐    │
│   │               Tool Pool (工具池)                     │    │
│   │  内置工具：Read / Write / Bash / Glob / Grep / ...  │    │
│   │  MCP 工具：filesystem / github / database / ...     │    │
│   └─────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│                  Infrastructure                               │
│              (Module 01: LLM Provider)                        │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│   │ Anthropic│  │  OpenAI  │  │ Custom   │                  │
│   │ Provider │  │ Provider │  │ Provider │                  │
│   └──────────┘  └──────────┘  └──────────┘                  │
├──────────────────────────────────────────────────────────────┤
│                   Config Layer                                │
│              (step1-config.ts)                                │
│   CLI 参数 > 环境变量 > .env 文件 > 默认值                    │
└──────────────────────────────────────────────────────────────┘
```

### 数据流图

```
用户输入
  │
  ▼
┌─────────┐    ┌──────────────┐    ┌──────────────┐
│  REPL   │───→│ System Prompt │───→│  LLM API     │
│  Loop   │    │  Builder      │    │  (Streaming)  │
└─────────┘    └──────────────┘    └──────┬───────┘
  ↑                                      │
  │                              ┌───────▼───────┐
  │                              │ Response Stream│
  │                              └───────┬───────┘
  │                                      │
  │                     ┌────────────────┼────────────────┐
  │                     │                │                 │
  │              ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
  │              │ Text Block  │  │ Tool Call   │  │ Think Block │
  │              │ (直接展示)   │  │ (需要执行)  │  │ (推理过程)  │
  │              └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
  │                     │                │                 │
  │                     ▼                ▼                 ▼
  │              ┌──────────┐    ┌──────────────┐  ┌──────────┐
  │              │ UI 渲染   │    │ Tool Pool    │  │ 丢弃/日志│
  │              │ (Ink)     │    │ (执行工具)   │  │          │
  │              └──────────┘    └──────┬───────┘  └──────────┘
  │                                     │
  │                              ┌──────▼───────┐
  │                              │ Tool Result   │
  │                              │ (作为下一轮   │
  │                              │  user 消息)   │
  │                              └──────┬───────┘
  │                                     │
  └─────────────────────────────────────┘
         (循环直到 LLM 不再调用工具)
```

---

## 第二步：配置管理 (step1-config.ts)

### 为什么需要多层级配置？

真实的 AI 编程助手需要灵活的配置管理：

- **默认值**：开箱即用的合理默认
- **.env 文件**：团队共享的项目级配置
- **环境变量**：CI/CD 或容器化部署时使用
- **CLI 参数**：用户临时覆盖特定选项

### 配置合并优先级

```
优先级从高到低：
┌─────────────────────────────────┐
│  CLI 参数 (--model gpt-4)       │  ← 最高优先级
│  环境变量 (MODEL=gpt-4)         │
│  .env 文件 (MODEL=claude-sonnet)│
│  默认值 (model: "claude-sonnet")│  ← 最低优先级
└─────────────────────────────────┘
```

### 核心代码解读

配置管理的关键实现要点：

1. **Config 接口**：定义所有配置项的类型和含义
2. **loadDotEnv**：从 `.env` 文件加载键值对
3. **loadFromEnv**：从 `process.env` 读取环境变量
4. **mergeConfig**：按优先级合并所有来源
5. **validateConfig**：校验配置合法性（如 API Key 必填）

---

## 第三步：工具池组装 (step2-tool-pool.ts)

### 工具的来源

```
工具池
├── 内置工具 (Builtin Tools)
│   ├── Read       — 读取文件
│   ├── Write      — 写入文件
│   ├── Bash       — 执行 Shell 命令
│   ├── Glob       — 文件模式匹配
│   └── Grep       — 内容搜索
│
└── MCP 工具 (External Tools)
    ├── filesystem — 文件系统 MCP 服务器
    ├── github     — GitHub API MCP 服务器
    └── ...        — 其他 MCP 服务器
```

### 去重策略

当内置工具与 MCP 工具重名时，按以下策略处理：

1. **内置工具优先**：同名时保留内置版本
2. **前缀命名**：MCP 工具可添加 `mcp__` 前缀
3. **用户覆盖**：用户可通过配置显式指定使用哪个版本

---

## 第四步：系统提示构建 (step3-system-prompt.ts)

### 系统提示的结构

```
System Prompt
├── 基础指令 (Base)
│   ├── 角色定义：你是一个 AI 编程助手
│   ├── 行为约束：遵循用户指令、输出格式
│   └── 安全规则：不执行危险操作
│
├── 上下文信息 (Context)
│   ├── 当前日期时间
│   ├── 工作目录路径
│   ├── Git 仓库状态
│   ├── 操作系统信息
│   └── Shell 类型
│
├── 工具说明 (Tool Docs)
│   ├── 可用工具列表
│   ├── 使用规则
│   └── 示例
│
└── 记忆注入 (Memory)
    ├── CLAUDE.md 项目记忆
    └── 用户偏好设置
```

### CLAUDE.md 的作用

CLAUDE.md 是项目级记忆文件，放在项目根目录。它告诉 AI：

- 项目的编码规范（缩进、命名风格）
- 项目的技术栈和依赖
- 常用命令和脚本
- 项目特有的约定和注意事项

---

## 第五步：主入口 (step4-main.ts)

### 启动流程

```
程序启动
  │
  ▼
解析命令行参数 (Commander)
  │
  ├── --help          → 显示帮助信息，退出
  ├── --version       → 显示版本号，退出
  └── 正常启动        → 继续
  │
  ▼
加载配置 (loadConfig)
  │
  ▼
初始化 LLM Provider
  │
  ▼
组装工具池 (assembleToolPool)
  │
  ▼
构建系统提示 (buildSystemPrompt)
  │
  ▼
选择运行模式
  ├── 交互模式 (REPL)  → 启动 Ink UI，进入交互循环
  └── 无头模式 (Headless) → 执行单条命令，输出结果，退出
  │
  ▼
信号处理 (SIGINT / SIGTERM)
  │
  ▼
优雅关闭
```

### 信号处理

```
SIGINT (Ctrl+C)
  │
  ├── 第一次按下 → 中断当前 LLM 请求
  │                 显示提示：再按一次退出
  │
  └── 第二次按下 → 保存对话历史
                    关闭 MCP 连接
                    退出进程 (exit 0)

SIGTERM
  │
  └── 优雅关闭 → 同上
```

---

## 如何运行

### 安装依赖

```bash
# 在项目根目录
npm install

# 或在本模块目录
cd modules/08-full-project
npm install
```

### 配置 API Key

```bash
# 在项目根目录创建 .env 文件
cp .env.example .env

# 编辑 .env
# ANTHROPIC_API_KEY=sk-ant-xxxxx
# 或
# OPENAI_API_KEY=sk-xxxxx
```

### 运行方式

```bash
# 开发模式运行
npx tsx src/step4-main.ts

# 交互模式（默认）
npx tsx src/step4-main.ts --repl

# 无头模式（执行单条指令）
npx tsx src/step4-main.ts --prompt "解释 main.ts 的功能"

# 指定模型
npx tsx src/step4-main.ts --model claude-sonnet-4-20250514

# 指定工作目录
npx tsx src/step4-main.ts --cwd /path/to/project

# 查看帮助
npx tsx src/step4-main.ts --help
```

---

## 扩展方向

完成本模块后，你可以继续探索以下方向：

### 1. 多 Provider 支持

```
当前：Anthropic (Claude)
扩展：
  ├── OpenAI (GPT-4 / GPT-4o)
  ├── Google (Gemini)
  ├── 本地模型 (Ollama / LM Studio)
  └── 自定义 Provider (Azure / AWS Bedrock)
```

### 2. 插件系统

```
设计一个插件架构：
  ├── 插件注册 API
  ├── 生命周期钩子 (onStartup / onMessage / onToolCall)
  ├── 插件沙箱 (权限隔离)
  └── 插件市场 (发现与安装)
```

### 3. 会话持久化

```
将对话历史保存到本地：
  ├── JSON 文件存储
  ├── SQLite 数据库
  ├── 会话恢复 (resume)
  └── 会话搜索与回放
```

### 4. 多语言 UI

```
支持多语言界面：
  ├── 中文 / 英文切换
  ├── i18n 框架集成
  └── 用户偏好保存
```

### 5. Web UI

```
将终端 UI 扩展为 Web 界面：
  ├── WebSocket 实时通信
  ├── Monaco Editor 集成
  ├── 文件浏览器
  └── 部署为 SaaS 服务
```

### 6. 团队协作

```
支持多用户协作：
  ├── 共享会话
  ├── 代码审查集成
  ├── 团队知识库
  └── Agent 任务分发
```

---

## 小结

通过 8 个模块的学习，你已经从零构建了一个完整的 AI 编程助手。回顾你的学习旅程：

```
Module 1  →  你学会了与 LLM 进行流式通信和 Tool Calling
Module 2  →  你设计了一个可扩展的工具系统
Module 3  →  你构建了 REPL 交互循环
Module 4  →  你用 Ink 实现了终端 UI
Module 5  →  你解决了上下文窗口限制问题
Module 6  →  你构建了多智能体协作系统
Module 7  →  你集成了 MCP 协议扩展能力
Module 8  →  你把所有模块整合为一个完整项目
```

你现在已经掌握了 AI 编程助手的核心架构与实现。这不是终点，而是一个新的起点——你可以基于这个项目继续扩展，构建更强大的工具。

---

## 参考资源

- [Commander.js 文档](https://github.com/tj/commander.js) — Node.js 命令行框架
- [dotenv 文档](https://github.com/motdotla/dotenv) — 环境变量加载
- [Anthropic API 文档](https://docs.anthropic.com/) — Claude API
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP 协议
- [Ink 框架](https://github.com/vadimdemedes/ink) — React 终端 UI
