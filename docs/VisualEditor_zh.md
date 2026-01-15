## 让Claude Code/Codex也能使用的可视化编辑器

如何开启：`右键 > chrome mcp server > 切换网页编辑模式`
或者快捷键： `cmd/ctrl + shift + o`

### 交互式尺寸与排版调整

接在画布上拖拽元素边缘调整宽、高及字体大小。所有的视觉调整将自动转换为代码变更建议，由 Agent 应用到源码中，实现设计与代码的实时同步。

<div align="center">
  <a href="https://youtu.be/76_DsUU7aHs">
    <img src="https://img.youtube.com/vi/76_DsUU7aHs/maxresdefault.jpg" alt="Interactive Sizing & Layout Adjustment" style="width:100%; max-width:600px;">
  </a>
</div>

### 可视化属性面板

通过元素属性面板直接管理 CSS 属性。支持一键调整 Flex/Grid 布局、内外边距及样式细节。适合快速原型设计或 UI 微调，大幅减少 CSS 编写时间。

<div align="center">
  <a href="https://youtu.be/ADOzT7El2mI">
    <img src="https://img.youtube.com/vi/76_DsUU7aHs/maxresdefault.jpg" alt="Interactive Sizing & Layout Adjustment" style="width:100%; max-width:600px;">
  </a>
</div>

### 直接调试组件Vue/React组件的状态

支持实时查看和修改 React 及 Vue 组件的 props，无需离开当前视图，即可测试组件在不同状态下的渲染表现。

<div align="center">
  <a href="https://youtu.be/PaIxdpGcEEk">
    <img src="https://img.youtube.com/vi/76_DsUU7aHs/maxresdefault.jpg" alt="Interactive Sizing & Layout Adjustment" style="width:100%; max-width:600px;">
  </a>
</div>

### 点选并提示

选中任意页面元素，直接向Claude Code或者Codex发送修改指令。工具会自动提取选中组件结构与上下文信息发送给 AI，从而实现比全局对话更精准、更低延迟的代码修改。比如你可以点选某个元素然后说「把这个变大一些」，让Claude Code帮你在几秒内实现精准修改并实时生效

<div align="center">
  <a href="https://youtu.be/dSkt5HaTU_s">
    <img src="https://img.youtube.com/vi/76_DsUU7aHs/maxresdefault.jpg" alt="Interactive Sizing & Layout Adjustment" style="width:100%; max-width:600px;">
  </a>
</div>

### Claude Code Debug
如果你的 Claude Code 不是在使用 Anthropic 的官方模型（比如用的 Deepseek/Kimi/GLM/Minimax），使用 Claude Code 时很可能会遇到 400 报错。有 2 个解决方案：

1. 在环境变量中添加 ANTHROPIC_AUTH_TOKEN 和 ANTHROPIC_BASE_URL 等环境变量的值。

2. 在 `~/.claude/settings.json` 文件中配置 `env` 字段。文件示例：

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

以上 2 个方案选其一即可。配置完成后，执行 `pkill -TERM -f "mcp-chrome-bridge/dist/index.js"` 杀掉 bridge 进程，该进程会自动重启并读取你新增的环境变量。