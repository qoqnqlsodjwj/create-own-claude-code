/**
 * Step 1: Hello Ink — 你的第一个终端 React 应用
 *
 * 学习目标：
 * - 理解 Ink 的 render() 函数
 * - 使用 Box 和 Text 组件
 * - 理解 Flexbox 在终端中的工作方式
 *
 * 运行: npx tsx src/step1-hello-ink.tsx
 */

import React from 'react'
import { render, Box, Text, Newline, Spacer } from 'ink'

// ============================================
// 1. 最简单的 Ink 应用
// ============================================
const SimpleApp = () => (
  <Box padding={1}>
    <Text color="green" bold>Hello Ink!</Text>
  </Box>
)

// ============================================
// 2. Flexbox 布局 — 水平排列（默认）
// ============================================
const HorizontalLayout = () => (
  <Box padding={1}>
    <Text color="red">左 </Text>
    <Text color="green">中 </Text>
    <Text color="blue">右</Text>
  </Box>
)

// ============================================
// 3. Flexbox 布局 — 垂直排列
// ============================================
const VerticalLayout = () => (
  <Box flexDirection="column" padding={1}>
    <Text color="cyan">第一行</Text>
    <Text color="magenta">第二行</Text>
    <Text color="yellow">第三行</Text>
  </Box>
)

// ============================================
// 4. 边框样式
// ============================================
const BorderedBox = () => (
  <Box flexDirection="column" padding={1} gap={1}>
    <Box borderStyle="round" borderColor="green" padding={1}>
      <Text color="green">圆角边框</Text>
    </Box>
    <Box borderStyle="double" borderColor="cyan" padding={1}>
      <Text color="cyan">双线边框</Text>
    </Box>
    <Box borderStyle="bold" borderColor="yellow" padding={1}>
      <Text color="yellow">粗线边框</Text>
    </Box>
  </Box>
)

// ============================================
// 5. Spacer 弹性空白 — 两端对齐
// ============================================
const SpacerDemo = () => (
  <Box flexDirection="column" padding={1}>
    <Box>
      <Text color="green" bold>🤖 My Claude Code</Text>
      <Spacer />
      <Text dimColor>v1.0.0</Text>
    </Box>
    <Box borderStyle="single" borderColor="gray" marginTop={1}>
      <Text dimColor>AI 编程助手终端界面</Text>
    </Box>
  </Box>
)

// ============================================
// 6. 综合示例 — 模拟 Claude Code 头部
// ============================================
const ClaudeCodeHeader = () => (
  <Box flexDirection="column" padding={1}>
    {/* 标题栏 */}
    <Box borderStyle="round" borderColor="blue" paddingX={1}>
      <Text color="blue" bold>Claude Code</Text>
      <Spacer />
      <Text dimColor>claude-sonnet-4-20250514</Text>
    </Box>
    <Newline />
    {/* 状态栏 */}
    <Box>
      <Text color="green">● 已连接</Text>
      <Text dimColor> | </Text>
      <Text>Token: 0 / 200,000</Text>
      <Spacer />
      <Text dimColor>按 Ctrl+C 退出</Text>
    </Box>
    <Newline />
    {/* 欢迎消息 */}
    <Box flexDirection="column">
      <Text dimColor>你好！我是你的 AI 编程助手。</Text>
      <Text dimColor>你可以问我任何关于代码的问题。</Text>
    </Box>
  </Box>
)

// ============================================
// 主入口 — 渲染 3 秒后自动退出
// ============================================
const App = () => <ClaudeCodeHeader />

const { unmount } = render(<App />)
setTimeout(() => unmount(), 3000)
