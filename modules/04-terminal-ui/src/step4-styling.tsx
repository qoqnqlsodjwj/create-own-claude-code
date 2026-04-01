/**
 * Step 4: 进阶样式 — 颜色、动画、高级布局
 *
 * 学习目标：
 * - 终端颜色系统（16色、256色、RGB）
 * - 边框和间距高级用法
 * - 简单帧动画
 * - 进度条组件
 *
 * 运行: npx tsx src/step4-styling.tsx
 */

import React, { useState, useEffect } from 'react'
import { render, Box, Text, Spacer, Newline } from 'ink'

// ============================================
// 1. 颜色系统
// ============================================

const ColorDemo = () => (
  <Box flexDirection="column" padding={1}>
    <Text bold underline>颜色系统</Text>
    <Newline />

    {/* 命名色 */}
    <Box gap={1}>
      <Text color="red">红色</Text>
      <Text color="green">绿色</Text>
      <Text color="yellow">黄色</Text>
      <Text color="blue">蓝色</Text>
      <Text color="magenta">品红</Text>
      <Text color="cyan">青色</Text>
      <Text color="white">白色</Text>
    </Box>

    {/* 灰阶 */}
    <Box gap={1} marginTop={1}>
      <Text color="gray">gray</Text>
      <Text color="grey">grey</Text>
      <Text dimColor>dimColor</Text>
    </Box>

    {/* 背景色 */}
    <Box gap={1} marginTop={1}>
      <Text bgRed color="white"> bgRed </Text>
      <Text bgGreen color="black"> bgGreen </Text>
      <Text bgBlue color="white"> bgBlue </Text>
    </Box>

    {/* 文字样式 */}
    <Box gap={1} marginTop={1}>
      <Text bold>粗体</Text>
      <Text italic>斜体</Text>
      <Text underline>下划线</Text>
      <Text strikethrough>删除线</Text>
      <Text inverse>反色</Text>
    </Box>
  </Box>
)

// ============================================
// 2. 帧动画组件
// ============================================

const Spinner: React.FC<{ label: string }> = ({ label }) => {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI(f => (f + 1) % frames.length), 80)
    return () => clearInterval(t)
  }, [])

  return (
    <Box>
      <Text color="cyan">{frames[i]}</Text>
      <Text> {label}...</Text>
    </Box>
  )
}

// ============================================
// 3. 进度条组件
// ============================================

const ProgressBar: React.FC<{
  value: number   // 0-100
  width?: number
  label?: string
}> = ({ value, width = 30, label = '' }) => {
  const filled = Math.round((value / 100) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  const color = value > 80 ? 'red' : value > 50 ? 'yellow' : 'green'

  return (
    <Box>
      {label && <Text dimColor>{label} </Text>}
      <Text color={color}>{bar}</Text>
      <Text> {value}%</Text>
    </Box>
  )
}

// ============================================
// 4. 动态进度演示
// ============================================

const ProgressDemo: React.FC = () => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(t); return 100 }
        return p + 2
      })
    }, 100)
    return () => clearInterval(t)
  }, [])

  return (
    <Box flexDirection="column">
      <ProgressBar value={progress} width={40} label="安装依赖" />
      {progress >= 100 && <Text color="green">✓ 完成!</Text>}
    </Box>
  )
}

// ============================================
// 5. 综合展示
// ============================================

const Showcase = () => (
  <Box flexDirection="column" padding={1} gap={1}>
    <ColorDemo />
    <Newline />
    <Box flexDirection="column">
      <Text bold underline>动画效果</Text>
      <Newline />
      <Spinner label="分析代码" />
      <Spinner label="搜索文件" />
    </Box>
    <Newline />
    <Box flexDirection="column">
      <Text bold underline>进度条</Text>
      <Newline />
      <ProgressBar value={30} width={20} label="Token" />
      <ProgressBar value={65} width={20} label="上下文" />
      <ProgressBar value={90} width={20} label="预算" />
      <Newline />
      <ProgressDemo />
    </Box>
  </Box>
)

const { unmount } = render(<Showcase />)
setTimeout(() => unmount(), 8000)
