# Chrome MCP Release 安装

**📖 文档**: [English](README.md) | [中文](README_zh.md)

## 下载

从以下地址下载最新版 `chrome-mcp-extension.zip`：

https://github.com/rudy2steiner/chrome-mcp/releases/latest

## 安装

1. 解压 `chrome-mcp-extension.zip`。
2. 打开 Chrome 并访问 `chrome://extensions/`。
3. 启用开发者模式。
4. 点击“加载已解压的扩展程序”。
5. 选择包含 `manifest.json` 的解压目录。
6. 打开 Chrome MCP 扩展弹窗并点击**复制配置**。

## 让 Agent 帮你安装

把下面这段提示词发给 Agent：

```text
请为当前 Agent 安装 Chrome MCP。

使用这个 MCP server 配置：

{
  "mcpServers": {
    "chrome-mcp": {
      "command": "npx",
      "args": ["-y", "--registry=https://registry.npmjs.org", "agent-chrome-mcp@latest", "stdio"]
    }
  }
}

把它添加到当前 Agent 的 MCP 设置里。不要使用全局 npm install。更新配置后告诉我保存到了哪里，并提醒我重启 Agent。也提醒我从 https://github.com/rudy2steiner/chrome-mcp/releases/latest 安装 Chrome 扩展，并在扩展弹窗里点击"连接"。
```

然后重启 Agent，并在扩展弹窗中点击**连接**。

## 手动 MCP 配置

如果你想手动编辑配置，把下面配置添加到 Agent 的 MCP 设置里：

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

## 高级：全局安装

```bash
npm install -g agent-chrome-mcp
```

然后使用：

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "command": "agent-chrome-mcp",
      "args": ["stdio"]
    }
  }
}
```

## 高级：HTTP

扩展启动本地 bridge 后，HTTP 端点为 `http://127.0.0.1:12307/mcp`。除非 MCP 客户端明确需要 HTTP，否则优先使用 stdio。

## 致谢

特别感谢原始项目 [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome) 及其作者 **hangye**，本项目是在其工作基础上继续演进而来。
