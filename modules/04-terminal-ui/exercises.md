# 模块 4 练习题

## 练习 1：Markdown 终端渲染器 ⭐⭐⭐

实现一个简单的 Markdown 渲染组件，支持：
- `# 标题` → 粗体大字
- `**粗体**` → bold
- `` `代码` `` → 反色/带背景
- `> 引用` → 带左边框
- `- 列表项` → 带缩进圆点

```tsx
// 提示：用正则解析 Markdown，然后用不同的 Text 组件渲染
const Markdown: React.FC<{ content: string }> = ({ content }) => {
  // 你的实现
}
```

## 练习 2：代码 Diff 视图 ⭐⭐⭐⭐

实现一个文件 diff 展示组件：
- 新增行：绿色背景
- 删除行：红色背景
- 上下文行：默认颜色
- 显示行号

## 练习 3：模糊搜索组件 ⭐⭐⭐

实现一个简单的文件模糊搜索：
- 用户输入关键词
- 实时过滤文件列表
- 高亮匹配字符
- 上下键选择

## 练习 4：打字机效果 ⭐⭐

实现 AI 回复的逐字打字效果：
- 每个字符延迟 20-50ms 出现
- 支持流式追加内容
- 打字完成后光标消失

```tsx
const TypewriterText: React.FC<{ text: string; speed?: number }> = ({ text, speed = 30 }) => {
  const [displayed, setDisplayed] = useState('')
  // 用 useEffect + setInterval 逐步显示
}
```
