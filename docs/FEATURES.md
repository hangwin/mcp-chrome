# Features

**📖 Documentation**: [English](FEATURES.md) | [中文](FEATURES_zh.md)

This file is the source of truth for the current Chrome MCP feature list. Update it whenever a release adds, removes, or materially changes a user-facing capability.

Chrome MCP is for browser-based work automation, not only coding. Target scenarios include research, data entry, operations dashboards, QA checks, content workflows, shopping/travel workflows, and coding-adjacent browser tasks.

## Setup And Distribution

- **Agent-first connect prompt**: users can ask any MCP-compatible agent to add the MCP config and handle fallback if needed.
- **npx-first setup**: recommended configs use `npx` with `--registry=https://registry.npmjs.org` for the easiest install path.
- **Direct Node.js fallback**: strict MCP clients that hang through `npx` can launch the installed stdio server file directly with Node.js.
- **Registry-safe npm config**: recommended configs include `--registry=https://registry.npmjs.org` to avoid private npm mirror issues.
- **Chrome extension release zip**: users load the unpacked extension from the release artifact.
- **Copyable config in extension popup**: the extension shows the recommended MCP server configuration.

## Browser Control

- List Chrome windows and tabs.
- **MCP pin group** (Claude-style): labeled **"Chrome MCP"** tab group via `chrome_tabs_context`, `chrome_tabs_create`, and `chrome_tabs_adopt`.
- Navigate pages and control active tabs.
- **Background-first focus**: tools default to not activating tabs or focusing the Chrome window; pass `background: false` to foreground.
- Click, type, scroll, and send keyboard commands.
- Inject scripts and communicate with injected helpers.
- Capture screenshots, including page and element-focused screenshots.
- Manage bookmarks and browsing history.

## Work Automation Scenarios

- Research and information gathering across multiple websites.
- Form filling, data entry, and repetitive admin tasks.
- Operations dashboards and internal tools that require an existing login session.
- QA checks, visual inspection, and browser-state verification.
- Content workflows such as collecting references, posting drafts, or updating web apps.
- Shopping, travel, and other consumer workflows that benefit from existing cookies and sessions.
- Coding-adjacent browser tasks such as testing local apps, inspecting pages, and collecting screenshots.

## Browser Context

- Use the user's existing Chrome browser instead of launching a separate automation browser.
- Reuse existing login sessions, cookies, tabs, extensions, and browser settings.
- Work across multiple tabs and windows.
- Keep automation local to the user's machine.

## MCP Integration

- Stdio MCP bridge for agent clients.
- Streamable HTTP endpoint for advanced clients.
- Works with MCP-capable agents and clients for coding, research, operations, content, QA, and other browser-based workflows.
- Exposes browser tools through MCP schemas shared between the extension and native bridge.

## Search And Analysis

- Semantic search over browser content.
- Local vector indexing and similarity matching.
- Smart content extraction for page analysis.
- Local model and cache management in the extension UI.

## Release And Maintenance Tooling

- npm packages:
  - `agent-chrome-mcp`
  - `agent-chrome-mcp-shared`
- Release workflow builds and tests the shared package, native bridge, and Chrome extension.
- Release workflow publishes npm packages and uploads the extension zip plus MCP config.
- Diagnostics commands for installation and connection troubleshooting:
  - `agent-chrome-mcp doctor`
  - `agent-chrome-mcp doctor --fix`

## Maintenance Rule

For every release:

1. Update this file for the current feature surface.
2. Update `docs/CHANGELOG.md` and `docs/CHANGELOG_zh.md` with versioned changes.
3. Keep README highlights short and link back to this file.
