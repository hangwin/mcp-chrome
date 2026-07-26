# CLI MCP 配置指南

**📖 文档**: [English](mcp-cli-config.md) | [中文](mcp-cli-config_zh.md)

本指南说明如何配置 Codex CLI 和 Claude Code 以连接 Chrome MCP。

推荐优先使用 stdio 配置；HTTP 仅作为高级用法。完整安装流程见 [README_zh.md](../README_zh.md)。

## 概述

Chrome MCP 在 `http://127.0.0.1:12307/mcp` 暴露 MCP 接口（默认端口）。
Codex CLI 和 Claude Code 都可以连接该端点来使用 Chrome 浏览器控制工具。

## Codex CLI 配置

### 方式一：HTTP MCP 服务器

将以下内容添加到 `~/.codex/config.json`：

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "url": "http://127.0.0.1:12307/mcp"
    }
  }
}
```

### 方式二：通过环境变量

在运行 codex 前设置 MCP URL：

```bash
export MCP_HTTP_PORT=12307
```

## Claude Code 配置

### 方式一：HTTP MCP 服务器

将以下内容添加到 `~/.claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "url": "http://127.0.0.1:12307/mcp"
    }
  }
}
```

### 方式二：Stdio 服务器（推荐）

如果希望使用基于 stdio 的 MCP 通信：

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "command": "npx",
      "args": ["-y", "--registry=https://registry.npmjs.org", "agent-chrome-mcp@latest", "stdio"]
    }
  }
}
```

## 验证连接

配置完成后，CLI 工具应能看到并使用 Chrome MCP 工具，例如：

- `chrome_get_windows_and_tabs` - 获取浏览器窗口和标签页信息
- `chrome_navigate` - 导航到 URL
- `chrome_click` - 点击页面元素
- `chrome_read_page` - 读取页面内容
- 以及更多...

## 故障排除

### 连接被拒绝

如果出现 "connection refused" 错误：

1. 确保已安装 Chrome 扩展且 native server 正在运行
2. 检查端口是否匹配（默认：12307）
3. 确认防火墙没有阻止 localhost 连接
4. 运行 `agent-chrome-mcp doctor` 进行诊断

### 工具未出现

如果 MCP 工具没有出现在 CLI 中：

1. 修改配置后重启 CLI 工具
2. 检查配置文件语法（有效 JSON）
3. 确保 MCP 服务器 URL 可访问

### 端口冲突

如果 12307 端口已被占用：

1. 在扩展设置中指定自定义端口
2. 更新 CLI 配置以匹配新端口
3. 运行 `agent-chrome-mcp update-port <new-port>` 更新 stdio 配置

## 环境变量

| 变量                         | 说明                        | 默认值   |
| ---------------------------- | --------------------------- | -------- |
| `MCP_HTTP_PORT`              | MCP 服务器 HTTP 端口        | 12307    |
| `MCP_ALLOWED_WORKSPACE_BASE` | 额外允许的工作区目录        | （无）   |
| `CHROME_MCP_NODE_PATH`       | 覆盖 Node.js 可执行文件路径 | （自动） |
