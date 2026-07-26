# 功能列表

**📖 文档**: [English](FEATURES.md) | [中文](FEATURES_zh.md)

本文件是 Chrome MCP 当前功能列表的权威来源。每当发布版本新增、移除或实质性改变用户可见能力时，请同步更新本文件。

Chrome MCP 面向基于浏览器的工作自动化，不只限于编码场景。目标场景包括资料调研、表单录入、运营后台、QA 检查、内容工作流、购物/旅行流程，以及编码相关的浏览器任务。

## 安装与分发

- **Agent 优先连接提示词**：用户可以让任意支持 MCP 的 Agent 代为添加 MCP 配置，并在需要时处理回退方案。
- **npx 优先安装**：推荐配置使用带 `--registry=https://registry.npmjs.org` 的 `npx`，提供最简单的安装路径。
- **直接 Node.js 回退方案**：严格 MCP 客户端如果通过 `npx` 卡住，可以直接用 Node.js 启动已安装的 stdio server 文件。
- **注册表安全的 npm 配置**：推荐配置包含 `--registry=https://registry.npmjs.org`，避免私有 npm 镜像问题。
- **Chrome 扩展发布 zip**：用户从 release 产物加载已解压的扩展。
- **扩展弹窗可复制配置**：扩展中展示推荐的 MCP 服务器配置。

## 浏览器控制

- 列出 Chrome 窗口和标签页。
- **MCP 固定分组**（类 Claude）：通过 `chrome_tabs_context` / `chrome_tabs_create` / `chrome_tabs_adopt` 使用名为 **"Chrome MCP"** 的标签组。
- 导航页面并控制活动标签页。
- **后台优先焦点**：工具默认不激活标签、不抢占 Chrome 窗口焦点；需要前台时传 `background: false`。
- 点击、输入、滚动和发送键盘命令。
- 注入脚本并与注入的辅助脚本通信。
- 截图，包括整页和元素级截图。
- 管理书签和浏览历史。

## 工作自动化场景

- 跨多个网站进行资料调研和信息收集。
- 表单填写、数据录入和重复性后台操作。
- 需要已有登录态的运营后台和内部工具。
- QA 检查、视觉巡检和浏览器状态验证。
- 内容工作流，如收集参考资料、发布草稿或更新 Web 应用。
- 购物、旅行等受益于已有 cookies 和会话的消费者工作流。
- 编码相关的浏览器任务，如测试本地应用、检查页面和收集截图。

## 浏览器上下文

- 使用用户现有的 Chrome 浏览器，而不是启动单独的自动化浏览器。
- 复用已有登录态、cookies、标签页、扩展和浏览器设置。
- 跨多个标签页和窗口工作。
- 自动化保持在用户本机本地运行。

## MCP 集成

- 面向 Agent 客户端的 stdio MCP 桥接。
- 面向高级客户端的 Streamable HTTP 端点。
- 适用于支持 MCP 的 Agent 和客户端，覆盖编码、调研、运营、内容、QA 及其他基于浏览器的工作流。
- 通过扩展与 native bridge 共享的 MCP schema 暴露浏览器工具。

## 搜索与分析

- 对浏览器内容进行语义搜索。
- 本地向量索引和相似度匹配。
- 用于页面分析的智能内容提取。
- 扩展 UI 中的本地模型和缓存管理。

## 发布与维护工具

- npm 包：
  - `agent-chrome-mcp`
  - `agent-chrome-mcp-shared`
- Release 工作流会构建并测试 shared 包、native bridge 和 Chrome 扩展。
- Release 工作流会发布 npm 包，并上传扩展 zip 与 MCP 配置。
- 安装和连接故障排查诊断命令：
  - `agent-chrome-mcp doctor`
  - `agent-chrome-mcp doctor --fix`

## 维护规则

每次发布时：

1. 更新本文件以反映当前功能面。
2. 在 `docs/CHANGELOG.md` 和 `docs/CHANGELOG_zh.md` 中记录版本变更。
3. 保持 README 亮点简洁，并链接回本文件。
