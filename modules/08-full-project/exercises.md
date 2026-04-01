# 模块 8: 完整项目集成 — 练习题

本练习题涵盖配置管理、工具池组装、系统提示构建和主入口设计的核心概念。

---

## 练习 1: 配置验证扩展（基础）

**目标**：扩展 `step1-config.ts` 的校验逻辑。

**题目**：

当前的 `validateConfig()` 只校验了基本的配置项。请添加以下校验规则：

1. 校验 `cwd` 目录是否存在且可访问
2. 校验 `model` 是否在支持的模型列表中（`claude-sonnet-4-20250514`, `gpt-4o`, `claude-haiku-4-20250414`）
3. 校验 MCP 服务器配置的 `command` 字段不为空
4. 添加 `warn` 级别的校验（如 `maxTokens` 过小时给出警告但不阻止启动）

**提示**：使用 `existsSync` 和 `accessSync` 检查目录。

---

## 练习 2: 实现配置热重载（进阶）

**目标**：实现 .env 文件的配置热重载。

**题目**：

在运行时监听 `.env` 文件的变化，自动重新加载配置并应用到当前会话。

**要求**：

1. 使用 `fs.watch` 监听 `.env` 文件
2. 检测文件变化时重新加载配置
3. 比较新旧配置，输出变化的配置项
4. 提供开关控制是否启用热重载

---

## 练习 3: 添加自定义内置工具（基础）

**目标**：在工具池中添加新的内置工具。

**题目**：

实现以下两个工具并注册到 `getBuiltinTools()` 中：

**工具 1: Edit（文件编辑）**

```typescript
// 功能：精确替换文件中的字符串
// 参数：
//   - file_path: 文件路径（必填）
//   - old_string: 要替换的字符串（必填）
//   - new_string: 替换后的字符串（必填）
//   - replace_all: 是否替换所有匹配（可选，默认 false）
```

**工具 2: Grep（内容搜索）**

```typescript
// 功能：在文件中搜索正则表达式
// 参数：
//   - pattern: 正则表达式（必填）
//   - path: 搜索目录（可选，默认 cwd）
//   - file_pattern: 文件过滤模式（可选，如 "*.ts"）
```

---

## 练习 4: 工具冲突高级解决（进阶）

**目标**：实现更完善的工具去重策略。

**题目**：

当前 `assembleToolPool()` 的去重策略比较简单（同名时内置优先）。请实现以下增强：

1. **别名机制**：为冲突工具自动生成别名（如 MCP 的 `read_file` 变为 `mcp__filesystem__read_file`）
2. **用户选择**：允许通过配置文件指定冲突时使用哪个版本
3. **工具优先级配置**：支持在配置中定义工具的优先级规则

**配置示例**：

```json
{
  "toolResolution": {
    "read_file": "mcp:filesystem",
    "write_file": "builtin"
  }
}
```

---

## 练习 5: 系统提示模板引擎（进阶）

**目标**：实现一个灵活的系统提示模板系统。

**题目**：

将硬编码的系统提示改为基于模板文件构建：

1. 创建 `templates/system-prompt.md` 模板文件
2. 支持模板变量插值：`{{currentDate}}`, `{{workingDirectory}}`, `{{gitBranch}}`
3. 支持条件块：`{{#if gitInfo}}...{{/if}}`
4. 支持工具列表自动生成：`{{#each tools}}...{{/each}}`

**模板示例**：

```markdown
# AI 编程助手

当前环境：
- 日期：{{currentDate}}
- 目录：{{workingDirectory}}

{{#if gitInfo}}
Git 状态：
- 分支：{{gitInfo.branch}}
- 最近提交：{{gitInfo.lastCommit}}
{{/if}}

可用工具：
{{#each tools}}
- {{name}}: {{description}}
{{/each}}
```

---

## 练习 6: 实现会话持久化（进阶）

**目标**：将 REPL 交互历史保存到文件。

**题目**：

为 `step4-main.ts` 的 REPL 模式添加会话持久化功能：

1. 每次会话结束时自动保存对话历史到 `.sessions/` 目录
2. 启动时提供 `--resume <session-id>` 选项恢复历史会话
3. 会话文件使用 JSON 格式，包含时间戳、模型、所有消息
4. 支持列出历史会话（`/sessions` 命令）

---

## 练习 7: 完整集成测试（挑战）

**目标**：为整个系统编写端到端集成测试。

**题目**：

编写测试用例覆盖以下场景：

1. **配置加载测试**：验证多层级配置合并的正确性
2. **工具池测试**：验证去重和排序逻辑
3. **系统提示测试**：验证各段提示的正确拼接
4. **启动流程测试**：验证初始化序列和错误处理
5. **信号处理测试**：验证 SIGINT 和 SIGTERM 的行为

**提示**：使用 Node.js 内置的 `node:test` 或 `vitest` 框架。

---

## 练习 8: 插件系统设计（挑战）

**目标**：为 AI 编程助手设计并实现一个简单的插件系统。

**题目**：

设计一个插件接口，允许用户通过编写 JavaScript/TypeScript 文件来扩展助手的功能：

1. 定义 `Plugin` 接口（`name`, `onLoad`, `onMessage`, `onToolCall` 等钩子）
2. 实现插件加载器（从 `plugins/` 目录扫描并加载）
3. 实现插件沙箱（限制插件的文件系统访问范围）
4. 提供示例插件（如：自动保存对话摘要到 Markdown 文件）

**插件接口示例**：

```typescript
interface Plugin {
  name: string
  version: string
  onLoad?(context: PluginContext): void
  onMessage?(message: Message): Message | null
  onToolCall?(tool: string, input: unknown): unknown
}
```

---

## 提交要求

请完成以下内容并提交：

1. **练习 1-3**（必做）：每题实现完整功能
2. **练习 4-6**（选做）：至少完成 2 题
3. **练习 7-8**（挑战）：至少完成 1 题

**评分标准**：

- 基础题（1-3）：每题 15 分
- 进阶题（4-6）：每题 20 分
- 挑战题（7-8）：每题 25 分
- 总分 100 分，60 分及格

---

## 提示与常见问题

**Q: 运行 `step4-main.ts` 时报模块找不到？**

A: 确保安装了所有依赖：
```bash
npm install commander dotenv
npm install -D tsx @types/node
```

**Q: 如何调试配置加载过程？**

A: 使用 `--debug` 参数启动：
```bash
npx tsx src/step4-main.ts --debug
```

**Q: 如何测试 MCP 工具发现？**

A: 在配置中添加 MCP 服务器，然后使用 `/tools` 命令查看工具列表。

**Q: 无头模式下如何获取输出？**

A: 无头模式的输出会直接打印到 stdout，可以重定向到文件：
```bash
npx tsx src/step4-main.ts --prompt "分析代码" > output.txt
```

---

**祝你练习愉快！恭喜你完成了全部 8 个模块的学习！**
