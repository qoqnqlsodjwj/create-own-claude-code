/**
 * Step 2: 自定义组件 — 构建聊天 UI 的基础组件
 *
 * 学习目标：
 * - 创建可复用的 React 组件
 * - Props 和类型定义
 * - 条件渲染
 * - 组件组合模式
 *
 * 运行: npx tsx src/step2-components.tsx
 */

import React, { useState, useEffect } from 'react'
import { render, Box, Text, Spacer, Newline, useApp } from 'ink'

// ============================================
// 1. MessageBubble — 消息气泡组件
// ============================================

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content }) => {
  // 不同角色使用不同颜色和图标
  const config = {
    user: { color: 'cyan', icon: '你', label: '你' },
    assistant: { color: 'magenta', icon: 'AI', label: 'AI' },
  }
  const { color, icon } = config[role]

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        <Text color={color} bold>{icon}: </Text>
        <Text>{content}</Text>
      </Box>
    </Box>
  )
}

// ============================================
// 2. ToolResultDisplay — 工具执行结果显示
// ============================================

interface ToolResultProps {
  toolName: string
  status: 'running' | 'success' | 'error'
  output?: string
  duration?: number
}

const ToolResultDisplay: React.FC<ToolResultProps> = ({
  toolName, status, output, duration
}) => {
  // 根据状态显示不同图标
  const statusIcon = {
    running: <Text color="yellow">⏳</Text>,
    success: <Text color="green">✓</Text>,
    error: <Text color="red">✗</Text>,
  }

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        {statusIcon[status]}
        <Text> </Text>
        <Text bold>{toolName}</Text>
        {duration && <Text dimColor> ({duration}ms)</Text>}
      </Box>
      {output && (
        <Box marginLeft={2} marginTop={0}>
          <Text dimColor wrap="truncate">
            {output.length > 80 ? output.slice(0, 80) + '...' : output}
          </Text>
        </Box>
      )}
    </Box>
  )
}

// ============================================
// 3. Spinner — 加载动画组件
// ============================================

const Spinner: React.FC<{ label?: string }> = ({ label = '思考中' }) => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Box>
      <Text color="cyan">{frames[frame]}</Text>
      <Text> {label}...</Text>
    </Box>
  )
}

// ============================================
// 4. PermissionDialog — 权限确认对话框
// ============================================

interface PermissionProps {
  action: string
  target: string
  onAllow: () => void
  onDeny: () => void
}

const PermissionDialog: React.FC<PermissionProps> = ({
  action, target, onAllow, onDeny
}) => (
  <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
    <Box marginBottom={1}>
      <Text color="yellow" bold>⚠ 权限确认</Text>
    </Box>
    <Box>
      <Text>Claude 想要 </Text>
      <Text bold color="yellow">{action}</Text>
      <Text>: </Text>
      <Text color="cyan">{target}</Text>
    </Box>
    <Newline />
    <Box gap={2}>
      <Text color="green" bold>[Y]</Text><Text>允许 </Text>
      <Text color="red" bold>[N]</Text><Text>拒绝 </Text>
      <Text color="yellow" bold>[A]</Text><Text>始终允许</Text>
    </Box>
  </Box>
)

// ============================================
// 5. TokenCounter — Token 计数显示
// ============================================

interface TokenCounterProps {
  used: number
  total: number
}

const TokenCounter: React.FC<TokenCounterProps> = ({ used, total }) => {
  const percentage = Math.round((used / total) * 100)
  const color = percentage > 80 ? 'red' : percentage > 50 ? 'yellow' : 'green'

  return (
    <Box>
      <Text dimColor>Token: </Text>
      <Text color={color}>{used.toLocaleString()}</Text>
      <Text dimColor> / {total.toLocaleString()}</Text>
      <Text dimColor> ({percentage}%)</Text>
    </Box>
  )
}

// ============================================
// 6. StatusBar — 底部状态栏
// ============================================

const StatusBar: React.FC = () => (
  <Box borderStyle="single" borderColor="gray" paddingX={1}>
    <Text color="green">● 已连接</Text>
    <Text dimColor> | </Text>
    <Text dimColor>claude-sonnet-4-20250514</Text>
    <Spacer />
    <TokenCounter used={1234} total={200000} />
  </Box>
)

// ============================================
// 综合演示
// ============================================

const Demo = () => (
  <Box flexDirection="column" padding={1}>
    <Text bold color="blue">组件演示</Text>
    <Newline />

    {/* 消息气泡 */}
    <MessageBubble role="user" content="帮我读取 package.json" />
    <MessageBubble role="assistant" content="好的，让我来读取这个文件..." />

    <Newline />

    {/* 工具结果 */}
    <ToolResultDisplay toolName="FileRead" status="success" duration={45}
      output='{"name": "my-project", "version": "1.0.0"}' />
    <ToolResultDisplay toolName="Bash" status="running" />

    <Newline />

    {/* 加载动画 */}
    <Spinner label="分析代码" />

    <Newline />

    {/* 权限对话框 */}
    <PermissionDialog
      action="写入文件"
      target="src/index.ts"
      onAllow={() => {}}
      onDeny={() => {}}
    />

    <Newline />

    {/* 状态栏 */}
    <StatusBar />
  </Box>
)

const { unmount } = render(<Demo />)
setTimeout(() => unmount(), 3000)
