# Changelog

**📖 Documentation**: [English](CHANGELOG.md) | [中文](CHANGELOG_zh.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.0.35]

### Added

- Claude-style MCP pin group tools: `chrome_tabs_context`, `chrome_tabs_create`, and `chrome_tabs_adopt` (labeled **"Chrome MCP"** tab group).
- `get_windows_and_tabs` now reports `mcpGroup` membership for each tab.
- End-to-end helper script `scripts/e2e-tab-group.mjs` for pin-group verification.

### Changed

- Product display name simplified to **Chrome MCP** (extension UI, docs, and recommended MCP config key `chrome-mcp`). npm package remains `agent-chrome-mcp`.
- Browser tools default to background operation (`background` defaults to true) so navigate/fetch/screenshot/console no longer steal tab/window focus unless `background: false`.
- Navigate newly opened tabs join an existing MCP pin group when present.
- GIF recorder / auto-capture and offscreen encoder improvements.
- Bumped native bridge, Chrome extension, and shared package versions to `1.0.35`.

### Fixed

- Network capture no longer force-activates tabs when opening a target URL.

## [v1.0.34]

### Changed

- Use a separate MCP server instance per SSE and streamable HTTP session to avoid reusing one SDK server across transports.
- Keep the npx-first install path with a direct Node.js fallback for strict stdio clients.
- Expanded Streamable HTTP connection docs with config variants, connection order, and troubleshooting.
- Bumped native bridge and Chrome extension package versions to `1.0.34`.

## [v1.0.33]

### Added

- Agent-first connect prompt so users can ask their MCP agent to add the configuration and handle fallback if needed.
- npm-facing install guide for `agent-chrome-mcp`.
- Registry-safe `npx` MCP configuration using `--registry=https://registry.npmjs.org`.
- Maintained feature list in `docs/FEATURES.md`.
- Acknowledgement for the original `hangwin/mcp-chrome` project and author `hangye`.

### Changed

- Broadened product positioning from coding-agent setup to general browser work automation.
- Repositioned installation around an `npx`-first setup with a direct Node.js fallback for strict MCP clients.
- Documented why some clients may need the direct Node.js fallback when their `npx`/`npm exec` wrapper hangs long-running MCP stdio servers.
- Updated the extension popup copyable MCP config to use the registry-safe `npx` command.
- Updated release workflow generated MCP config and release install instructions.
- Replaced the old native package README that described an internal Fastify service with a user-facing npm guide.
- Bumped native bridge and Chrome extension package versions to `1.0.33`.

### Fixed

- Avoided failures when user machines default to private npm mirrors that do not contain `agent-chrome-mcp`.
- Made npm package publishing safer by ensuring the native package does not publish `workspace:*` dependencies.

## [v1.0.32]

### Added

- Published npm packages for the renamed Chrome MCP bridge:
  - `agent-chrome-mcp`
  - `agent-chrome-mcp-shared`
- Added `agent-chrome-mcp stdio` as the recommended agent entry point.
- Added simplified MCP config generation in the extension popup.

### Changed

- Renamed/repositioned the project as Chrome MCP.
- Changed the default bridge port to `12307` to avoid conflicts with older installs.
- Updated release workflow to build, test, package, and publish the native bridge and extension.

## [v0.0.5]

### Improved

- **Image Compression**: Compress base64 images when using screenshot tool
- **Interactive Elements Detection Optimization**: Enhanced interactive elements detection tool with expanded search scope, now supports finding interactive div elements

## [v0.0.4]

### Added

- **STDIO Connection Support**: Added support for connecting to the MCP server via standard input/output (stdio) method
- **Console Output Capture Tool**: New `chrome_console` tool for capturing browser console output

## [v0.0.3]

### Added

- **Inject script tool**: For injecting content scripts into web page
- **Send command to inject script tool**: For sending commands to the injected script

## [v0.0.2]

### Added

- **Conditional Semantic Engine Initialization**: Smart cache-based initialization that only loads models when cached versions are available
- **Enhanced Model Cache Management**: Comprehensive cache management system with automatic cleanup and size limits
- **Windows Platform Compatibility**: Full support for Windows Chrome Native Messaging with registry-based manifest detection
- **Cache Statistics and Manual Management**: User interface for viewing cache stats and manual cache cleanup
- **Concurrent Initialization Protection**: Prevents duplicate initialization attempts across components

### Improved

- **Startup Performance**: Dramatically reduced startup time when no model cache exists (from ~3s to ~0.5s)
- **Memory Usage**: Optimized memory consumption through on-demand model loading
- **Cache Expiration Logic**: Intelligent cache expiration (14 days) with automatic cleanup
- **Error Handling**: Enhanced error handling for model initialization failures
- **Component Coordination**: Simplified initialization flow between semantic engine and content indexer

### Fixed

- **Windows Native Host Issues**: Resolved Node.js environment conflicts with multiple NVM installations
- **Race Condition Prevention**: Eliminated concurrent initialization attempts that could cause conflicts
- **Cache Size Management**: Automatic cleanup when cache exceeds 500MB limit
- **Model Download Optimization**: Prevents unnecessary model downloads during plugin startup

### Technical Improvements

- **ModelCacheManager**: Added `isModelCached()` and `hasAnyValidCache()` methods for cache detection
- **SemanticSimilarityEngine**: Added cache checking functions and conditional initialization logic
- **Background Script**: Implemented smart initialization based on cache availability
- **VectorSearchTool**: Simplified to passive initialization model
- **ContentIndexer**: Enhanced with semantic engine readiness checks

### Documentation

- Added comprehensive conditional initialization documentation
- Updated cache management system documentation
- Created troubleshooting guides for Windows platform issues

## [v0.0.1]

### Added

- **Core Browser Tools**: Complete set of browser automation tools for web interaction
  - **Click Tool**: Intelligent element clicking with coordinate and selector support
  - **Fill Tool**: Form filling with text input and selection capabilities
  - **Screenshot Tool**: Full page and element-specific screenshot capture
  - **Navigation Tools**: URL navigation and page interaction utilities
  - **Keyboard Tool**: Keyboard input simulation and hotkey support

- **Vector Search Engine**: Advanced semantic search capabilities
  - **Content Indexing**: Automatic indexing of browser tab content
  - **Semantic Similarity**: AI-powered text similarity matching
  - **Vector Database**: Efficient storage and retrieval of embeddings
  - **Multi-language Support**: Comprehensive multilingual text processing

- **Native Host Integration**: Seamless communication with external applications
  - **Chrome Native Messaging**: Bidirectional communication channel
  - **Cross-platform Support**: Windows, macOS, and Linux compatibility
  - **Message Protocol**: Structured messaging system for tool execution

- **AI Model Integration**: State-of-the-art language models for semantic processing
  - **Transformer Models**: Support for multiple pre-trained models
  - **ONNX Runtime**: Optimized model inference with WebAssembly
  - **Model Management**: Dynamic model loading and switching
  - **Performance Optimization**: SIMD acceleration and memory pooling

- **User Interface**: Intuitive popup interface for extension management
  - **Model Selection**: Easy switching between different AI models
  - **Status Monitoring**: Real-time initialization and download progress
  - **Settings Management**: User preferences and configuration options
  - **Cache Management**: Visual cache statistics and cleanup controls

### Technical Foundation

- **Extension Architecture**: Robust Chrome extension with background scripts and content injection
- **Worker-based Processing**: Offscreen document for heavy computational tasks
- **Memory Management**: LRU caching and efficient resource utilization
- **Error Handling**: Comprehensive error reporting and recovery mechanisms
- **TypeScript Implementation**: Full type safety and modern JavaScript features

### Initial Features

- Multi-tab content analysis and search
- Real-time semantic similarity computation
- Automated web page interaction
- Cross-platform native messaging
- Extensible tool framework for future enhancements
