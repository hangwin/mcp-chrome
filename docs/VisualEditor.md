# A Visual Editor for Claude Code & Codex

**How to enable:**
`Right Click > Chrome MCP Server > Toggle Web Editing Mode`
**Shortcut:** `Cmd/Ctrl` + `Shift` + `O`

### Interactive Sizing & Layout Adjustment

Directly drag element edges on the canvas to adjust width, height, and font sizes. All visual manipulations are automatically converted into code suggestions and applied to your source code by the Agent, bridging the gap between design and development in real-time.

<div align="center">
  <a href="https://youtu.be/76_DsUU7aHs">
    <img src="https://img.youtube.com/vi/76_DsUU7aHs/maxresdefault.jpg" alt="Interactive Sizing & Layout Adjustment" style="width:100%; max-width:600px;">
  </a>
</div>

### Visual Property Controls

Manage CSS properties directly through a visual inspector panel. Effortlessly tweak Flex/Grid layouts, margins, padding, and styling details with a single click. Perfect for rapid prototyping or UI fine-tuning, significantly reducing the time spent writing raw CSS.

<div align="center">
  <a href="https://youtu.be/ADOzT7El2mI">
    <img src="https://img.youtube.com/vi/76_DsUU7aHs/maxresdefault.jpg" alt="Interactive Sizing & Layout Adjustment" style="width:100%; max-width:600px;">
  </a>
</div>

### Live Component State Debugging (Vue/React)

Inspect and modify React and Vue component props in real-time. Test how your components render under different data states without ever leaving your current view or writing temporary console logs.

<div align="center">
  <a href="https://youtu.be/PaIxdpGcEEk">
    <img src="https://img.youtube.com/vi/76_DsUU7aHs/maxresdefault.jpg" alt="Interactive Sizing & Layout Adjustment" style="width:100%; max-width:600px;">
  </a>
</div>

### Point, Click & Prompt

Select any element on the page and send instructions directly to Claude Code or Codex. The tool automatically captures the component's structure and context, enabling the AI to provide modifications with far greater precision and lower latency than global chat contexts.

Simply click an element and say, _"Make this bigger"_ or _"Change the background to red"_, and watch Claude Code implement the exact changes in seconds.

<div align="center">
  <a href="https://youtu.be/dSkt5HaTU_s">
    <img src="https://img.youtube.com/vi/76_DsUU7aHs/maxresdefault.jpg" alt="Interactive Sizing & Layout Adjustment" style="width:100%; max-width:600px;">
  </a>
</div>

### Claude Code Debug
If your Claude Code is not using Anthropic’s official models (for example Deepseek/Kimi/GLM/Minimax), you may encounter 400 errors. There are two solutions:

1. Add environment variables such as ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL.

2. Configure the `env` field in `~/.claude/settings.json`. Example:

```settings.json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-***",
    "ANTHROPIC_BASE_URL": "https://***/anthropic",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "***",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "***",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "***",
    "ANTHROPIC_MODEL": "***"
  }
}
```

Either option is fine. After configuring, run `pkill -TERM -f "mcp-chrome-bridge/dist/index.js"` to kill the bridge process; it will automatically restart and load the new environment variables.
