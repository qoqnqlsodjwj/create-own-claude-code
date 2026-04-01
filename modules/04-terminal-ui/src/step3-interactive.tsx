/**
 * Step 3: 交互式终端应用 — 键盘输入与状态管理
 *
 * 学习目标：
 * - useInput Hook 监听键盘
 * - useState 管理应用状态
 * - 实现简单的聊天循环
 * - 处理用户确认/拒绝
 *
 * 运行: npx tsx src/step3-interactive.tsx
 */

import React, { useState, useCallback } from 'react'
import { render, Box, Text, Spacer, Newline, useInput, useApp } from 'ink'

// ============================================
// 1. 输入框组件 — 监听键盘输入
// ============================================

const InputField: React.FC<{
  value: string
  onChange: (val: string) => void
  onSubmit: (val: string) => void
  placeholder?: string
}> = ({ value, onChange, onSubmit, placeholder = '输入消息...' }) => {
  useInput((input, key) => {
    if (key.return) {
      onSubmit(value)
      return
    }
    if (key.backspace) {
      onChange(value.slice(0, -1))
      return
    }
    if (input && !key.ctrl && !key.meta) {
      onChange(value + input)
    }
  })

  return (
    <Box borderStyle="round" borderColor="blue" paddingX={1}>
      <Text color="blue" bold>{'>'} </Text>
      {value ? <Text>{value}</Text> : <Text dimColor>{placeholder}</Text>}
      <Text color="blue">▎</Text>
    </Box>
  )
}

// ============================================
// 2. 消息类型定义
// ============================================

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// ============================================
// 3. 权限确认状态机
// ============================================

type PermissionState = null | {
  action: string
  target: string
  resolve: (allowed: boolean) => void
}

// ============================================
// 4. 主交互应用
// ============================================

const InteractiveApp: React.FC = () => {
  const { exit } = useApp()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [permission, setPermission] = useState<PermissionState>(null)

  // 模拟 AI 回复
  const simulateReply = useCallback((userMsg: string) => {
    setTimeout(() => {
      // 根据用户消息生成模拟回复
      const replies: Record<string, string> = {
        'help': '我可以帮你：读文件、写文件、运行命令、搜索代码。试试输入 "read package.json"',
        'hi': '你好！我是你的 AI 编程助手。输入 "help" 查看我能做什么。',
      }
      const reply = replies[userMsg.toLowerCase()] ??
        `收到你的消息："${userMsg}"。这是一个模拟回复，在完整项目中这里会调用 LLM API。`
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    }, 500)
  }, [])

  // 提交用户消息
  const handleSubmit = useCallback((value: string) => {
    if (!value.trim()) return

    // 特殊命令处理
    if (value.toLowerCase() === 'exit' || value.toLowerCase() === 'quit') {
      exit()
      return
    }

    setMessages(prev => [...prev, { role: 'user', content: value }])
    setInput('')
    simulateReply(value)
  }, [exit, simulateReply])

  // 权限确认快捷键（当权限对话框显示时）
  useInput((input, key) => {
    if (!permission) return
    if (input === 'y' || input === 'Y') {
      permission.resolve(true)
      setPermission(null)
    }
    if (input === 'n' || input === 'N') {
      permission.resolve(false)
      setPermission(null)
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      {/* 标题 */}
      <Box borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1}>
        <Text color="blue" bold>My Claude Code</Text>
        <Spacer />
        <Text dimColor>输入 "exit" 退出</Text>
      </Box>

      {/* 消息列表 */}
      <Box flexDirection="column">
        {messages.length === 0 && (
          <Text dimColor>欢迎！输入任何消息开始对话。</Text>
        )}
        {messages.map((msg, i) => (
          <Box key={i} marginBottom={0}>
            {msg.role === 'user' ? (
              <Text><Text color="cyan" bold>你: </Text><Text>{msg.content}</Text></Text>
            ) : (
              <Text><Text color="magenta" bold>AI: </Text><Text>{msg.content}</Text></Text>
            )}
          </Box>
        ))}
      </Box>

      <Newline />

      {/* 权限确认对话框 */}
      {permission && (
        <Box borderStyle="round" borderColor="yellow" padding={1} marginBottom={1}>
          <Box flexDirection="column">
            <Text color="yellow" bold>⚠ 权限确认</Text>
            <Text>Claude 想要 <Text bold>{permission.action}</Text>: {permission.target}</Text>
            <Text dimColor>[Y] 允许  [N] 拒绝</Text>
          </Box>
        </Box>
      )}

      {/* 输入框 */}
      <InputField
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        placeholder="输入消息... (exit 退出)"
      />
    </Box>
  )
}

// ============================================
// 启动应用
// ============================================
render(<InteractiveApp />)
