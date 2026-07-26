# Chrome MCP 🚀

[![Stars](https://img.shields.io/github/stars/rudy2steiner/chrome-mcp)](https://img.shields.io/github/stars/rudy2steiner/chrome-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)
[![Release](https://img.shields.io/github/v/release/rudy2steiner/chrome-mcp.svg)](https://img.shields.io/github/v/release/rudy2steiner/chrome-mcp.svg)

> 🌟 **Turn your Chrome browser into an agent-powered work automation tool** - Let AI operate your own browser for research, operations, QA, data entry, content workflows, and coding tasks.

**📖 Documentation**: [English](README.md) | [中文](README_zh.md)

> The project is still in its early stages and is under intensive development. More features, stability improvements, and other enhancements will follow.

---

## 🎯 What is Chrome MCP?

Chrome MCP is a Chrome extension-based **Model Context Protocol (MCP) server** that exposes your own Chrome browser to AI agents. It is built for everyday browser work automation: research, data entry, operations tasks, QA checks, content workflows, shopping or travel workflows, and coding-adjacent tasks.

Unlike traditional browser automation tools (like Playwright), **Chrome MCP** directly uses your daily Chrome browser, preserving your existing tabs, login sessions, cookies, extensions, and settings. Any MCP-capable agent can operate the browser you already use instead of a separate automation browser.

## 🤝 Works with Trending Agents

Chrome MCP works with any MCP-capable agent—no vendor lock-in. Install the Chrome extension, then **ask your agent to connect it** with the prompt below.

### Cowork agents

- [Claude Cowork](https://claude.com/product/cowork)
- [ChatGPT](https://chatgpt.com)
- [QoderWork](https://qoder.com/qoderwork)

### Coding & other agents

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [OpenAI Codex](https://developers.openai.com/codex)
- [Cursor](https://cursor.com)
- [Cherry Studio](https://cherry-ai.com)
- [Augment](https://augmentcode.com)

### Ask your agent to connect it

Copy this prompt into your agent:

```text
Connect Chrome MCP to this agent.

Requirements:
- Use the simple npx config first.
- If this agent cannot start MCP stdio through npx, falls back to the direct Node.js config below.

Primary MCP server config:

{
  "mcpServers": {
    "chrome-mcp": {
      "command": "npx",
      "args": ["-y", "--registry=https://registry.npmjs.org", "agent-chrome-mcp@latest", "stdio"]
    }
  }
}

If prerequisites, extension loading, or fallback setup are missing, follow the manual install guide first:
https://github.com/rudy2steiner/chrome-mcp#-quick-start

Fallback if npx hangs or the agent cannot list MCP tools after the manual guide:
1. Run npm install -g --registry=https://registry.npmjs.org agent-chrome-mcp@latest
2. Resolve node path with: node -p "process.execPath"
3. Resolve global npm root with: npm root -g
4. Configure command as the absolute node path and args as:
   <global npm root>/agent-chrome-mcp/dist/mcp/mcp-server-stdio.js
5. Add env CHROME_MCP_SKIP_AUTO_REGISTER=1.

After updating the MCP config, tell me where you saved it and which config style you used. Remind me to restart the agent, confirm the Chrome extension is loaded from https://github.com/rudy2steiner/chrome-mcp/releases/latest if needed, and click Connect in the extension popup.
```

Restart the agent, then open the extension popup and click **Connect**. See [Quick Start](#-quick-start) for extension installation steps.

## ✨ New Features(2025/12/30)

- **A New Visual Editor for Claude Code & Codex**, for more detail here: [VisualEditor](docs/VisualEditor.md)

## ✨ Core Features

- 😁 **Agent/Model Agnostic**: Works with any MCP-capable agent or LLM client
- 🧩 **Work Automation**: Automate research, forms, admin workflows, QA checks, content tasks, and coding workflows from your normal browser
- ⭐️ **Use Your Original Browser**: Keep your tabs, login sessions, cookies, extensions, and settings
- 💻 **Fully Local**: Pure local MCP server ensuring user privacy
- 🚄 **Streamable HTTP**: Streamable HTTP connection method
- 🏎 **Cross-Tab**: Cross-tab context
- 🧠 **Semantic Search**: Built-in vector database for intelligent browser tab content discovery
- 🔍 **Smart Content Analysis**: AI-powered text extraction and similarity matching
- 🌐 **20+ Tools**: Screenshots, network monitoring, interaction, bookmarks, history, and more
- 🚀 **SIMD-Accelerated AI**: Custom WebAssembly SIMD optimization for 4-8x faster vector operations

See the maintained feature list: [docs/FEATURES.md](docs/FEATURES.md) | [中文](docs/FEATURES_zh.md)

## 🆚 Comparison with Similar Projects

| Comparison Dimension    | Playwright-based MCP Server                                                                                               | Chrome Extension-based MCP Server                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Resource Usage**      | ❌ Requires launching independent browser process, installing Playwright dependencies, downloading browser binaries, etc. | ✅ No need to launch independent browser process, directly utilizes user's already open Chrome browser |
| **User Session Reuse**  | ❌ Requires re-login                                                                                                      | ✅ Automatically uses existing login state                                                             |
| **Browser Environment** | ❌ Clean environment lacks user settings                                                                                  | ✅ Fully preserves user environment                                                                    |
| **API Access**          | ⚠️ Limited to Playwright API                                                                                              | ✅ Full access to Chrome native APIs                                                                   |
| **Startup Speed**       | ❌ Requires launching browser process                                                                                     | ✅ Only needs to activate extension                                                                    |
| **Response Speed**      | 50-200ms inter-process communication                                                                                      | ✅ Faster                                                                                              |

## 🚀 Quick Start

Install the Chrome extension, then ask your agent to add the MCP config with the copyable prompt below.

### Prerequisites

- Chrome/Chromium browser
- An MCP-capable cowork agent such as Claude Cowork, Claude Code, Codex, Cursor, QoderWork, or ChatGPT
- Node.js `20+`
- npm and npx available in your terminal; npx is bundled with npm in normal Node.js installs

The recommended setup starts with `npx` because it is the easiest path for most users. If an agent cannot keep a long-running MCP stdio server alive through `npx`, use the direct Node.js fallback.

### Installation Steps

1. **Download the latest release**
   - Download `chrome-mcp-extension.zip` from https://github.com/rudy2steiner/chrome-mcp/releases/latest
   - Unzip it.

2. **Load the Chrome extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the unzipped folder that contains `manifest.json`
   - Click the Chrome MCP extension icon
   - Click "Copy Configuration"
     <img width="475" alt="Screenshot 2025-06-09 15 52 06" src="https://github.com/user-attachments/assets/241e57b8-c55f-41a4-9188-0367293dc5bc" />

3. **Ask your agent to connect it**

Copy this prompt into your agent:

```text
Connect Chrome MCP to this agent.

Requirements:
- Use the simple npx config first.
- If this agent cannot start MCP stdio through npx, falls back to the direct Node.js config below.

Primary MCP server config:

{
  "mcpServers": {
    "chrome-mcp": {
      "command": "npx",
      "args": ["-y", "--registry=https://registry.npmjs.org", "agent-chrome-mcp@latest", "stdio"]
    }
  }
}

If prerequisites, extension loading, or fallback setup are missing, follow the manual install guide first:
https://github.com/rudy2steiner/chrome-mcp#-quick-start

Fallback if npx hangs or the agent cannot list MCP tools after the manual guide:
1. Run npm install -g --registry=https://registry.npmjs.org agent-chrome-mcp@latest
2. Resolve node path with: node -p "process.execPath"
3. Resolve global npm root with: npm root -g
4. Configure command as the absolute node path and args as:
   <global npm root>/agent-chrome-mcp/dist/mcp/mcp-server-stdio.js
5. Add env CHROME_MCP_SKIP_AUTO_REGISTER=1.

After updating the MCP config, tell me where you saved it and which config style you used. Remind me to restart the agent, confirm the Chrome extension is loaded from https://github.com/rudy2steiner/chrome-mcp/releases/latest if needed, and click Connect in the extension popup.
```

4. **Restart and connect**

Restart the agent. Then open the extension popup and click "Connect".

#### Manual MCP Config

If you prefer to edit the config yourself, add this to your agent MCP settings:

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

Then restart the agent and click "Connect" in the extension popup.

### Usage with MCP Protocol Clients

#### Using STDIO Connection (Recommended)

Add Chrome MCP as a normal stdio MCP server. The stdio entry point performs a best-effort Native Messaging registration on startup, so users do not need to know or copy the Chrome extension ID.

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

If `npx` hangs or your agent cannot list MCP tools, use the direct Node.js fallback:

```bash
npm install -g --registry=https://registry.npmjs.org agent-chrome-mcp@latest
node -p "process.execPath"
npm root -g
```

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "command": "<absolute node path>",
      "args": ["<npm root -g>/agent-chrome-mcp/dist/mcp/mcp-server-stdio.js"],
      "env": {
        "CHROME_MCP_SKIP_AUTO_REGISTER": "1"
      }
    }
  }
}
```

#### Using Streamable HTTP Connection

Use Streamable HTTP only when your MCP client supports HTTP MCP servers directly. For most local agents, stdio is still the recommended setup.

Before adding the HTTP config:

1. Load the Chrome MCP extension in Chrome.
2. Open the extension popup.
3. Click **Connect**.
4. Confirm the popup shows the local bridge running on port `12307`.

Then add this MCP server to your client:

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

Some clients use the kebab-case type name instead:

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

If your client reports an invalid server type, switch between `streamableHttp` and `streamable-http`.

Troubleshooting:

- `Invalid or missing MCP session ID for SSE` usually means the URL was opened directly in a browser tab. Add it as an MCP server in your agent instead.
- Connection refused means the extension has not started the local bridge yet. Open the extension popup and click **Connect**.
- If port `12307` was changed in the popup, use the port shown there.

eg：config in augment:

<img width="494" alt="截屏2025-06-22 22 11 25" src="https://github.com/user-attachments/assets/48eefc0c-a257-4d3b-8bbe-d7ff716de2bf" />

## 🛠️ Available Tools

Complete tool list: [Complete Tool List](docs/TOOLS.md)

<details>
<summary><strong>📊 Browser Management (6 tools)</strong></summary>

- `get_windows_and_tabs` - List all browser windows and tabs
- `chrome_navigate` - Navigate to URLs and control viewport
- `chrome_switch_tab` - Switch the current active tab
- `chrome_close_tabs` - Close specific tabs or windows
- `chrome_go_back_or_forward` - Browser navigation control
- `chrome_inject_script` - Inject content scripts into web pages
- `chrome_send_command_to_inject_script` - Send commands to injected content scripts
</details>

<details>
<summary><strong>📸 Screenshots & Visual (1 tool)</strong></summary>

- `chrome_screenshot` - Advanced screenshot capture with element targeting, full-page support, and custom dimensions
</details>

<details>
<summary><strong>🌐 Network Monitoring (4 tools)</strong></summary>

- `chrome_network_capture_start/stop` - webRequest API network capture
- `chrome_network_debugger_start/stop` - Debugger API with response bodies
- `chrome_network_request` - Send custom HTTP requests
</details>

<details>
<summary><strong>🔍 Content Analysis (4 tools)</strong></summary>

- `search_tabs_content` - AI-powered semantic search across browser tabs
- `chrome_get_web_content` - Extract HTML/text content from pages
- `chrome_get_interactive_elements` - Find clickable elements
- `chrome_console` - Capture and retrieve console output from browser tabs
</details>

<details>
<summary><strong>🎯 Interaction (3 tools)</strong></summary>

- `chrome_click_element` - Click elements using CSS selectors
- `chrome_fill_or_select` - Fill forms and select options
- `chrome_keyboard` - Simulate keyboard input and shortcuts
</details>

<details>
<summary><strong>📚 Data Management (5 tools)</strong></summary>

- `chrome_history` - Search browser history with time filters
- `chrome_bookmark_search` - Find bookmarks by keywords
- `chrome_bookmark_add` - Add new bookmarks with folder support
- `chrome_bookmark_delete` - Delete bookmarks
</details>

## 🧪 Usage Examples

### AI helps you summarize webpage content and automatically control Excalidraw for drawing

prompt: [excalidraw-prompt](prompt/excalidraw-prompt.md)
Instruction: Help me summarize the current page content, then draw a diagram to aid my understanding.
https://www.youtube.com/watch?v=3fBPdUBWVz0

https://github.com/user-attachments/assets/fd17209b-303d-48db-9e5e-3717141df183

### After analyzing the content of the image, the LLM automatically controls Excalidraw to replicate the image

prompt: [excalidraw-prompt](prompt/excalidraw-prompt.md)|[content-analize](prompt/content-analize.md)
Instruction: First, analyze the content of the image, and then replicate the image by combining the analysis with the content of the image.
https://www.youtube.com/watch?v=tEPdHZBzbZk

https://github.com/user-attachments/assets/60d12b1a-9b74-40f4-994c-95e8fa1fc8d3

### AI automatically injects scripts and modifies webpage styles

prompt: [modify-web-prompt](prompt/modify-web.md)
Instruction: Help me modify the current page's style and remove advertisements.
https://youtu.be/twI6apRKHsk

https://github.com/user-attachments/assets/69cb561c-2e1e-4665-9411-4a3185f9643e

### AI automatically captures network requests for you

query: I want to know what the search API for Xiaohongshu is and what the response structure looks like

https://youtu.be/1hHKr7XKqnQ

https://github.com/user-attachments/assets/dc7e5cab-b9af-4b9a-97ce-18e4837318d9

### AI helps analyze your browsing history

query: Analyze my browsing history from the past month

https://youtu.be/jf2UZfrR2Vk

https://github.com/user-attachments/assets/31b2e064-88c6-4adb-96d7-50748b826eae

### Web page conversation

query: Translate and summarize the current web page
https://youtu.be/FlJKS9UQyC8

https://github.com/user-attachments/assets/aa8ef2a1-2310-47e6-897a-769d85489396

### AI automatically takes screenshots for you (web page screenshots)

query: Take a screenshot of Hugging Face's homepage
https://youtu.be/7ycK6iksWi4

https://github.com/user-attachments/assets/65c6eee2-6366-493d-a3bd-2b27529ff5b3

### AI automatically takes screenshots for you (element screenshots)

query: Capture the icon from Hugging Face's homepage
https://youtu.be/ev8VivANIrk

https://github.com/user-attachments/assets/d0cf9785-c2fe-4729-a3c5-7f2b8b96fe0c

### AI helps manage bookmarks

query: Add the current page to bookmarks and put it in an appropriate folder

https://youtu.be/R_83arKmFTo

https://github.com/user-attachments/assets/15a7d04c-0196-4b40-84c2-bafb5c26dfe0

### Automatically close web pages

query: Close all shadcn-related web pages

https://youtu.be/2wzUT6eNVg4

https://github.com/user-attachments/assets/83de4008-bb7e-494d-9b0f-98325cfea592

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## 🚧 Future Roadmap

We have exciting plans for the future development of Chrome MCP:

- [ ] Authentication
- [ ] Recording and Playback
- [ ] Workflow Automation
- [ ] Enhanced Browser Support (Firefox Extension)

---

**Want to contribute to any of these features?** Check out our [Contributing Guide](docs/CONTRIBUTING.md) and join our development community!

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

Special thanks to the original [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome) project and its author, **hangye**, whose work laid the foundation for this project.

## 📚 More Documentation

Full index: [docs/README.md](docs/README.md) | [中文](docs/README_zh.md)

- [Architecture Design](docs/ARCHITECTURE.md) - Detailed technical architecture documentation | [中文](docs/ARCHITECTURE_zh.md)
- [Features](docs/FEATURES.md) - Maintained feature list | [中文](docs/FEATURES_zh.md)
- [TOOLS API](docs/TOOLS.md) - Complete tool API documentation | [中文](docs/TOOLS_zh.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issue solutions | [中文](docs/TROUBLESHOOTING_zh.md)
- [Windows Install Guide](docs/WINDOWS_INSTALL_zh.md) - Windows setup guide (中文)
- [CLI MCP Config](docs/mcp-cli-config.md) - Codex / Claude Code connection guide | [中文](docs/mcp-cli-config_zh.md)
- [Changelog](docs/CHANGELOG.md) - Version history | [中文](docs/CHANGELOG_zh.md)
- [Visual Editor](docs/VisualEditor.md) - Visual editor for Claude Code & Codex | [中文](docs/VisualEditor_zh.md)
