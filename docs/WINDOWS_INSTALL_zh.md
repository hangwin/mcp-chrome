# windows 安装指南 🔧

**📖 文档**: [中文](WINDOWS_INSTALL_zh.md)

Chrome MCP 在windows电脑的详细安装和配置步骤

## 环境要求

- Chrome/Chromium 浏览器
- 支持 MCP 的 Agent 或 MCP 客户端
- Node.js `20+`
- 终端中可以使用 npm 和 npx；正常安装 Node.js 时，npx 会随 npm 一起提供

## 📋 安装

1. **下载最新版本**
   - 从 https://github.com/rudy2steiner/chrome-mcp/releases/latest 下载 `chrome-mcp-extension.zip`
   - 解压 zip 文件

2. **加载 Chrome 扩展**
   - 打开 Chrome 并访问 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择包含 `manifest.json` 的解压目录
   - 点击 Chrome MCP 插件图标
   - 点击"复制配置"
     <img width="475" alt="截屏2025-06-09 15 52 06" src="https://github.com/user-attachments/assets/241e57b8-c55f-41a4-9188-0367293dc5bc" />

3. **让 Agent 帮你连接**

把下面这段提示词发给 Agent：

```text
请为当前 Agent 连接 Chrome MCP。

要求：
- 优先使用简单的 npx 配置。
- 如果当前 Agent 无法通过 npx 启动 MCP stdio，再回退到下面的直接 Node.js 配置。

首选 MCP server 配置：

{
  "mcpServers": {
    "chrome-mcp": {
      "command": "npx",
      "args": ["-y", "--registry=https://registry.npmjs.org", "agent-chrome-mcp@latest", "stdio"]
    }
  }
}

如果缺少环境要求、扩展加载或回退配置，请先按手动安装指南操作：
https://github.com/rudy2steiner/chrome-mcp#-快速开始

如果按手动指南操作后 npx 仍卡住，或者 Agent 无法列出 MCP tools：
1. 运行 npm install -g --registry=https://registry.npmjs.org agent-chrome-mcp@latest
2. 用 node -p "process.execPath" 获取 node 绝对路径
3. 用 npm root -g 获取全局 npm root
4. command 使用 node 绝对路径，args 使用：
   <global npm root>/agent-chrome-mcp/dist/mcp/mcp-server-stdio.js
5. 添加环境变量 CHROME_MCP_SKIP_AUTO_REGISTER=1。

更新 MCP 配置后告诉我保存到了哪里，以及使用的是哪种配置方式。提醒我重启 Agent，必要时确认已从 https://github.com/rudy2steiner/chrome-mcp/releases/latest 加载 Chrome 扩展，并在扩展弹窗里点击"连接"。
```

4. **重启并连接**

重启 Agent。然后打开插件弹窗并点击"连接"。查看工具列表，如果能列出工具，说明已经可以使用了。

### 手动 MCP 配置

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

### Streamable HTTP 连接方式

只有当你的 MCP 客户端直接支持 HTTP MCP server 时，才使用 Streamable HTTP。大多数本地 Agent 仍推荐使用 stdio。

添加 HTTP 配置前：

1. 在 Chrome 中加载 Chrome MCP 扩展。
2. 打开扩展弹窗。
3. 点击"连接"。
4. 确认弹窗显示本地桥接服务运行在端口 `12307`。

然后把下面配置添加到客户端的 MCP 设置里：

```json
{
  "mcpServers": {
    "chrome-mcp-http": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12307/mcp"
    }
  }
}
```

有些客户端使用短横线命名：

```json
{
  "mcpServers": {
    "chrome-mcp-http": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:12307/mcp"
    }
  }
}
```

如果客户端提示 server type 不合法，在 `streamableHttp` 和 `streamable-http` 之间切换。

排查：

- `Invalid or missing MCP session ID for SSE` 通常表示你把 URL 直接用浏览器打开了。这个 URL 需要添加到 Agent 的 MCP 配置里。
- Connection refused 表示扩展还没有启动本地桥接服务。打开扩展弹窗并点击"连接"。
- 如果弹窗里修改过端口，请使用弹窗显示的端口，而不是 `12307`。

## 🚀 安装和连接问题

### 快速诊断

如果遇到问题，运行诊断工具：

```bash
agent-chrome-mcp doctor
```

自动修复常见问题：

```bash
agent-chrome-mcp doctor --fix
```

### 点击扩展的连接按钮后如果没连接成功

1. **检查agent-chrome-mcp是否安装成功**，确保是全局安装的

```bash
agent-chrome-mcp -V
```

<img width="612" alt="截屏2025-06-11 15 09 57" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

2. **检查清单文件是否已放在正确目录**

路径：C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts

3. **检查日志**

日志现在存储在用户目录：`%LOCALAPPDATA%\chrome-mcp\logs\`

例如：`C:\Users\xxx\AppData\Local\chrome-mcp\logs\`

<img width="804" alt="截屏2025-06-11 15 09 41" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

4. **Node.js 路径问题**

如果使用 Node 版本管理器（nvm-windows、volta、fnm），可以设置环境变量：

```cmd
set CHROME_MCP_NODE_PATH=C:\path\to\your\node.exe
```

或者运行 `agent-chrome-mcp doctor --fix` 自动写入当前 Node 路径。
