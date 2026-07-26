# 🚀 Installation and Connection Issues

**📖 Documentation**: [English](TROUBLESHOOTING.md) | [中文](TROUBLESHOOTING_zh.md)

## Quick Diagnosis

Run the diagnostic tool to identify common issues:

```bash
agent-chrome-mcp doctor
```

To automatically fix common issues:

```bash
agent-chrome-mcp doctor --fix
```

## Export Report for GitHub Issues

If you need to open an issue, export a diagnostic report:

```bash
# Print Markdown report to terminal (copy/paste into GitHub Issue)
agent-chrome-mcp report

# Write to a file
agent-chrome-mcp report --output mcp-report.md

# Copy directly to clipboard
agent-chrome-mcp report --copy
```

By default, usernames, paths, and tokens are redacted. Use `--no-redact` if you're comfortable sharing full paths.

## If Connection Fails After Clicking the Connect Button on the Extension

1. **Run the diagnostic tool first**

```bash
agent-chrome-mcp doctor
```

This will check installation, manifest, permissions, and Node.js path.

2. **Check if agent-chrome-mcp is installed successfully**, ensure it's globally installed

```bash
agent-chrome-mcp -V
```

<img width="612" alt="Screenshot 2025-06-11 15 09 57" src="https://github.com/user-attachments/assets/59458532-e6e1-457c-8c82-3756a5dbb28e" />

2. **Check if the manifest file is in the correct directory**

Windows path: C:\Users\xxx\AppData\Roaming\Google\Chrome\NativeMessagingHosts

Mac path: /Users/xxx/Library/Application\ Support/Google/Chrome/NativeMessagingHosts

If the npm package is installed correctly, a file named `com.chromemcp.nativehost.json` should be generated in this directory

3. **Check logs**
   Logs are now stored in user-writable directories:

- **macOS**: `~/Library/Logs/chrome-mcp/`
- **Windows**: `%LOCALAPPDATA%\chrome-mcp\logs\`
- **Linux**: `~/.local/state/chrome-mcp/logs/`

<img width="804" alt="Screenshot 2025-06-11 15 09 41" src="https://github.com/user-attachments/assets/ce7b7c94-7c84-409a-8210-c9317823aae1" />

4. **Check if you have execution permissions**
   You need to check your installation path (if unclear, open the manifest file in step 2, the path field shows the installation directory). For example, if the Mac installation path is as follows:

`xxx/node_modules/agent-chrome-mcp/dist/run_host.sh`

Check if this script has execution permissions. Run to fix:

```bash
agent-chrome-mcp fix-permissions
```

5. **Node.js not found**
   If you use a Node version manager (nvm, volta, asdf, fnm), the wrapper script may not find Node.js. Set the `CHROME_MCP_NODE_PATH` environment variable:

```bash
export CHROME_MCP_NODE_PATH=/path/to/your/node
```

Or run `agent-chrome-mcp doctor --fix` to write the current Node path.

## Log Locations

Wrapper logs are now stored in user-writable locations:

- **macOS**: `~/Library/Logs/chrome-mcp/`
- **Windows**: `%LOCALAPPDATA%\chrome-mcp\logs\`
- **Linux**: `~/.local/state/chrome-mcp/logs/`
