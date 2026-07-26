# Issues 总览

**📖 文档**: [中文](ISSUE.md)

## 📊 统计信息

- **总Issue数**: 183
- **开放中**: 116
- **已关闭**: 67
- **关闭率**: 36.6%
- **最后更新**: 2025-10-11

## 📑 目录

- [功能请求](#功能请求)
- [Bug报告](#bug报告)
- [安装问题](#安装问题)
- [配置问题](#配置问题)
- [兼容性问题](#兼容性问题)
- [文档改进](#文档改进)
- [已解决的问题](#已解决的问题)

---

## 🚀 功能请求

### 开放中

#### #215 chrome_console获取的数据不完整

- **状态**: OPEN
- **作者**: africa1207
- **日期**: 2025-09-30
- **描述**: chrome_console获取的数据是浅拷贝数据，无法获取深层对象信息

#### #207 Screenshots can't autosave? I have to manually click Save?

- **状态**: OPEN
- **作者**: FVEFWFE
- **日期**: 2025-09-18
- **描述**: 希望截图能自动保存，而不需要手动点击保存

#### #205 希望支持从 clipboard 获取信息填入页面输入框

- **状态**: OPEN
- **作者**: sunzh231
- **日期**: 2025-09-17
- **描述**: 根据鼠标光标所在的输入框直接从clipboard获取信息填入，避免使用Inject Script被浏览器CSP阻止

#### #202 Electron应用程序如何使用此插件

- **状态**: OPEN
- **作者**: lyl340321
- **日期**: 2025-09-13
- **描述**: 在electron中支持了简易浏览器功能，想复用此插件提供mcp服务

#### #201 chrome-mcp无法从dialog中获取信息

- **状态**: OPEN
- **作者**: qphien
- **日期**: 2025-09-12
- **描述**: dialog中含有token敏感信息，通过js获取内容的时候，获得的值为空

#### #200 如何滚动页面

- **状态**: OPEN
- **作者**: qphien
- **日期**: 2025-09-12
- **描述**: Mac上如何instruct chrome-mcp滚动页面，通过调用快捷键space，chrome页面并没有发生滚动

#### #190 不支持离线加载本地模型吗？

- **状态**: OPEN
- **作者**: long36708
- **日期**: 2025-09-02
- **描述**: 内网环境下，无法自动下载hugeface上的模型，网络不通

#### #183 how to save the HTML displayed in the Chrome browser using Chrome MCP

- **状态**: OPEN
- **作者**: sansanai
- **日期**: 2025-08-28
- **描述**: 如何保存Chrome浏览器中显示的HTML内容，特别是当HTML内容很大时

#### #180 服务状态经常莫名其妙停止

- **状态**: OPEN
- **作者**: IAmKongHai
- **日期**: 2025-08-28
- **描述**: 希望提高稳定性，在浏览器退出前一直保持服务状态运行中

#### #178 操作MCP打开谷歌浏览器的页面之后他会自动弹窗出来

- **状态**: OPEN
- **作者**: MiloQ
- **日期**: 2025-08-27
- **描述**: 希望浏览器能在后台静默运行

#### #177 n8n integration

- **状态**: OPEN
- **作者**: judaemon
- **日期**: 2025-08-27
- **描述**: 是否可以在n8n工作流中使用

#### #175 可以以sse模式启动mcp server么

- **状态**: OPEN
- **作者**: FriSeaSky
- **日期**: 2025-08-25
- **描述**: 当前看readme只支持其他两种模式，希望能实现sse模式

#### #171 Tab group api controls

- **状态**: OPEN
- **作者**: danieliser
- **日期**: 2025-08-21
- **描述**: 允许MCP控制标签组，创建、删除、添加标签到组等

#### #169 Feature Request: Support Environment Variables to Disable Specific Tools

- **状态**: OPEN
- **作者**: lathidadia
- **日期**: 2025-08-20
- **描述**: 支持通过环境变量禁用或过滤特定工具，解决工具名称冲突问题

#### #162 Needs some rate limit logic from tools going rogue in the real browser

- **状态**: OPEN
- **作者**: neberej
- **日期**: 2025-08-16
- **描述**: 需要添加速率限制逻辑，防止工具失控

#### #157 Chrome 商店

- **状态**: OPEN
- **作者**: nelzomal
- **日期**: 2025-08-13
- **描述**: 有计划上架Chrome web store吗

#### #155 More intelligent

- **状态**: OPEN
- **作者**: nullCode666
- **日期**: 2025-08-13
- **描述**: 希望MCP能自动理解当前网页的源代码，找到对应的加密方法等

#### #153 `chrome_inject_script` not working on some sites

- **状态**: OPEN
- **作者**: rmorse
- **日期**: 2025-08-12
- **描述**: 在某些网站上chrome_inject_script不工作，需要支持不同的注入点

#### #141 功能支持鼠标悬停、多窗口mcp隔离

- **状态**: OPEN
- **作者**: lironghai
- **日期**: 2025-08-07
- **描述**: 支持鼠标悬停和多窗口MCP隔离功能

### 已关闭

#### #145 Add file upload capability for web forms

- **状态**: CLOSED
- **作者**: kaovilai
- **日期**: 2025-08-08
- **描述**: 添加文件上传功能以支持web表单

#### #107 Support .dxt format

- **状态**: CLOSED
- **作者**: metalshanked
- **日期**: 2025-07-16
- **描述**: 支持Anthropic发布的.dxt格式，实现一键安装

---

## 🐛 Bug报告

### 开放中

#### #215 chrome_console获取的数据不完整

- **状态**: OPEN
- **作者**: africa1207
- **日期**: 2025-09-30
- **描述**: chrome_console获取的数据是浅拷贝，深层对象显示为"object"

#### #212 调用工具错误

- **状态**: OPEN
- **作者**: zhaooa
- **日期**: 2025-09-28
- **描述**: 工具是打开状态，但是还是提示调用工具错误

#### #209 运行第一个例子的时候，mcp工具调用了但是画图没有动静

- **状态**: OPEN
- **作者**: scwlkq
- **日期**: 2025-09-26

#### #206 请求报错

- **状态**: OPEN
- **作者**: lghxuelang
- **日期**: 2025-09-18
- **描述**: Invalid or missing MCP session ID for SSE

#### #204 经常会打开 chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/true

- **状态**: OPEN
- **作者**: Wouldyouplace45
- **日期**: 2025-09-15
- **描述**: 浏览器显示无法访问您的文件

#### #191 chrome_console要求当前页面没有打开dev tool

- **状态**: OPEN
- **作者**: string1225
- **日期**: 2025-09-03
- **描述**: 这是chrome浏览器的机制限制

#### #184 trae显示个别工具名字超过60字符最大限制

- **状态**: OPEN
- **作者**: wangqi996
- **日期**: 2025-08-29

#### #163 chrome_screenshot always gives "exceeds maximum allowed tokens" error

- **状态**: OPEN
- **作者**: maddada
- **日期**: 2025-08-18
- **描述**: 截图响应超过最大允许的token数（25000）

#### #152 并发执行过程中发生错乱

- **状态**: OPEN
- **作者**: shatang123
- **日期**: 2025-08-12
- **描述**: 并发爬取网页时tabId错位，标签未关闭等问题

#### #149 一直提示脚本注入失败

- **状态**: OPEN
- **作者**: manzhonglu
- **日期**: 2025-08-11

#### #144 让它打开网页，打开之后，会一直等待，直到超时

- **状态**: OPEN
- **作者**: shopkeeper2020
- **日期**: 2025-08-08

#### #142 我打开了网页，让他帮我点击个东西他都不好使

- **状态**: OPEN
- **作者**: bbhxwl
- **日期**: 2025-08-07
- **描述**: 使用qweb3 4b，只是回答提问，不执行点击操作

#### #139 错误: Error calling tool: Request timed out after 30000ms

- **状态**: OPEN
- **作者**: sunhao28256
- **日期**: 2025-08-05

#### #136 `chrome_keyboard` is not working with Claude Code

- **状态**: OPEN
- **作者**: hanayashiki
- **日期**: 2025-08-03
- **描述**: 虽然显示成功，但没有输入到textarea中

#### #128 如果找不到网页元素的话，会一直重试

- **状态**: OPEN
- **作者**: GragonForce666
- **日期**: 2025-07-29

#### #122 各种各样的超时，自动停止

- **状态**: OPEN
- **作者**: fordiy
- **日期**: 2025-07-26
- **描述**: 已经把30秒超时改多10倍，还是有超时问题

#### #118 无法自动点击 cloudflare 人机验证

- **状态**: OPEN
- **作者**: windzhu0514
- **日期**: 2025-07-23

#### #114 试了豆瓣、即刻，似乎抓取不了

- **状态**: OPEN
- **作者**: imHw
- **日期**: 2025-07-20
- **描述**: AI反馈访问这些网站遇到问题，可能是反爬机制

#### #112 chrome_network_debugger的maxRequests太少了

- **状态**: OPEN
- **作者**: kanekanefy
- **日期**: 2025-07-19
- **描述**: maxRequests限制在100个请求后自动停止

#### #111 使用CherryStudio进行网站截图时报错

- **状态**: OPEN
- **作者**: GehuaZhang
- **日期**: 2025-07-18
- **描述**: Cannot read properties of undefined (reading 'map')

#### #99 chrome_get_web_content 工具获取的页面信息似乎不全

- **状态**: OPEN
- **作者**: Reviel
- **日期**: 2025-07-13
- **描述**: 获取PostGIS ticket页面时缺失Description部分内容

#### #92 AI无法关闭alert提示框

- **状态**: OPEN
- **作者**: chgblog
- **日期**: 2025-07-11
- **描述**: 遇到alert、confirm弹窗后AI无法继续操作，显示MCP超时

#### #67 windows function call 报超时错误

- **状态**: OPEN
- **作者**: zhiyu
- **日期**: 2025-07-01

### 已关闭

#### #181 The extension stays disconnected

- **状态**: CLOSED
- **作者**: Arefinw
- **日期**: 2025-08-28

#### #140 语音引擎初始化失败

- **状态**: CLOSED
- **作者**: Demi555
- **日期**: 2025-08-06

#### #116 插件点击连接，然后失焦点，隐藏，会自动断开连接

- **状态**: CLOSED
- **作者**: BeginnerDone
- **日期**: 2025-07-22

#### #73 API Error: 413: Prompt is too long

- **状态**: CLOSED
- **作者**: Lehtien
- **日期**: 2025-07-04

#### #60 Claude code Chrome MCP服务器启动时输出包含emoji的console.log语句

- **状态**: CLOSED
- **作者**: gabyic
- **日期**: 2025-06-28
- **描述**: 导致MCP协议JSON解析错误

---

## 📦 安装问题

### 开放中

#### #198 关于该插件在谷歌浏览器连接不上的问题

- **状态**: OPEN
- **作者**: nice-nicegod
- **日期**: 2025-09-09
- **描述**: 插件显示"已连接，服务未启动"。如果Node.js安装时更改了默认路径会导致此问题

#### #187 打开连接时显示 Connected, Service Not Started

- **状态**: OPEN
- **作者**: wyx66624
- **日期**: 2025-08-31
- **描述**: 已手动注册mcp-chrome-bridge，12306端口没有进程监听

#### #174 Browser in Docker + Chrome MCP: troubleshooting

- **状态**: OPEN
- **作者**: f3l1x
- **日期**: 2025-08-25
- **描述**: 在Docker虚拟浏览器中预装扩展，显示"Connected, Service Not Started"

#### #170 Claude Code integration on WSL

- **状态**: OPEN
- **作者**: TimHuey
- **日期**: 2025-08-20
- **描述**: WSL中Claude Code无法识别mcp server

#### #159 WSL Support?

- **状态**: OPEN
- **作者**: D3OXY
- **日期**: 2025-08-14

#### #148 chrome插件已经成功启动，但是命令行显示failed

- **状态**: OPEN
- **作者**: joytianya
- **日期**: 2025-08-10

#### #147 有打算支持 docker 部署吗

- **状态**: OPEN
- **作者**: tgscan-dev
- **日期**: 2025-08-10

#### #143 服务器上怎么部署这个mcp服务

- **状态**: OPEN
- **作者**: no-bystander
- **日期**: 2025-08-08

#### #138 在chrome浏览器里已经安装上插件，可以配置端口

- **状态**: OPEN
- **作者**: KylanJimmy
- **日期**: 2025-08-05
- **描述**: 是否可以绑定0.0.0.0的端口，而不只是127.0.0.1

#### #137 win上 已连接，服务未启动

- **状态**: OPEN
- **作者**: steven111920
- **日期**: 2025-08-04
- **描述**: 点击run_host.bat显示拒绝访问

#### #127 已连接，服务未启动

- **状态**: OPEN
- **作者**: Fanzaijun
- **日期**: 2025-07-29

#### #115 已连接服务未启动

- **状态**: OPEN
- **作者**: yanghao112
- **日期**: 2025-07-21
- **描述**: 能排查的都排查了，还是不行

#### #106 启动成功但是没法配置

- **状态**: OPEN
- **作者**: crxxxxxxx
- **日期**: 2025-07-15

#### #90 不能启动

- **状态**: OPEN
- **作者**: qiffang
- **日期**: 2025-07-11
- **描述**: 运行run_hosts.sh一直hang住

#### #88 Failed to install on Apple Silicon Mac

- **状态**: OPEN
- **作者**: DaniloHandsOn
- **日期**: 2025-07-10
- **描述**: agent-chrome-mcp命令未找到

#### #85 一直报错 Session termination 400

- **状态**: OPEN
- **作者**: hcoona
- **日期**: 2025-07-08

#### #78 docs/CONTRIBUTING.md instructions to build missing packages/shared build

- **状态**: OPEN
- **作者**: adrianlzt
- **日期**: 2025-07-06
- **描述**: 文档缺少shared包的构建步骤

#### #68 Execute mcp-chrome-bridge -v and report [ERR_REQUIRE_ESM]

- **状态**: OPEN
- **作者**: coisini6
- **日期**: 2025-07-02
- **描述**: Windows10下报ERR_REQUIRE_ESM错误

#### #65 mac m4 浏览器插件服务未连接

- **状态**: OPEN
- **作者**: wzp-coding
- **日期**: 2025-06-30
- **描述**: 已按troubleshooting排查，执行index.js卡住无反应

#### #62 无法启动

- **状态**: OPEN
- **作者**: Mocha-s
- **日期**: 2025-06-28
- **描述**: 直接不知道怎么启动

### 已关闭

#### #196 SOLUTION - Native Messaging not working in Chromium

- **状态**: CLOSED (已有PR #195解决)
- **作者**: gebeer
- **日期**: 2025-09-07
- **描述**: mcp-chrome-bridge npm包只安装到Chrome目录，不支持Chromium

#### #161 unexpected error: Running Status --> "Connected, Service Not Started"

- **状态**: CLOSED
- **作者**: TonnyWong1052
- **日期**: 2025-08-15

#### #154 Chrome 未能成功加载扩展程序

- **状态**: CLOSED
- **作者**: mmhzlrj
- **日期**: 2025-08-12
- **描述**: Missing 'manifest_version' key

#### #81 chromium浏览器启动失败的目录问题

- **状态**: CLOSED
- **作者**: lesszzen
- **日期**: 2025-07-07
- **描述**: Chromium在Linux下配置文件目录为.config/chromium

#### #69 是否有适配firefox浏览器计划

- **状态**: CLOSED
- **作者**: Shuai-S
- **日期**: 2025-07-02

#### #64 不支持linux部署这个项目吧

- **状态**: CLOSED
- **作者**: caiji2019-cai
- **日期**: 2025-06-30

#### #22 Mac上运行失败，Native服务没有成功启动

- **状态**: CLOSED
- **作者**: DengKaiRong
- **日期**: 2025-06-19

#### #16 开发模式启动项目，server未成功启动

- **状态**: CLOSED
- **作者**: WSCZou
- **日期**: 2025-06-18

---

## ⚙️ 配置问题

### 开放中

#### #203 INSTALL IN THE CURSOR, LOADING TOOLS,BUT NOT SUCESS

- **状态**: OPEN
- **作者**: chenhunhun
- **日期**: 2025-09-14
- **描述**: Cursor中配置后工具加载失败

#### #199 Claude code cil 连上不上怎么回事

- **状态**: OPEN
- **作者**: 666xjs
- **日期**: 2025-09-10
- **描述**: 服务端运行成功了，但就是连上不上

#### #188 windsurf中无法连接

- **状态**: OPEN
- **作者**: NoComments
- **日期**: 2025-09-02
- **描述**: Error: TransformStream is not defined

#### #185 Kiro 提示 "Enabled MCP Server chrome-mcp-extension must specify a command"

- **状态**: OPEN
- **作者**: Chris-C1108
- **日期**: 2025-08-29
- **描述**: 不清楚command是指什么，会不会是kiro不支持streamable-http类型

#### #182 Claude CLI fails to connect to running server on macOS

- **状态**: OPEN
- **作者**: dreamreels
- **日期**: 2025-08-28
- **描述**: 扩展显示运行正常，但claude命令行工具无法连接

#### #173 claude code 不支持streamableHttp

- **状态**: OPEN
- **作者**: Baddts
- **日期**: 2025-08-24
- **描述**: 配置streamableHttp后claude code不会加载这个mcp

#### #168 Failed to parse MCP servers from JSON

- **状态**: OPEN
- **作者**: joyhu
- **日期**: 2025-08-19

#### #167 claude code mcp 链接不了

- **状态**: OPEN
- **作者**: TheBloodthirster
- **日期**: 2025-08-18
- **描述**: Native connection disconnected

#### #160 在使用multilingual-e5-base时出错

- **状态**: OPEN
- **作者**: lcylcyll
- **日期**: 2025-08-15
- **描述**: 模型要求维度是768D，但在谷歌浏览器上出错

#### #150 Readme Image not found - Installation- Step 3

- **状态**: OPEN
- **作者**: amritbanerjee
- **日期**: 2025-08-12
- **描述**: Readme文件第3步的图片链接404

#### #135 callTool() 这个工具函数 在哪个库里

- **状态**: OPEN
- **作者**: hechengdu
- **日期**: 2025-08-03

#### #134 Cursor无法连接Chrome MCP

- **状态**: OPEN
- **作者**: shengcruz
- **日期**: 2025-08-02
- **描述**: 显示"No connection to browser extension"

#### #132 trae 加载失败

- **状态**: OPEN
- **作者**: mimicode
- **日期**: 2025-08-02
- **描述**: chrome_send_command_to_inject_script长度超过60个字符

#### #131 claude desktop 配置后不识别

- **状态**: OPEN
- **作者**: microxxx
- **日期**: 2025-08-01

#### #124 请看截图，说已经搞掂画图了，但Excalidraw永远都是空白

- **状态**: OPEN
- **作者**: fordiy
- **日期**: 2025-07-27

#### #123 在AI输出过程中，经常会自动停掉

- **状态**: OPEN
- **作者**: fordiy
- **日期**: 2025-07-26
- **描述**: 没法继续在原来页面excalidraw画图

#### #121 cherrystudio升级1.5.3之后，无法调用了

- **状态**: OPEN
- **作者**: csfeng1
- **日期**: 2025-07-26

#### #109 cherrystudio无法正常使用MCP

- **状态**: OPEN
- **作者**: kksqwerc
- **日期**: 2025-07-17
- **描述**: 工具已罗列出来，但在对话过程中无法准确调用

#### #103 报错 400 的一般是客户端配置方式不对

- **状态**: OPEN
- **作者**: ifastcc
- **日期**: 2025-07-15
- **描述**: 给出了Claude code、Gemini cli、Cursor的正确配置方式

#### #102 Cherry-Studio 启动失败

- **状态**: OPEN
- **作者**: Bboossccoo
- **日期**: 2025-07-14

#### #100 cursor调用excalidraw 提示Error calling tool

- **状态**: OPEN
- **作者**: DevilMay-Cry
- **日期**: 2025-07-14
- **描述**: Request timed out after 30000ms

#### #101 vscode使用：输入打开url，输入账号密码。一直卡在打开url中

- **状态**: OPEN
- **作者**: kkk123dm
- **日期**: 2025-07-14

### 已关闭

#### #221 如何在VSC中配置mcp-chrome？

- **状态**: CLOSED
- **作者**: valuex
- **日期**: 2025-10-04
- **描述**: 配置后不能启动服务器

#### #193 Cursor中添加mcp后一直显示loading tools

- **状态**: CLOSED
- **作者**: lixiaolong613
- **日期**: 2025-09-04

#### #192 部署到远程服务器之后访问连接被重置

- **状态**: CLOSED
- **作者**: wlxwlxwlx
- **日期**: 2025-09-04

#### #164 如何在claude desktop中也用上预定义的prompt template

- **状态**: CLOSED
- **作者**: WeiyangZhang
- **日期**: 2025-08-18

#### #133 issue with setting up the MCP in Claude Code

- **状态**: CLOSED
- **作者**: seldaneg
- **日期**: 2025-08-02

#### #113 Error invoking remote method 'mcp:restart-server'

- **状态**: CLOSED
- **作者**: Daiyuxin26
- **日期**: 2025-07-19

#### #102 Cherry-Studio 启动失败

- **状态**: CLOSED
- **作者**: Bboossccoo
- **日期**: 2025-07-14

#### #57 DIFY MCP调用失败

- **状态**: CLOSED
- **作者**: SpringMeta
- **日期**: 2025-06-27

#### #45 Cherry Studio 下连接 MCP报错

- **状态**: CLOSED
- **作者**: nooldey
- **日期**: 2025-06-25
- **描述**: serverType不正确，应使用小驼峰写法

#### #32 vscode 中启动失败

- **状态**: CLOSED
- **作者**: linjinxing
- **日期**: 2025-06-23

#### #30 没法使用

- **状态**: CLOSED
- **作者**: 2513483494
- **日期**: 2025-06-23
- **描述**: unexpected status code: 400

#### #19 cursor 里面配置后会出现报错

- **状态**: CLOSED
- **作者**: Sumouren1
- **日期**: 2025-06-18

#### #18 不支持cursor/cline么？

- **状态**: CLOSED
- **作者**: Rainmen-xia
- **日期**: 2025-06-18

#### #13 cherry studio addition failed

- **状态**: CLOSED
- **作者**: LLmoskk
- **日期**: 2025-06-17

#### #8 chrome_navigate调用报错

- **状态**: CLOSED
- **作者**: fcyf
- **日期**: 2025-06-16

---

## 🔌 兼容性问题

### 开放中

#### #172 iframe页面元素not found

- **状态**: OPEN
- **作者**: Actor12
- **日期**: 2025-08-22
- **描述**: 使用iframe开发的网页，chrome_fill_or_selector总是not found

#### #126 自动回复、自动发布 希望功能更强大一些

- **状态**: OPEN
- **作者**: smartchainark
- **日期**: 2025-07-29
- **描述**: 在x平台和小红书平台无法正常完成任务

#### #93 动态的数据怎样获取

- **状态**: OPEN
- **作者**: carter115
- **日期**: 2025-07-11
- **描述**: 页面上滚动鼠标才调用接口的数据

#### #43 【无数据输出】cursor+edge 测试绘制一个月的浏览记录

- **状态**: OPEN
- **作者**: 3377
- **日期**: 2025-06-24

#### #42 能否和automa一起联动制作工作流呢？

- **状态**: OPEN
- **作者**: 3377
- **日期**: 2025-06-24

#### #40 语义引擎初始化失败

- **状态**: OPEN
- **作者**: HY-Hu
- **日期**: 2025-06-24

#### #39 一直报权限问题

- **状态**: OPEN
- **作者**: mozhuangshu
- **日期**: 2025-06-24

#### #33 找不到元素

- **状态**: OPEN
- **作者**: 2513483494
- **日期**: 2025-06-23
- **描述**: 腾讯云控制台页面元素找不到

### 已关闭

---

## 📚 文档改进

### 开放中

#### #197 指令里 无法执行

- **状态**: OPEN
- **作者**: lujuny328-cmyk
- **日期**: 2025-09-08
- **描述**: 把链接桥放到指令里无法执行

#### #189 求拉群

- **状态**: OPEN
- **作者**: wwenj
- **日期**: 2025-09-02
- **描述**: 文档中的群二维码过期了

#### #117 好像没有点击扩展程序的工具？

- **状态**: OPEN
- **作者**: sunweihunu
- **日期**: 2025-07-22
- **描述**: 希望能增加点击Chrome扩展程序的工具

#### #125 二维码已过期

- **状态**: OPEN
- **作者**: NuoLanC
- **日期**: 2025-07-29

### 已关闭

#### #95 整理网页文档包含图片的效果不如 playwright

- **状态**: CLOSED
- **作者**: Xuzan9396
- **日期**: 2025-07-12

#### #94 readme 视频链接失效

- **状态**: CLOSED
- **作者**: vcan
- **日期**: 2025-07-11

#### #91 群满人了，大佬加下我

- **状态**: CLOSED
- **作者**: huangxingzhao
- **日期**: 2025-07-11

#### #89 请问这个是什么工具

- **状态**: CLOSED
- **作者**: Messilimeng
- **日期**: 2025-07-11
- **描述**: 我用cursor有没有很好的互动prompt呢

#### #84 如何配置自己的AI？

- **状态**: CLOSED
- **作者**: liaoyu-zju
- **日期**: 2025-07-08

#### #83 中文文档中的微信二维码已过期

- **状态**: CLOSED
- **作者**: YunfanGoForIt
- **日期**: 2025-07-07

#### #79 english ?

- **状态**: CLOSED
- **作者**: michabbb
- **日期**: 2025-07-06
- **描述**: README是英文的，而Chrome扩展完全是中文的

#### #75 prompt 目录下的文件如何引用

- **状态**: CLOSED
- **作者**: jovezhong
- **日期**: 2025-07-05

#### #52 README 中多媒体资源 404 问题

- **状态**: CLOSED
- **作者**: yunkst
- **日期**: 2025-06-26

#### #49 视频里面在浏览器右侧这个大模型聊天工具是什么啊？

- **状态**: CLOSED
- **作者**: MoeMoeFish
- **日期**: 2025-06-25

#### #48 建议楼主创建一个微信群

- **状态**: CLOSED
- **作者**: goreycn
- **日期**: 2025-06-25

#### #44 没有看到查看MCP配置的连接按扭

- **状态**: CLOSED
- **作者**: jimleee
- **日期**: 2025-06-25

#### #35 画图功能没有调动起来

- **状态**: CLOSED
- **作者**: guangzhou
- **日期**: 2025-06-23

#### #34 怎么才能在画板上画图呢

- **状态**: CLOSED
- **作者**: guangzhou
- **日期**: 2025-06-23

#### #31 可增加对Consle日志的读取吗

- **状态**: CLOSED
- **作者**: ZoidbergPi
- **日期**: 2025-06-23

#### #26 使用教程

- **状态**: CLOSED
- **作者**: fanhaoj
- **日期**: 2025-06-22

#### #23 怎么打开对话框？

- **状态**: CLOSED
- **作者**: kokwiw
- **日期**: 2025-06-20

#### #17 对比2个京东商品就超token了

- **状态**: CLOSED
- **作者**: namejee
- **日期**: 2025-06-18

#### #15 Claude Desktop

- **状态**: CLOSED
- **作者**: GoldRush520
- **日期**: 2025-06-18
- **描述**: Claude Desktop国内用不了，有没有其他可替代的

#### #11 大佬有没有可能添加一个drag and drop功能

- **状态**: CLOSED
- **作者**: tom63001
- **日期**: 2025-06-17

---

## ✅ 已解决的问题

### 社区交流相关

#### #213 求个微信群组，互相交流

- **状态**: OPEN
- **作者**: zhangchao0323
- **日期**: 2025-09-29

#### #211 求拉群，想参与项目贡献～

- **状态**: OPEN
- **作者**: suoaiyisheng
- **日期**: 2025-09-27

### 使用问题

#### #176 claude code 无法画图

- **状态**: OPEN
- **作者**: woshihoujinxin
- **日期**: 2025-08-26
- **描述**: 打开excalidraw.com画图，但没有流畅效果

#### #166 画图问题

- **状态**: OPEN
- **作者**: fyture
- **日期**: 2025-08-18
- **描述**: 模型说已完成，但excalidraw上什么都没有

### Python集成

#### #194 如何在代码上接入呢，不用AI agent

- **状态**: CLOSED
- **作者**: dreambe
- **日期**: 2025-09-05
- **描述**: 比如python，有没有demo代码

#### #82 尝试使用python代码直接调用工具失败

- **状态**: CLOSED
- **作者**: YunfanGoForIt
- **日期**: 2025-07-07

#### #24 可以使用python代码调用这个插件吗？

- **状态**: CLOSED
- **作者**: liulint
- **日期**: 2025-06-20

#### #21 请问目前不带有MCP功能的的LLM可以接入这个mcp服务器吗

- **状态**: CLOSED
- **作者**: JessiePen
- **日期**: 2025-06-19

### 服务器部署

#### #74 Suggestion: Enable External Access to Local Server

- **状态**: OPEN
- **作者**: ErrorGz
- **日期**: 2025-07-05
- **描述**: 建议修改HOST为0.0.0.0以允许外部访问

#### #72 Tab串联问题

- **状态**: CLOSED
- **作者**: fundoop
- **日期**: 2025-07-04
- **描述**: 是否可以增加指定tab页面操作，切换tab等

#### #71 这个mcp服务器不能和客户端分开吗

- **状态**: CLOSED
- **作者**: xiaodiao216
- **日期**: 2025-07-03

#### #70 【Help Wanted】项目首页视频里的MCP客户端是什么？

- **状态**: CLOSED
- **作者**: tonyxu721
- **日期**: 2025-07-03

### 其他

#### #97 请问使用示例中出现的对话工具是什么

- **状态**: CLOSED
- **作者**: sbwg
- **日期**: 2025-07-12

#### #96 入口在哪里啊？

- **状态**: CLOSED
- **作者**: DavidCalls
- **日期**: 2025-07-12

#### #80 alternative way question

- **状态**: CLOSED
- **作者**: yiminhale
- **日期**: 2025-07-06
- **描述**: 能否用npm而不是pnpm

#### #51 navigate功能不能标签打开地址

- **状态**: CLOSED
- **作者**: adoin
- **日期**: 2025-06-26

#### #25 [Feature Request] - Can I use it with my Cursor?

- **状态**: CLOSED
- **作者**: DaleXiao
- **日期**: 2025-06-21

#### #14 How to support VSCode or trae?

- **状态**: CLOSED
- **作者**: loki-zhou
- **日期**: 2025-06-17

#### #5 佬，augment里咋设置mcp？

- **状态**: CLOSED
- **作者**: gally16
- **日期**: 2025-06-15

---

## 📈 Issue 趋势分析

### 高频问题类型

1. **安装配置问题** (约40%): 主要集中在Native Messaging连接失败、服务未启动
2. **兼容性问题** (约25%): 不同客户端（Cursor、Claude Code、Cherry Studio等）的集成问题
3. **功能请求** (约20%): 文件上传、鼠标悬停、多窗口隔离等
4. **Bug报告** (约15%): 工具调用错误、超时、元素查找失败等

### 常见解决方案

1. **权限问题**: 使用`chmod -R 755`赋予dist目录权限
2. **Node.js路径问题**: 重新安装Node.js到默认路径
3. **配置格式问题**: 不同客户端使用不同的配置格式（streamableHttp vs streamable-http）
4. **端口访问**: 默认127.0.0.1，需要外部访问时改为0.0.0.0

---

## 🔗 相关资源

- [故障排除文档](TROUBLESHOOTING_zh.md)
- [贡献指南](CONTRIBUTING_zh.md)
- [工具文档](TOOLS_zh.md)
- [Windows安装指南](WINDOWS_INSTALL_zh.md)

---

**最后更新**: 2025-10-11  
**统计数据来源**: GitHub Issues API
