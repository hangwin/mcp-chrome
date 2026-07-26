# 贡献指南 🤝

**📖 文档**: [English](CONTRIBUTING.md) | [中文](CONTRIBUTING_zh.md)

感谢您对 Chrome MCP 项目的贡献兴趣！本文档为贡献者提供指南和信息。

## 🎯 如何贡献

我们欢迎多种形式的贡献：

- 🐛 错误报告和修复
- ✨ 新功能和工具
- 📚 文档改进
- 🧪 测试和性能优化
- 🌐 翻译和国际化
- 💡 想法和建议

## 🚀 开始贡献

### 环境要求

- **Node.js 20+** 和 **pnpm**（最新版本）
- **Chrome/Chromium** 浏览器用于测试
- **Git** 版本控制
- **Rust**（用于 WASM 开发，可选）
- **TypeScript** 知识

### 开发环境设置

1. **Fork 并克隆仓库**

```bash
git clone https://github.com/YOUR_USERNAME/chrome-mcp-extension.git
cd chrome-mcp-extension
```

2. **安装依赖**

```bash
pnpm install
```

3. **启动项目**

```bash
npm run dev
```

4. **在 Chrome 中加载扩展**
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"，选择 `your/extension/dist`

## 🏗️ 项目结构

```
chrome-mcp-extension/
├── app/
│   ├── chrome-extension/     # Chrome 扩展 (WXT + Vue 3)
│   │   ├── entrypoints/      # 后台脚本、弹窗、内容脚本
│   │   ├── utils/            # AI 模型、向量数据库、工具
│   │   └── workers/          # 用于 AI 处理的 Web Workers
│   └── native-server/        # 原生消息服务器 (Fastify + TypeScript)
│       ├── src/mcp/          # MCP 协议实现
│       └── src/server/       # HTTP 服务器和原生消息
├── packages/
│   ├── shared/               # 共享类型和工具
│   └── wasm-simd/           # SIMD 优化的 WebAssembly 数学函数
└── docs/                    # 文档
```

## 🛠️ 开发工作流

### 添加新工具

1. **在 `packages/shared/src/tools.ts` 中定义工具模式**：

```typescript
{
  name: 'your_new_tool',
  description: '描述您的工具功能',
  inputSchema: {
    type: 'object',
    properties: {
      // 定义参数
    },
    required: ['param1']
  }
}
```

2. **在 `app/chrome-extension/entrypoints/background/tools/browser/` 中实现工具**：

```typescript
class YourNewTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.YOUR_NEW_TOOL;

  async execute(args: YourToolParams): Promise<ToolResult> {
    // 实现
  }
}
```

3. **在 `app/chrome-extension/entrypoints/background/tools/browser/index.ts` 中导出工具**

4. **在相应的测试目录中添加测试**

### 代码风格指南

- **TypeScript**：使用严格的 TypeScript 和适当的类型
- **ESLint**：遵循配置的 ESLint 规则（`pnpm lint`）
- **Prettier**：使用 Prettier 格式化代码（`pnpm format`）
- **命名**：使用描述性名称并遵循现有模式
- **注释**：为公共 API 添加 JSDoc 注释
- **错误处理**：始终优雅地处理错误

## 📝 Pull Request 流程

1. **创建功能分支**

```bash
git checkout -b feature/your-feature-name
```

2. **进行更改**
   - 遵循代码风格指南
   - 为新功能添加测试
   - 如需要，更新文档

3. **测试您的更改**
   - 确保所有现有测试通过
   - 手动测试 Chrome 扩展
   - 验证 MCP 协议兼容性

4. **提交您的更改**

```bash
git add .
git commit -m "feat: 添加您的功能描述"
```

我们使用 [约定式提交](https://www.conventionalcommits.org/)：

- `feat:` 用于新功能
- `fix:` 用于错误修复
- `docs:` 用于文档更改
- `test:` 用于添加测试
- `refactor:` 用于代码重构

5. **推送并创建 Pull Request**

```bash
git push origin feature/your-feature-name
```

## 🐛 错误报告

报告错误时，请包含：

- **环境**：操作系统、Chrome 版本、Node.js 版本
- **重现步骤**：清晰的分步说明
- **预期行为**：应该发生什么
- **实际行为**：实际发生了什么
- **截图/日志**：如果适用
- **MCP 客户端**：您使用的 MCP 客户端（Claude Desktop 等）

## 💡 功能请求

对于功能请求，请提供：

- **用例**：为什么需要这个功能？
- **建议解决方案**：它应该如何工作？
- **替代方案**：考虑过的任何替代解决方案？
- **附加上下文**：截图、示例等

## 🔧 开发技巧

### 使用 WASM SIMD

如果您要为 WASM SIMD 包做贡献：

```bash
cd packages/wasm-simd
# 如果尚未安装，请安装 Rust 和 wasm-pack
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack

# 构建 WASM 包
pnpm build

# 构建的文件将复制到 app/chrome-extension/workers/
```

### 调试 Chrome 扩展

- 使用 Chrome DevTools 调试扩展弹窗和后台脚本
- 检查 `chrome://extensions/` 查看扩展错误
- 使用 `console.log` 语句进行调试
- 在后台脚本中监控原生消息连接

### 测试 MCP 协议

- 使用 MCP Inspector 进行协议调试
- 使用不同的 MCP 客户端测试（Claude Desktop、自定义客户端）
- 验证工具模式和响应符合 MCP 规范

## 📚 资源

- [模型上下文协议规范](https://modelcontextprotocol.io/)
- [Chrome 扩展开发](https://developer.chrome.com/docs/extensions/)
- [WXT 框架文档](https://wxt.dev/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)

## 🤝 社区

- **GitHub Issues**：用于错误报告和功能请求
- **GitHub Discussions**：用于问题和一般讨论
- **Pull Requests**：用于代码贡献

## 📄 许可证

通过为 Chrome MCP 做贡献，您同意您的贡献将在 MIT 许可证下获得许可。

## 🎯 贡献者指南

### 新手贡献者

如果您是第一次为开源项目做贡献：

1. **从小处开始**：寻找标有 "good first issue" 的问题
2. **阅读代码**：熟悉项目结构和编码风格
3. **提问**：在 GitHub Discussions 中提出问题
4. **学习工具**：了解 Git、GitHub、TypeScript 等工具

### 经验丰富的贡献者

- **架构改进**：提出系统级改进建议
- **性能优化**：识别和修复性能瓶颈
- **新功能**：设计和实现复杂的新功能
- **指导新手**：帮助新贡献者入门

### 文档贡献

- **API 文档**：改进工具文档和示例
- **教程**：创建使用指南和最佳实践
- **翻译**：帮助翻译文档到其他语言
- **视频内容**：创建演示视频和教程

### 测试贡献

- **单元测试**：为新功能编写测试
- **集成测试**：测试组件间的交互
- **性能测试**：基准测试和性能回归检测
- **用户测试**：真实场景下的功能测试

## 🏆 贡献者认可

我们重视每一个贡献，无论大小。贡献者将在以下方式获得认可：

- **README 致谢**：在项目 README 中列出贡献者
- **发布说明**：在版本发布说明中感谢贡献者
- **贡献者徽章**：GitHub 个人资料上的贡献者徽章
- **社区认可**：在社区讨论中的特别感谢

感谢您考虑为 Chrome MCP 做贡献！您的参与使这个项目变得更好。
