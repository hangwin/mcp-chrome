# Chrome MCP Server 🚀

[![许可证: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome 扩展](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)

> 🌟 **让chrome浏览器变成你的智能助手** - 让AI接管你的浏览器，将您的浏览器转变为强大的 AI 控制自动化工具。

**📖 文档**: [English](README.md) | [中文](README_zh.md)

> 项目仍处于早期阶段，正在紧锣密鼓开发中，后续将有更多新功能，以及稳定性等的提升，如遇bug，请轻喷

---

## 🎯 什么是 Chrome MCP Server？

Chrome MCP Server 是一个基于chrome插件的 **模型上下文协议 (MCP) 服务器**，它将您的 Chrome 浏览器功能暴露给 Claude 等 AI 助手，实现复杂的浏览器自动化、内容分析和语义搜索等。与传统的浏览器自动化工具（如playwright）不同，**Chrome MCP server**直接使用您日常使用的chrome浏览器，基于现有的用户习惯和配置、登录态，让各种大模型或者各种chatbot都可以接管你的浏览器，真正成为你的日常助手

## ✨ 船新的功能(2025/12/30)

- **让Claude Code/Codex也能使用的可视化编辑器**, 更多详情请看: [VisualEditor](docs/VisualEditor_zh.md)

## ✨ 核心特性

- 😁 **chatbot/模型无关**：让任意你喜欢的llm或chatbot客户端或agent来自动化操作你的浏览器
- ⭐️ **使用你原本的浏览器**：无缝集成用户本身的浏览器环境（你的配置、登录态等）
- 💻 **完全本地运行**：纯本地运行的mcp server，保证用户隐私
- 🚄 **Streamable http**：Streamable http的连接方式
- 🏎 **跨标签页** 跨标签页的上下文
- 🧠 **语义搜索**：内置向量数据库和本地小模型，智能发现浏览器标签页内容
- 🔍 **智能内容分析**：AI 驱动的文本提取和相似度匹配
- 🌐 **20+ 工具**：支持截图、网络监控、交互操作、书签管理、浏览历史等20多种工具
- 🚀 **SIMD 加速 AI**：自定义 WebAssembly SIMD 优化，向量运算速度提升 4-8 倍

## 🆚 与同类项目对比

| 对比维度           | 基于Playwright的MCP Server                                          | 基于Chrome插件的MCP Server                                    |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| **资源占用**       | ❌ 需启动独立浏览器进程，需要安装Playwright依赖，下载浏览器二进制等 | ✅ 无需启动独立的浏览器进程，直接利用用户已打开的Chrome浏览器 |
| **用户会话复用**   | ❌ 需重新登录                                                       | ✅ 自动使用已登录状态                                         |
| **浏览器环境保持** | ❌ 干净环境缺少用户设置                                             | ✅ 完整保留用户环境                                           |
| **API访问权限**    | ⚠️ 受限于Playwright API                                             | ✅ Chrome原生API全访问                                        |
| **启动速度**       | ❌ 需启动浏览器进程                                                 | ✅ 只需激活插件                                               |
| **响应速度**       | 50-200ms进程间通信                                                  | ✅ 更快                                                       |

## 🚀 快速开始

### 环境要求

- Node.js >= 20.0.0 和 （npm 或 pnpm）
- Chrome/Chromium 浏览器

### 安装步骤

1. **从github上下载最新的chrome扩展**

下载地址：https://github.com/hangwin/mcp-chrome/releases

2. **全局安装mcp-chrome-bridge**

npm

```bash
npm install -g mcp-chrome-bridge
```

pnpm

```bash
# 方法1：全局启用脚本（推荐）
pnpm config set enable-pre-post-scripts true
pnpm install -g mcp-chrome-bridge

# 方法2：如果 postinstall 没有运行，手动注册
pnpm install -g mcp-chrome-bridge
mcp-chrome-bridge register
```

> 注意：pnpm v7+ 默认禁用 postinstall 脚本以提高安全性。`enable-pre-post-scripts` 设置控制是否运行 pre/post 安装脚本。如果自动注册失败，请使用上述手动注册命令。

3. **加载 Chrome 扩展**
   - 打开 Chrome 并访问 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"，选择 `your/dowloaded/extension/folder`
   - 点击插件图标打开插件，点击连接即可看到mcp的配置
     <img width="475" alt="截屏2025-06-09 15 52 06" src="https://github.com/user-attachments/assets/241e57b8-c55f-41a4-9188-0367293dc5bc" />

### 在支持MCP协议的客户端中使用

#### 使用streamable http的方式连接（👍🏻推荐）

将以下配置添加到客户端的 MCP 配置中以cherryStudio为例：

> 推荐用streamable http的连接方式

```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

#### 使用stdio的方式连接（备选）

假设你的客户端仅支持stdio的连接方式，那么请使用下面的方法：

1. 先查看你刚刚安装的npm包的安装位置

```sh
# npm 查看方式
npm list -g mcp-chrome-bridge
# pnpm 查看方式
pnpm list -g mcp-chrome-bridge
```

假设上面的命令输出的路径是：/Users/xxx/Library/pnpm/global/5
那么你的最终路径就是：/Users/xxx/Library/pnpm/global/5/node_modules/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js

2. 把下面的配置替换成你刚刚得到的最终路径

```json
{
  "mcpServers": {
    "chrome-mcp-stdio": {
      "command": "npx",
      "args": [
        "node",
        "/Users/xxx/Library/pnpm/global/5/node_modules/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js"
      ]
    }
  }
}
```

比如：在augment中的配置如下：

<img width="494" alt="截屏2025-06-22 22 11 25" src="https://github.com/user-attachments/assets/07c0b090-622b-433d-be70-44e8cb8980a5" />

## 🛠️ 可用工具

完整工具列表：[完整工具列表](docs/TOOLS_zh.md)

<details>
<summary><strong>📊 浏览器管理 (6个工具)</strong></summary>

- `get_windows_and_tabs` - 列出所有浏览器窗口和标签页
- `chrome_navigate` - 导航到 URL 并控制视口
- `chrome_switch_tab` - 切换当前显示的标签页
- `chrome_close_tabs` - 关闭特定标签页或窗口
- `chrome_go_back_or_forward` - 浏览器导航控制
- `chrome_inject_script` - 向网页注入内容脚本
- `chrome_send_command_to_inject_script` - 向已注入的内容脚本发送指令
</details>

<details>
<summary><strong>🗂️ 标签页分组 (5个工具)</strong></summary>

- `chrome_tab_group_create` - 将一个或多个标签页组成新分组（可选标题/颜色/窗口）
- `chrome_tab_group_update` - 重命名分组、修改颜色或折叠/展开
- `chrome_tab_group_add_tabs` - 把已有标签页加入到已有分组
- `chrome_tab_group_close` - 关闭分组中的所有标签页
- `chrome_tab_group_list` - 列出所有分组（可按窗口/颜色/标题/折叠状态筛选），并附带分组内标签页 ID

需要 Chrome 89+，并已在 manifest 中声明 `tabGroups` 权限。

</details>

<details>
<summary><strong>📸 截图和视觉 (1个工具)</strong></summary>

- `chrome_screenshot` - 高级截图捕获，支持元素定位、全页面和自定义尺寸
</details>

<details>
<summary><strong>🌐 网络监控 (4个工具)</strong></summary>

- `chrome_network_capture_start/stop` - webRequest API 网络捕获
- `chrome_network_debugger_start/stop` - Debugger API 包含响应体
- `chrome_network_request` - 发送自定义 HTTP 请求
</details>

<details>
<summary><strong>🔍 内容分析 (4个工具)</strong></summary>

- `search_tabs_content` - AI 驱动的浏览器标签页语义搜索
- `chrome_get_web_content` - 从页面提取 HTML/文本内容
- `chrome_get_interactive_elements` - 查找可点击元素
- `chrome_console` - 捕获和获取浏览器标签页的控制台输出
</details>

<details>
<summary><strong>🎯 交互操作 (3个工具)</strong></summary>

- `chrome_click_element` - 使用 CSS 选择器点击元素
- `chrome_fill_or_select` - 填充表单和选择选项
- `chrome_keyboard` - 模拟键盘输入和快捷键
</details>

<details>
<summary><strong>📚 数据管理 (5个工具)</strong></summary>

- `chrome_history` - 搜索浏览器历史记录，支持时间过滤
- `chrome_bookmark_search` - 按关键词查找书签
- `chrome_bookmark_add` - 添加新书签，支持文件夹
- `chrome_bookmark_delete` - 删除书签
</details>

## 🧪 使用示例

### ai帮你总结网页内容然后自动控制excalidraw画图

prompt: [excalidraw-prompt](prompt/excalidraw-prompt.md)
指令：帮我总结当前页面内容，然后画个图帮我理解
https://www.youtube.com/watch?v=3fBPdUBWVz0

https://github.com/user-attachments/assets/f14f79a6-9390-4821-8296-06d020bcfc07

### ai先分析图片的内容元素，然后再自动控制excalidraw把图片模仿出来

prompt: [excalidraw-prompt](prompt/excalidraw-prompt.md)|[content-analize](prompt/content-analize.md)
指令：先看下图片是否能用excalidraw画出来，如果则列出所需的步骤和元素，然后画出来
https://www.youtube.com/watch?v=tEPdHZBzbZk

https://github.com/user-attachments/assets/4f0600c1-bb1e-4b57-85ab-36c8bdf71c68

### ai自动帮你注入脚本并修改网页的样式

prompt: [modify-web-prompt](prompt/modify-web.md)
指令：帮我修改当前页面的样式，去掉广告
https://youtu.be/twI6apRKHsk

https://github.com/user-attachments/assets/aedbe98d-e90c-4a58-a4a5-d888f7293d8e

### ai自动帮你捕获网络请求

指令：我想知道小红书的搜索接口是哪个，响应体结构是什么样的
https://youtu.be/1hHKr7XKqnQ

https://github.com/user-attachments/assets/dc7e5cab-b9af-4b9a-97ce-18e4837318d9

### ai帮你分析你的浏览记录

指令：分析一下我近一个月的浏览记录
https://youtu.be/jf2UZfrR2Vk

https://github.com/user-attachments/assets/31b2e064-88c6-4adb-96d7-50748b826eae

### 网页对话

指令：翻译并总结当前网页
https://youtu.be/FlJKS9UQyC8

https://github.com/user-attachments/assets/aa8ef2a1-2310-47e6-897a-769d85489396

### ai帮你自动截图（网页截图）

指令：把huggingface的首页截个图
https://youtu.be/7ycK6iksWi4

https://github.com/user-attachments/assets/65c6eee2-6366-493d-a3bd-2b27529ff5b3

### ai帮你自动截图（元素截图）

指令：把huggingface首页的图标截取下来
https://youtu.be/ev8VivANIrk

https://github.com/user-attachments/assets/d0cf9785-c2fe-4729-a3c5-7f2b8b96fe0c

### ai帮你管理书签

指令：将当前页面添加到书签中，放到合适的文件夹
https://youtu.be/R_83arKmFTo

https://github.com/user-attachments/assets/15a7d04c-0196-4b40-84c2-bafb5c26dfe0

### 自动关闭网页

指令：关闭所有shadcn相关的网页
https://youtu.be/2wzUT6eNVg4

https://github.com/user-attachments/assets/83de4008-bb7e-494d-9b0f-98325cfea592

## 🤝 贡献指南

我们欢迎贡献！请查看 [CONTRIBUTING_zh.md](docs/CONTRIBUTING_zh.md) 了解详细指南。

## 🚧 未来发展路线图

我们对 Chrome MCP Server 的未来发展有着激动人心的计划：

- [ ] 身份认证

- [ ] 录制与回放

- [ ] 工作流自动化

- [ ] 增强浏览器支持（Firefox 扩展）

---

**想要为这些功能中的任何一个做贡献？** 查看我们的[贡献指南](docs/CONTRIBUTING_zh.md)并加入我们的开发社区！

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 📚 更多文档

- [架构设计](docs/ARCHITECTURE_zh.md) - 详细的技术架构说明
- [工具列表](docs/TOOLS_zh.md) - 完整的工具 API 文档
- [故障排除](docs/TROUBLESHOOTING_zh.md) - 常见问题解决方案

## 微信交流群

拉群的目的是让踩过坑的大佬们互相帮忙解答问题，因本人平时要忙着搬砖，不一定能及时解答

![IMG_6296](https://github.com/user-attachments/assets/ecd2e084-24d2-4038-b75f-3ab020b55594)
