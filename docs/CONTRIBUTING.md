# Contributing Guide 🤝

**📖 Documentation**: [English](CONTRIBUTING.md) | [中文](CONTRIBUTING_zh.md)

Thank you for your interest in contributing to Chrome MCP! This document provides guidelines and information for contributors.

## 🎯 How to Contribute

We welcome contributions in many forms:

- 🐛 Bug reports and fixes
- ✨ New features and tools
- 📚 Documentation improvements
- 🧪 Tests and performance optimizations
- 🌐 Translations and internationalization
- 💡 Ideas and suggestions

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** and **pnpm or npm** (latest version)
- **Chrome/Chromium** browser for testing
- **Git** for version control
- **Rust** (for WASM development, optional)
- **TypeScript** knowledge

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/chrome-mcp-extension.git
cd chrome-mcp-extension
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Start the project**

```bash
npm run dev
```

4. **Load the extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select `your/extension/dist`

## 🏗️ Project Structure

```
chrome-mcp-extension/
├── app/
│   ├── chrome-extension/     # Chrome extension (WXT + Vue 3)
│   │   ├── entrypoints/      # Background scripts, popup, content scripts
│   │   ├── utils/            # AI models, vector database, utilities
│   │   └── workers/          # Web Workers for AI processing
│   └── native-server/        # Native messaging server (Fastify + TypeScript)
│       ├── src/mcp/          # MCP protocol implementation
│       └── src/server/       # HTTP server and native messaging
├── packages/
│   ├── shared/               # Shared types and utilities
│   └── wasm-simd/           # SIMD-optimized WebAssembly math functions
└── docs/                    # Documentation
```

## 🛠️ Development Workflow

### Adding New Tools

1. **Define the tool schema in `packages/shared/src/tools.ts`**:

```typescript
{
  name: 'your_new_tool',
  description: 'Description of what your tool does',
  inputSchema: {
    type: 'object',
    properties: {
      // Define parameters
    },
    required: ['param1']
  }
}
```

2. **Implement the tool in `app/chrome-extension/entrypoints/background/tools/browser/`**:

```typescript
class YourNewTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.YOUR_NEW_TOOL;

  async execute(args: YourToolParams): Promise<ToolResult> {
    // Implementation
  }
}
```

3. **Export the tool in `app/chrome-extension/entrypoints/background/tools/browser/index.ts`**

4. **Add tests in the appropriate test directory**

### Code Style Guidelines

- **TypeScript**: Use strict TypeScript with proper typing
- **ESLint**: Follow the configured ESLint rules (`pnpm lint`)
- **Prettier**: Format code with Prettier (`pnpm format`)
- **Naming**: Use descriptive names and follow existing patterns
- **Comments**: Add JSDoc comments for public APIs
- **Error Handling**: Always handle errors gracefully

## 📝 Pull Request Process

1. **Create a feature branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   - Ensure all existing tests pass
   - Test the Chrome extension manually
   - Verify MCP protocol compatibility

4. **Commit your changes**

```bash
git add .
git commit -m "feat: add your feature description"
```

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for adding tests
- `refactor:` for code refactoring

5. **Push and create a Pull Request**

```bash
git push origin feature/your-feature-name
```

## 🐛 Bug Reports

When reporting bugs, please include:

- **Environment**: OS, Chrome version, Node.js version
- **Steps to reproduce**: Clear, step-by-step instructions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots/logs**: If applicable
- **MCP client**: Which MCP client you're using (Claude Desktop, etc.)

## 💡 Feature Requests

For feature requests, please provide:

- **Use case**: Why is this feature needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Any alternative solutions considered?
- **Additional context**: Screenshots, examples, etc.

## 🔧 Development Tips

### Using WASM SIMD

If you're contributing to the WASM SIMD package:

```bash
cd packages/wasm-simd
# Install Rust and wasm-pack if not already installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack

# Build WASM package
pnpm build

# The built files will be copied to app/chrome-extension/workers/
```

### Debugging Chrome Extension

- Use Chrome DevTools for debugging extension popup and background scripts
- Check `chrome://extensions/` for extension errors
- Use `console.log` statements for debugging
- Monitor the native messaging connection in the background script

### Testing MCP Protocol

- Use MCP Inspector for protocol debugging
- Test with different MCP clients (Claude Desktop, custom clients)
- Verify tool schemas and responses match MCP specifications

## 📚 Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [WXT Framework Documentation](https://wxt.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Community

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Requests**: For code contributions

## 📄 License

By contributing to Chrome MCP, you agree that your contributions will be licensed under the MIT License.

## 🎯 Contributor Guidelines

### New Contributors

If you're contributing to an open source project for the first time:

1. **Start small**: Look for issues labeled "good first issue"
2. **Read the code**: Familiarize yourself with the project structure and coding style
3. **Ask questions**: Ask questions in GitHub Discussions
4. **Learn the tools**: Get familiar with Git, GitHub, TypeScript, and other tools

### Experienced Contributors

- **Architecture improvements**: Propose system-level improvements
- **Performance optimization**: Identify and fix performance bottlenecks
- **New features**: Design and implement complex new features
- **Mentor newcomers**: Help new contributors get started

### Documentation Contributions

- **API documentation**: Improve tool documentation and examples
- **Tutorials**: Create usage guides and best practices
- **Translations**: Help translate documentation to other languages
- **Video content**: Create demo videos and tutorials

### Testing Contributions

- **Unit tests**: Write tests for new features
- **Integration tests**: Test interactions between components
- **Performance tests**: Benchmark testing and performance regression detection
- **User testing**: Functional testing in real-world scenarios

## 🏆 Contributor Recognition

We value every contribution, no matter how big or small. Contributors will be recognized in the following ways:

- **README acknowledgments**: Contributors listed in the project README
- **Release notes**: Contributors thanked in version release notes
- **Contributor badges**: Contributor badges on GitHub profiles
- **Community recognition**: Special thanks in community discussions

Thank you for considering contributing to Chrome MCP! Your participation makes this project better.
