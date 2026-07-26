# Chrome MCP

**📖 文档**: [English](https://github.com/rudy2steiner/chrome-mcp/blob/master/app/native-server/README.md) | [中文](https://github.com/rudy2steiner/chrome-mcp/blob/master/app/native-server/README_zh.md)

将你的 Chrome 浏览器作为 MCP 服务器，供工作自动化 Agent 和支持 MCP 的客户端使用。

Chrome MCP 让 Agent 检查并操作你已经在使用的 Chrome 浏览器，包括已有登录态、标签页、cookies 和扩展。适用于资料调研、表单录入、运营工作流、QA 检查、内容工作流和编码任务。

## 安装

大多数用户不需要手动安装本包。在 Agent 的 MCP 配置中通过 `npx` 使用即可。

### 1. 安装 Chrome 扩展

1. 从以下地址下载最新版 `chrome-mcp-extension.zip`：
   https://github.com/rudy2steiner/chrome-mcp/releases/latest
2. 解压 zip 文件。
3. 打开 Chrome 并访问 `chrome://extensions/`。
4. 启用开发者模式。
5. 点击“加载已解压的扩展程序”。
6. 选择包含 `manifest.json` 的解压目录。

### 2. 让 Agent 帮你安装

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

### 3. 重启并连接

重启 Agent。然后打开 Chrome MCP 扩展弹窗并点击**连接**。

之后，Agent 应能列出并调用 Chrome 工具。

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

然后重启 Agent，并在 Chrome 扩展弹窗中点击**连接**。

显式的 npm registry 参数可避免机器配置为使用尚未同步本包的私有或镜像 npm registry 时安装失败。

## 快速测试

检查 npm 是否能运行 bridge：

```bash
npx -y --registry=https://registry.npmjs.org agent-chrome-mcp@latest --version
```

要进行真实的 MCP stdio 测试，将上述配置添加到 Agent 并重启。

## 可选：全局安装

如果你偏好全局安装：

```bash
npm install -g agent-chrome-mcp
```

然后使用此 MCP 配置：

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

## 故障排除

### npx 提示找不到包

你的 npm registry 可能设置为私有镜像。请使用显式 registry 配置：

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

或更改 npm registry：

```bash
npm config set registry https://registry.npmjs.org
```

### 扩展无法连接

运行：

```bash
npx -y --registry=https://registry.npmjs.org agent-chrome-mcp@latest doctor
```

尝试自动修复：

```bash
npx -y --registry=https://registry.npmjs.org agent-chrome-mcp@latest doctor --fix
```

## 本包的作用

本包是 Agent 启动的本地 MCP 桥接服务。Chrome 扩展连接到本地 bridge，bridge 通过 MCP stdio 向 Agent 暴露 Chrome 工具。

普通用户只需要：

1. Chrome 扩展
2. MCP 配置
3. 点击连接

无需全局 npm 安装。

## 许可证

MIT

## 致谢

特别感谢原始项目 [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome) 及其作者 **hangye**，本项目是在其工作基础上继续演进而来。
