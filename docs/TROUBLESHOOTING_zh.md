# 🚀 安装和连接问题

**📖 文档**: [English](TROUBLESHOOTING.md) | [中文](TROUBLESHOOTING_zh.md)

## 快速诊断

运行诊断工具来识别常见问题：

```bash
agent-chrome-mcp doctor
```

自动修复常见问题：

```bash
agent-chrome-mcp doctor --fix
```

### 导出诊断报告

如果需要提交 Issue，可以导出诊断报告：

```bash
# 打印 Markdown 报告到终端（复制粘贴到 GitHub Issue）
agent-chrome-mcp report

# 写入到文件
agent-chrome-mcp report --output mcp-report.md

# 直接复制到剪贴板
agent-chrome-mcp report --copy
```

默认情况下，用户名、路径和令牌会被脱敏。如果你需要提供完整路径，可以使用 `--no-redact`。

### 常见问题

#### 连接成功，但是服务启动失败

启动失败基本上都是**权限问题**或者用包管理工具安装的**node**导致的启动脚本找不到对应的node。

**推荐先运行诊断工具：**

```bash
agent-chrome-mcp doctor
```

核心排查流程

1. npm包全局安装后，确认清单文件com.chromemcp.nativehost.json的位置，里面有一个**path**字段，指向的是一个启动脚本:

1.1 **检查agent-chrome-mcp是否安装成功**，确保是**全局安装**的

```bash
agent-chrome-mcp -V
```

<img width="612" alt="截屏2025-06-11 15 09 57" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

1.2 **检查清单文件是否已放在正确目录**

windows路径：C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts

mac路径： /Users/xxx/Library/Application\ Support/Google/Chrome/NativeMessagingHosts

如果npm包安装正常的话，这个目录下会生成一个`com.chromemcp.nativehost.json`

```json
{
  "name": "com.chromemcp.nativehost",
  "description": "Node.js Host for Browser Bridge Extension",
  "path": "/Users/xxx/Library/pnpm/global/5/.pnpm/agent-chrome-mcp@1.0.23/node_modules/agent-chrome-mcp/dist/run_host.sh",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/"]
}
```

> 如果发现没有此清单文件，可以尝试命令行执行：`agent-chrome-mcp register`

2. **检查日志**

日志现在存储在用户可写目录：

- **macOS**: `~/Library/Logs/chrome-mcp/`
- **Windows**: `%LOCALAPPDATA%\chrome-mcp\logs\`（例如 `C:\Users\xxx\AppData\Local\chrome-mcp\logs\`）
- **Linux**: `~/.local/state/chrome-mcp/logs/`

<img width="804" alt="截屏2025-06-11 15 09 41" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

3. 一般失败的原因就是两种

3.1. run_host.sh(windows是run_host.bat)没有执行权限：运行以下命令修复：

```bash
agent-chrome-mcp fix-permissions
```

3.2. 脚本找不到node：如果你使用 Node 版本管理工具（nvm、volta、asdf、fnm），可以设置 `CHROME_MCP_NODE_PATH` 环境变量：

```bash
export CHROME_MCP_NODE_PATH=/path/to/your/node
```

或者运行 `agent-chrome-mcp doctor --fix` 来写入当前 Node 路径。

3.3 如果排除了以上两种原因都不行，则查看日志目录的日志，然后提issue

### 日志位置

包装器日志现在存储在用户可写的位置：

- **macOS**: `~/Library/Logs/chrome-mcp/`
- **Windows**: `%LOCALAPPDATA%\chrome-mcp\logs\`
- **Linux**: `~/.local/state/chrome-mcp/logs/`

#### 工具执行超时

有可能长时间连接的时候session会超时，这个时候重新连接即可

#### 效果问题

不同的agent，不同的模型使用工具的效果是不一样的，这些都需要你自行尝试，我更推荐用聪明的agent，比如augment，claude code等等...
