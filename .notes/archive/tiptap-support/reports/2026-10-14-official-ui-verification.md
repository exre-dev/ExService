# 官方 Tiptap UI 迁移验收

日期：2026-10-14。范围：共享工具栏与官方 UI 适配。依据：`.notes/tiptap-support/specs/2026-10-14-official-ui-design.md`。

## 结果

| 检查                                                  | 结果                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec vitest run packages/components/src/tiptap` | 11 个文件、196 项通过；最终包含跨段操作、StrictMode、链接/颜色与旧文件选择器回归                                     |
| `pnpm typecheck`                                      | 全仓通过                                                                                                             |
| `pnpm test`                                           | 完整流程通过，包括 Website、runtime/Docs 脚本和清单中的 Outline 前后端及隔离数据库身份测试                           |
| `pnpm build`                                          | Website、SDK、Server 与 Outline 构建通过                                                                             |
| `pnpm --filter @workspace/components typecheck`       | 最终候选通过                                                                                                         |
| `pnpm --filter @workspace/web build`                  | 最终候选通过                                                                                                         |
| 独立源码复核                                          | 修复跨段选区缩为首段问题后，第二位 reviewer 对最终候选未发现已证实的 P2 及以上问题；复核没有独立重跑自动或浏览器测试 |

API 生成文件曾因工作区字节状态未通过检查，使用官方生成命令更新后核对 Git blob 与 HEAD 完全一致，没有 HTTP Contract 或生成类型内容变更。测试和构建仍有既有 Contract `oneOf`、Vite 配置加载与 chunk 大小等非失败警告。

## 真实浏览器

在独立 Vite DEV 服务的 `/dev/tiptap` 上执行 `tests/browser/tiptap-toolbar.mjs` 的编辑、主题和布局断言。CLI 会在原生文件选择器处暂停，因此本地图片使用独立的真实 chooser/upload 操作完成并读回 JSON，再继续其余断言。

- 初次 StrictMode 加载时官方按钮可用；旧自研工具入口消失。
- 官方 marks、文字颜色和高亮正常作用于选区；持久颜色是十六进制值，Markdown 不包含主题 CSS 变量。
- 高亮色块具有实际尺寸与可见颜色；ExUI 浅色面板背景为 `rgb(255, 255, 255)`，深色为 `rgb(29, 29, 29)`，主题切换不改写已有文档颜色。
- 键盘链接、危险 URL 的字段校验、方向键/End/Tab、只读切换通过。
- 960、600、375px 下按钮不越出工具栏；工具栏仍透明，无自己的背景或阴影。200% 根字号下验证了工具栏自身布局；全站导航的文字缩放布局不属于此检查。
- 真实选择 PNG 后，JSON 出现合法 image Data URL 及文件名，既有上传生命周期正常接入。
- `tests/browser/tiptap-preview.mjs` 的基础预览与 Chrome 交互回归通过，包括显式导出、失败导入原子性、替换/撤销、CDP 中文组合输入、Mention 身份、组合输入抑制、失焦取消与官方原生段落拖动。

截图位于忽略的 `output/tiptap-official/`。浏览器未出现编辑器 pageerror。独立 DEV 服务未启动 Website API Server，其既有 health probe 报告 502；这次浏览器验收覆盖内存预览，未将其作为业务 API 或部署证明。

## 交付边界

保留当前工作树与分支，未提交、推送或部署。既有 About 内容等无关修改保留。官方源码、许可、revision 和宿主适配说明位于 `packages/components/src/tiptap/official/README.md`。

## 官方图标豁免补验

用户后续明确豁免工具栏的 Lucide 规则，要求使用官方图标。已还原 33 个锁定 revision 的官方 React SVG 文件；逐文件 SHA256 比较与上游完全一致。文字颜色面板也使用该 revision 的官方 highlighter/ban 图标。

本次纯图标调整后，组件类型检查、3 个相关测试文件的 28 项测试以及 Web 构建通过。浏览器确认工具栏 21 个 SVG 均可见，工具栏及文字颜色面板没有 Lucide SVG，浅色、深色和 375px 布局正常。截图为 `output/tiptap-official/official-icons-light.png`、`output/tiptap-official/official-icons-dark.png` 和 `output/tiptap-official/official-icons-mobile.png`。全仓测试结果采用此前完整迁移的执行记录，本次未重复运行整套 Outline 测试。

## 列表、焦点与 Mention 修正补验

用户要求列表菜单左对齐、移除内容区焦点描边、改用指定的文字颜色图标，并修复 Mention 选中态及去除关闭按钮。已复现旧版菜单居中、内容区 inset 焦点阴影和 Mention 黑底近黑文字问题。

最终浏览器在 light/dark 下确认三个列表项均为 `flex-start`，内容区 outline 与 box-shadow 均为 `none`。文字颜色使用公开 registry 的 `TextColorSmallIcon`，该单独图标 metadata 的 plans 为 `light` 和 `open-source`，来源见官方目录 README。Mention 选中项文字对比度分别为 15.77:1 和 12.10:1，没有关闭按钮；方向键换候选与 Escape 取消继续正常。截图位于 `output/tiptap-official/list-light.png`、`output/tiptap-official/list-dark.png`、`output/tiptap-official/mention-light.png` 和 `output/tiptap-official/mention-dark.png`。

组件类型检查、196 项 Tiptap 专项测试及 Web 构建通过。为排除旧 HMR 模块缓存，重启本任务的独立 Vite 服务并禁用验收浏览器缓存后核对实际 DOM；未改动依赖锁文件或持久数据。

## Link 原始样式与合并色板补验

Link 恢复锁定上游的单行输入框、应用/打开/移除三个图标按钮和原始 Card 样式。浏览器确认浅深主题、375px 布局、危险 URL 保留错误输入、Enter 应用站内 `/same` 到原选区均通过。

按用户参考图移除独立文字颜色按钮，在官方高亮入口加入 Text Color 和 Highlight Color 两组五列色板，分别包含默认项和九种颜色。真实 Editor 测试确认两种 mark 可以同时存在，分别清除不会影响另一种，关闭后新选区不会复用旧目标。浏览器发现宿主命令聚焦编辑器会导致弹层关闭，修复后验证连续设置、网格方向键/Enter/Escape、浅深主题和 375px 均通过；两组各十个按钮，弹层宽 260px。最后按用户要求把弹层标题和 A 图标缩至 14px。

该轮组件类型检查、197 项 Tiptap 测试和 Web 构建通过；更新后的工具栏浏览器断言涵盖双 mark 的实际十六进制值、主题切换不改写文档、安全链接、只读、工具栏键盘、移动布局与 200% 字号。文件上传采用此前迁移的验证证据，本次样式与色板修改未重新执行原生 chooser。截图在 `output/tiptap-official/`。

随后按用户反馈把弹层 A 图标缩至 10px，并收紧间距：列间距 12px、行间距 8px、标题下方 8px、两组间距 16px，面板宽度从 260px 缩至 224px。浏览器读回浅深主题和 375px 下的实际尺寸，连续应用颜色与网格键盘操作仍通过；Web 构建通过。这次纯样式调整未重复运行单元测试。

最终按后续反馈放大圆圈内部的 A（官方 SVG 视口 18px），并把圆形按钮从 30px 缩至 24px，面板收窄至 194px。标题和紧凑间距延续上述设置。浅深主题、375px 实际尺寸与键盘/连续设置行为检查和 Web 构建通过。

## 中英文代码字体

用户确认使用 Maple Mono CN，并追加行内代码也需要切换。已从官方 v7.9 的 `MapleMono-CN-unhinted.zip` 引入 Regular，保留 OFL 许可，生成 57 个 WOFF2 Unicode 切片和校验清单；生成器逐片验证完整的 22,731 个字符覆盖与原始 advance widths，合计资源 6,450,412 字节，浏览器按实际使用字符加载。

真实 Chromium 的平台字体查询确认：CodeBlock 的 76 个字符以及行内代码的 11 个字符全部使用自托管 `Maple Mono CN`，无微软雅黑或 Consolas 字形回退。字号延续原有规则（示例 CodeBlock 为 14.4px），中英 advance 为 17.28px/8.64px，比例 2:1。浅深主题、只读、375px、文档 JSON 不被字体或主题切换改写、7 个实际字体切片请求 200 均通过，没有 pageerror。组件类型检查和 Web 构建通过；未为纯字体显示改动重复运行全仓测试。截图为 `output/tiptap-official/maple-code-light.png` 和 `output/tiptap-official/maple-code-dark.png`。

## 图片外观

已复现节点选中 outline、四个 10px 缩放标记和 0px 图片圆角。按用户要求取消图片选中描边，将四角缩放标记改为透明，图片使用 ExUI 圆角（当前 10px）；官方命中区域与缩放生命周期仍保留。

更新 `tests/browser/tiptap-preview.mjs` 的真实图片缩放验收：选择图片后无 outline、四角无背景/边框且透明、图片有圆角；浅深主题下实际鼠标缩放从 320×200 到 368×230，再到 416×260，保存比例正确。显式宽高、只设宽、只设高和内在尺寸显示检查通过，Web 构建通过。本轮纯 CSS 修改未重复运行全仓测试。截图为 `output/tiptap-official/image-rounded-light.png`、`output/tiptap-official/image-rounded-dark.png` 和 `output/tiptap-official/image-rounded-mobile.png`。

## Info 主题蓝

Info 在节点作用域内将既有 feedback-info 覆盖为已安装 ExUI 默认 primary 蓝 `#0088ff`。真实浏览器确认浅深主题的侧边框与图标均为 `rgb(0, 136, 255)`，其他提示类型继续使用原语义色，文档 JSON 未改变。Web 构建通过；截图为 `output/tiptap-official/info-blue-light.png` 和 `output/tiptap-official/info-blue-dark.png`。
