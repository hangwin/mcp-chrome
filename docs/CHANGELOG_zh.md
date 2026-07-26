# 更新日志

**📖 文档**: [English](CHANGELOG.md) | [中文](CHANGELOG_zh.md)

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- 产品讲解 WebM 录制工具 `chrome_demo_recorder`（`start` / `step` / `stop`），支持 `product` / `compact` 预设、分步标题/旁白字幕，以及可用于生成字幕的步骤时间轴。

## [v1.0.35]

### 新增

- Claude 风格的 MCP 固定标签组工具：`chrome_tabs_context`、`chrome_tabs_create`、`chrome_tabs_adopt`（组名为 **"Chrome MCP"**）。
- `get_windows_and_tabs` 现在返回每个标签是否属于 `mcpGroup`。
- 增加端到端校验脚本 `scripts/e2e-tab-group.mjs`。

### 变更

- 产品展示名简化为 **Chrome MCP**（扩展 UI、文档、推荐 MCP 配置键 `chrome-mcp`）。npm 包名仍为 `agent-chrome-mcp`。
- 仓库/文档/发布资产统一为 `chrome-mcp`（GitHub URL、扩展 zip `chrome-mcp-extension.zip`、HTTP 配置键 `chrome-mcp-http`）。npm 包名不变。
- Native Messaging host 改名为 `com.chromemcp.nativehost`（升级后请重新执行 `agent-chrome-mcp register`）。
- 浏览器工具默认后台运行（`background` 默认为 true），navigate/fetch/screenshot/console 不再抢占标签/窗口焦点，除非显式传入 `background: false`。
- 导航新建标签在已有 MCP 固定组时会自动加入该组。
- GIF 录制 / 自动捕获与 offscreen 编码器改进。
- 将 native bridge、Chrome 扩展与 shared 包版本提升至 `1.0.35`。

### 修复

- 网络捕获在打开目标 URL 时不再强制激活标签页。

## [v1.0.34]

### 变更

- 为每个 SSE 和 streamable HTTP 会话创建独立的 MCP server 实例，避免一个 SDK server 在多个 transport 之间复用。
- 保持 npx 优先安装路径，同时为严格 stdio 客户端保留直接 Node.js 回退方案。
- 扩展 Streamable HTTP 连接文档，补充配置变体、连接顺序和排查说明。
- 将 native bridge 和 Chrome 扩展包版本提升至 `1.0.34`。

## [v1.0.33]

### 新增

- Agent 优先连接提示词，用户可让 MCP Agent 代为添加配置，并在需要时处理回退方案。
- 面向 npm 用户的 `agent-chrome-mcp` 安装指南。
- 使用 `--registry=https://registry.npmjs.org` 的注册表安全 `npx` MCP 配置。
- 在 `docs/FEATURES.md` 中维护功能列表。
- 致谢原始项目 `hangwin/mcp-chrome` 及其作者 `hangye`。

### 变更

- 将产品定位从编码 Agent 安装扩展为通用浏览器工作自动化。
- 围绕 `npx` 优先、直接 Node.js 回退的方式重构安装说明。
- 说明部分客户端的 `npx`/`npm exec` 包装层可能导致长期运行的 MCP stdio server 卡住，因此需要直接 Node.js 回退方案。
- 更新扩展弹窗可复制 MCP 配置，使用注册表安全的 `npx` 命令。
- 更新 release 工作流生成的 MCP 配置和 release 安装说明。
- 替换原先描述内部 Fastify 服务的 native 包 README，改为面向用户的 npm 指南。
- 将 native bridge 和 Chrome 扩展包版本提升至 `1.0.33`。

### 修复

- 避免用户机器默认使用未同步 `agent-chrome-mcp` 的私有 npm 镜像时安装失败。
- 通过确保 native 包不发布 `workspace:*` 依赖，使 npm 包发布更安全。

## [v1.0.32]

### 新增

- 发布重命名后的 Chrome MCP bridge npm 包：
  - `agent-chrome-mcp`
  - `agent-chrome-mcp-shared`
- 新增 `agent-chrome-mcp stdio` 作为推荐的 Agent 入口。
- 在扩展弹窗中新增简化的 MCP 配置生成。

### 变更

- 将项目重命名/重新定位为 Chrome MCP。
- 将默认 bridge 端口改为 `12307`，避免与旧安装冲突。
- 更新 release 工作流以构建、测试、打包并发布 native bridge 和扩展。

## [v0.0.5]

### 改进

- **图片压缩**：使用截图工具时压缩 base64 图片
- **交互元素检测优化**：增强交互元素检测工具，扩大搜索范围，现支持查找可交互的 div 元素

## [v0.0.4]

### 新增

- **STDIO 连接支持**：新增通过标准输入/输出（stdio）连接 MCP 服务器的方式
- **控制台输出捕获工具**：新增 `chrome_console` 工具，用于捕获浏览器控制台输出

## [v0.0.3]

### 新增

- **注入脚本工具**：向网页注入内容脚本
- **向注入脚本发送命令工具**：向已注入脚本发送命令

## [v0.0.2]

### 新增

- **条件式语义引擎初始化**：基于缓存的智能初始化，仅在存在缓存版本时加载模型
- **增强模型缓存管理**：完整的缓存管理系统，支持自动清理和大小限制
- **Windows 平台兼容性**：通过基于注册表的 manifest 检测，完整支持 Windows Chrome Native Messaging
- **缓存统计与手动管理**：用于查看缓存统计和手动清理的用户界面
- **并发初始化保护**：防止跨组件重复初始化

### 改进

- **启动性能**：无模型缓存时显著缩短启动时间（从约 3 秒降至约 0.5 秒）
- **内存使用**：通过按需加载模型优化内存消耗
- **缓存过期逻辑**：智能缓存过期（14 天）及自动清理
- **错误处理**：增强模型初始化失败的错误处理
- **组件协调**：简化语义引擎与内容索引器之间的初始化流程

### 修复

- **Windows Native Host 问题**：解决多 NVM 安装导致的 Node.js 环境冲突
- **竞态条件防护**：消除可能导致冲突的并发初始化
- **缓存大小管理**：缓存超过 500MB 时自动清理
- **模型下载优化**：避免插件启动时不必要的模型下载

### 技术改进

- **ModelCacheManager**：新增 `isModelCached()` 和 `hasAnyValidCache()` 缓存检测方法
- **SemanticSimilarityEngine**：新增缓存检查函数和条件式初始化逻辑
- **Background Script**：基于缓存可用性实现智能初始化
- **VectorSearchTool**：简化为被动初始化模型
- **ContentIndexer**：增强语义引擎就绪检查

### 文档

- 新增条件式初始化完整文档
- 更新缓存管理系统文档
- 新增 Windows 平台问题故障排除指南

## [v0.0.1]

### 新增

- **核心浏览器工具**：完整的浏览器自动化工具集
  - **点击工具**：支持坐标和选择器的智能元素点击
  - **填充工具**：表单填写，支持文本输入和选择
  - **截图工具**：整页和元素级截图
  - **导航工具**：URL 导航和页面交互
  - **键盘工具**：键盘输入模拟和快捷键支持

- **向量搜索引擎**：高级语义搜索能力
  - **内容索引**：自动索引浏览器标签页内容
  - **语义相似度**：AI 驱动的文本相似度匹配
  - **向量数据库**：高效的嵌入存储和检索
  - **多语言支持**：全面的多语言文本处理

- **Native Host 集成**：与外部应用的无缝通信
  - **Chrome Native Messaging**：双向通信通道
  - **跨平台支持**：Windows、macOS 和 Linux 兼容
  - **消息协议**：用于工具执行的结构化消息系统

- **AI 模型集成**：用于语义处理的最先进语言模型
  - **Transformer 模型**：支持多种预训练模型
  - **ONNX Runtime**：通过 WebAssembly 优化模型推理
  - **模型管理**：动态模型加载和切换
  - **性能优化**：SIMD 加速和内存池

- **用户界面**：直观的扩展管理弹窗
  - **模型选择**：轻松切换不同 AI 模型
  - **状态监控**：实时初始化和下载进度
  - **设置管理**：用户偏好和配置选项
  - **缓存管理**：可视化缓存统计和清理控制

### 技术基础

- **扩展架构**：稳健的 Chrome 扩展，含 background scripts 和内容注入
- **Worker 处理**：用于重计算任务的离屏文档
- **内存管理**：LRU 缓存和高效资源利用
- **错误处理**：全面的错误报告和恢复机制
- **TypeScript 实现**：完整类型安全和现代 JavaScript 特性

### 初始功能

- 多标签页内容分析和搜索
- 实时语义相似度计算
- 自动化网页交互
- 跨平台 native messaging
- 可扩展工具框架，便于未来增强
