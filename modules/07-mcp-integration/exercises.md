# 模块 7: MCP 协议集成 — 练习题

本练习题涵盖 MCP 协议的核心概念、服务器构建、客户端开发和动态注册。

---

## 练习 1: JSON-RPC 消息解析（基础）

**目标**：理解 JSON-RPC 2.0 消息格式。

**题目**：

给定以下 JSON-RPC 请求消息：

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "/tmp/test.txt"
    }
  }
}
```

请回答以下问题：

1. 这个消息的协议版本是什么？
2. 请求的 ID 是什么？
3. 要调用的方法名是什么？
4. `params.arguments.path` 的值是什么？
5. 写出一个对应的成功响应消息（假设文件读取成功）。

---

## 练习 2: 实现 MCP 工具（基础）

**目标**：学会在 MCP 服务器中定义和实现工具。

**题目**：

为你的 MCP 服务器添加一个新工具 `url_encode`，功能是对字符串进行 URL 编码。

**要求**：

1. 工具名称：`url_encode`
2. 工具描述：清晰说明功能
3. 输入参数：一个 `text` 参数（要编码的字符串）
4. 使用 Node.js 的 `encodeURIComponent` 函数实现

---

## 练习 3: 构建自定义 MCP 服务器（进阶）

**目标**：从头构建一个完整的 MCP 服务器。

**题目**：

构建一个 MCP 服务器，提供 `weather` 工具，可以查询指定城市的天气。

**功能要求**：

1. 工具名：`get_weather`
2. 参数：`city`（城市名，必填）
3. 使用免费的天气 API（如 Open-Meteo，无需 API Key）
4. 返回格式化的天气信息

**API 参考**（Open-Meteo，免费无需认证）：

```
GET https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true
```

---

## 练习 4: MCP 客户端连接（进阶）

**目标**：学会创建 MCP 客户端并连接服务器。

**题目**：

修改 `step3-mcp-client.ts`，实现以下功能：

1. 连接到 `step2` 创建的服务器
2. 调用 `calculate` 工具计算 `Math.PI * 2`
3. 调用 `json_format` 工具格式化 `{"a":1,"b":2}`

---

## 练习 5: 工具名称冲突处理（进阶）

**目标**：学会处理多服务器的命名冲突。

**题目**：

假设我们有两个 MCP 服务器：
1. `filesystem`：提供 `read_file` 工具
2. `http-api`：也提供 `read_file` 工具（读取远程 URL）

**任务**：

1. 设计一个冲突解决策略
2. 实现一个 `ConflictResolver` 类
3. 演示如何使用前缀解决冲突

---

## 练习 6: 动态配置加载（进阶）

**目标**：学会从配置文件动态加载 MCP 服务器。

**题目**：

创建以下配置文件结构，实现动态加载：

**配置文件** (`config/mcp.json`)：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "enabled": true,
      "priority": 1
    }
  }
}
```

---

## 练习 7: MCP 服务器健康检查（挑战）

**目标**：实现 MCP 服务器的健康检查机制。

**题目**：

为 MCP 管理器添加健康检查功能：

1. **心跳检测**：定期向所有 MCP 服务器发送 `ping` 请求
2. **超时处理**：如果服务器在指定时间内未响应，标记为不健康
3. **自动重连**：不健康的服务器自动尝试重连

---

## 练习 8: 实现 resources/list 和 resources/read（进阶）

**目标**：在 MCP 服务器中实现资源原语。

**题目**：

为 `step2` 的 MCP 服务器添加资源支持，暴露当前目录的文件列表。

---

## 练习 9: 集成到 Agent 系统（综合）

**目标**：将 MCP 工具集成到 Agent 执行循环中。

**题目**：

修改 Agent 代码，使其支持 MCP 工具。

---

## 提交要求

请完成以下内容并提交：

1. **练习 1**：答案（直接写在这份文档中）
2. **练习 2**：修改后的 `step2-build-mcp-server.ts`
3. **练习 3**：完整的天气 MCP 服务器代码
4. **练习 4**：修改后的 `step3-mcp-client.ts`
5. **练习 5-9**（选做）：至少完成 3 题

**评分标准**：

- 基础题（1-2）：每题 20 分
- 进阶题（3-6）：每题 25 分
- 挑战题（7-9）：每题 30 分
- 总分 100 分，60 分及格

---

## 参考资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [@modelcontextprotocol/sdk 源码](https://github.com/modelcontextprotocol/typescript-sdk)
- [JSON-RPC 2.0 规范](https://www.jsonrpc.org/specification)

---

## 提示与常见问题

**Q: 连接 MCP 服务器失败怎么办？**

A: 检查以下几点：
1. 服务器命令是否正确（使用 `npx tsx` 还是 `node`）
2. 参数是否正确传递
3. stderr 是否有错误输出
4. 尝试使用 MCP Inspector 调试

**Q: 工具调用返回格式错误？**

A: 确保响应格式正确：
```typescript
return {
  content: [
    { type: "text", text: "结果内容" }
  ]
};
```

**Q: 如何调试 MCP 通信？**

A: 设置环境变量：
```bash
export MCP_DEBUG=1
```

---

**祝你练习愉快！**
