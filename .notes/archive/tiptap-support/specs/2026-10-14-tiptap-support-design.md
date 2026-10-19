# Tiptap 共享编辑器与预览页设计

日期：2026-10-14。模块：`tiptap-support`。状态：架构、功能范围与 Markdown 方向已获用户确认，完整书面设计待审阅。

## 决策摘要

在 `packages/components/` 引入可复用的 Tiptap 编辑器、只读查看器和 ExUI 工具栏，为后续业务使用做准备。优先采用官方节点和扩展，仅为缺少官方对应能力的 Admonition 补充自定义节点，并为特殊内容补齐 Markdown 转换规则。

内部文档以 Tiptap JSON 为完整表示，同时支持 Markdown 导入和导出。普通内容采用常规 Markdown 与 GFM 语法；Admonition 使用容器语法，折叠块、Mention 和不能用普通 Markdown 表达的样式使用受控 HTML。

在 `apps/web/` 增加仅开发环境开放的临时 React 页面 `/dev/tiptap`，展示全部节点、编辑交互、同步只读预览、主题及转换结果。图片上传和 Mention 数据源由回调注入，预览页只提供本地演示。

模块根目录固定为 `.notes/tiptap-support/`。本设计获书面批准后，RFC 写入 `.notes/tiptap-support/rfcs/`；本次 brainstorming 到 RFC 交接结束，不直接开始实现。

## 背景与证据

- `packages/components/` 当前以源码导出共享 React 组件，使用 CSS Modules、ExUI 和 `lucide-react`，尚无 Tiptap 编辑器。
- `apps/web/src/App.tsx` 集中登记 Website 路由；`apps/web/src/main.tsx` 提供唯一 ExUI ThemeProvider、全局样式和临时通知宿主。
- `packages/components/package.json`、`apps/web/package.json` 与 `pnpm-lock.yaml` 已采用 registry 发布的 ExUI 0.8.0；设计调研时 registry 的最新 ExUI 也是 0.8.0，Tiptap React 最新版本为 3.32.0。
- 参考工程 ex-hub 的 `src/Hub/TipTap/index.tsx`、`dark.scss` 和 `light.scss` 提供节点范围与视觉方向。其子目录提供旧编辑器、查看器、自定义节点和 Markdown 实现，仅作为参考材料。
- 旧配置重复登记 ListItem 和 TextStyle 相关能力；旧查看器重建 DOM 时未完整传递属性，不能直接用作新查看器。
- 旧 Admonition 的解除命令尚未实现，旧 Blankspace 全局拦截 Tab；这两种行为不能随迁移保留。
- 官方 Image 已提供可配置缩放；官方 Markdown 提供自定义解析和序列化接口，并仍标记为 Beta。

项目边界遵循 `AGENTS.md`、`.ai/architectures/overview.md`、`.ai/knowledge/web/exui-integration-traps.md` 与 `.ai/architectures/runtime/runtime-boundaries.md`。

## 已确认范围

| 能力     | 第一阶段要求                                                 |
| -------- | ------------------------------------------------------------ |
| 共享组件 | 编辑器、只读查看器、工具栏、统一扩展配置及转换入口。         |
| 内容格式 | Tiptap JSON 和 Markdown 的显式导入、导出。                   |
| 节点     | 完整覆盖下方节点清单。                                       |
| 编辑交互 | 常规格式、撤销重做、块拖动、图片缩放、列表缩进与折叠块操作。 |
| 外部能力 | 图片上传回调、Mention 候选回调；共享组件不访问 API。         |
| 临时页面 | `/dev/tiptap`，集中展示样式与交互，支持恢复示例。            |
| 主题     | 当前 ExUI 浅色、深色及系统主题；编辑与阅读共用内容排版。     |

本阶段不接入具体业务页面、真实上传服务或账号搜索服务，不新增 HTTP Contract、数据库或迁移。不新增协同编辑、评论、版本历史、表格、视频、数学公式或第二套精简 Post 编辑器。不迁移参考工程的历史文档，也不承诺旧自定义 JSON 的兼容。预览内容不自动保存到服务器、localStorage 或 IndexedDB。

## 架构与责任

共享能力集中在 `packages/components/src/tiptap/`，按编辑器、查看器、工具栏、扩展、转换和内容样式拆分职责。通过 `@workspace/components` 的公开入口供应用使用；具体公开符号和文件切分由 RFC 明确。

| 单元     | 责任                                                           | 依赖和限制                                                                      |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 扩展配置 | 为编辑、阅读、JSON 校验和 Markdown 转换提供同一套文档 schema。 | 优先官方扩展；每个名称只注册一次；按实例建立配置，避免可变 storage 跨实例共享。 |
| 编辑器   | 管理编辑实例、文档变化、选区和交互；向调用方报告 JSON。        | 不执行业务提交，不登记路由，不调用 API。                                        |
| 工具栏   | 显示可用命令、激活状态及必要的输入操作。                       | 使用 ExUI 公共组件及 Lucide 图标，保留编辑器选区。                              |
| 查看器   | 呈现同 schema 的内容；允许折叠块展开与收起。                   | 无工具栏、拖柄、缩放手柄及内容编辑；任务复选框不改变文档。                      |
| 转换入口 | 显式识别输入格式，校验并转换；导出 Markdown 和诊断结果。       | 以官方 Markdown 为基础，仅补齐缺失规则；不直接执行输入 HTML。                   |
| 预览页   | 提供示例、演示回调、编辑与只读对照及导入导出操作。             | 路由只属于 Web；不写持久业务数据。                                              |

查看器使用官方内容渲染能力或只读 EditorContent，不沿用参考实现的属性丢失式 DOM 重建。RFC 依据已锁定版本确定具体实现，必须同时保留 Mention 属性、图片尺寸、Admonition 类型和 Details 交互。

Tiptap 依赖放在所属共享包中，官方包使用同一发布版本并锁入 pnpm lockfile。ExUI 沿用当前发布包，不恢复本地 link，不改动 Outline 依赖树。共享组件不导入 ExUI 全局样式，也不引入 Ant Design、另一份 Sonner 或另装 ExUI 已包含的底层 UI 库。

## 节点、Marks 和编辑能力

| 类别       | 要求与来源                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| 基础文档   | 官方 Document、Paragraph、Text、HardBreak。                                                                |
| 标题       | 官方 Heading，工具栏和文档只支持 H1–H4。                                                                   |
| 引用       | 官方 Blockquote。                                                                                          |
| 列表       | 官方 BulletList、OrderedList、ListItem、TaskList、TaskItem；共同 ListItem 不重复注册。                     |
| 代码       | 官方 Code 与 CodeBlock，保留代码语言属性；本阶段不增加语法高亮引擎。                                       |
| 折叠块     | 官方 Details、DetailsSummary、DetailsContent；保存文档中的打开状态，阅读时可交互。                         |
| 图片       | 官方 Image，采用官方缩放能力，保存尺寸、替代文本及标题。                                                   |
| Mention    | 官方 Mention，保存稳定 ID 和显示名称，通过回调获取候选。                                                   |
| 分隔线     | 官方 HorizontalRule，替代旧 Divider；不保留第二种分隔线节点。                                              |
| Admonition | 自定义 Admonition 与标题子节点；类型为 tip、info、warning、error，支持插入、切换类型和解除包装，保留正文。 |
| 基础 Marks | 官方 Bold、Italic、Underline、Strike、Link、Highlight。                                                    |
| 文本样式   | 官方 TextStyle 相关扩展提供文字颜色、背景色和字号；采用 Kit 时不重复注册所含扩展。                         |
| 对齐       | 官方 TextAlign，作用于标题和段落。                                                                         |
| 编辑辅助   | 官方 UndoRedo、Dropcursor、Gapcursor、TrailingNode 与 React DragHandle。                                   |

可用官方 StarterKit 组合基础能力，须按本设计启停与配置；不能同时再注册 Kit 已包含的节点、Marks 或辅助扩展。

旧 Blankspace 不作为新节点或全局键盘扩展迁移。列表和代码上下文优先使用官方缩进能力；普通正文中 Tab 和 Shift+Tab 保留焦点导航，不全局插入制表符。显式列表缩进操作由工具栏提供。

## 组件内容与异步接口

初始化与显式导入必须标注 `json` 或 `markdown`，不能根据字符串内容猜格式。初始化内容只初始化编辑实例；外部整篇替换通过明确操作执行，不因普通 React 重渲染或每次 onChange 回传而重新创建编辑器。

编辑器的文档变化通知以 JSON 为主。调用方可读取当前 JSON、显式导出 Markdown、显式替换内容，并获得失败诊断。JSON 类型复用 Tiptap 公开类型，业务方不复制另一份节点 DTO。RFC 定义具体 Props、Ref 和转换结果类型。

读取和校验新输入后才替换当前文档。非法 JSON、未知节点、无效属性、无法表示的 Markdown 内容或危险 HTML 不得先清空当前文档；导入失败保留内容及选区。可接受的规范化需返回说明，不能静默丢失节点或正文。

上传回调接收文件与取消上下文，返回可插入的图片地址及可选图片信息；候选回调接收 Mention 查询与取消上下文，返回 ID 和显示名称。回调未配置时不伪造业务服务；无上传回调则隐藏本地上传入口，仍支持合规图片 URL 插入。无 Mention 回调则不显示动态候选，仍能阅读已有 Mention。

上传操作记录目标插入位置；迟到结果不得插入到另一篇文档或已销毁实例。文档替换、卸载和取消使旧操作失效。候选查询保留最新查询结果，旧请求不得覆盖新结果；无候选、加载及失败状态均可辨识。

组件提供可读的固定错误信息与重试机会，不回显原始异常或堆栈。字段输入使用项目规定的 React Hook Form、Zod 与 ExUI 字段组件；临时通知使用既有 ExMessage 宿主，不新增通知容器。规则见 `.ai/rules/frontend-forms.md` 和 `.ai/rules/frontend-notifications.md`。

## Markdown 转换规则

采用官方 `@tiptap/markdown`，不复制参考工程的解析器和序列化器。普通 Markdown 不是完整文档的唯一真值；JSON 保存完整受支持的内容，Markdown 用于交换和人工编辑。支持本项目导出的 Markdown 再导入后恢复语义等价文档，不要求字节、属性顺序或外部平台渲染完全一致。

| 内容                                   | 输出规则                                                                                          | 重新导入要求                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 段落、H1–H4、引用、列表                | 常规 Markdown。                                                                                   | 恢复文本与结构，有序列表保留起始序号。                 |
| 粗体、斜体、链接、行内代码             | 常规 Markdown。                                                                                   | 恢复 Marks 与安全链接地址。                            |
| 删除线、任务列表                       | GFM 对应语法。                                                                                    | 恢复删除线和勾选状态。                                 |
| 代码块                                 | 围栏代码块及语言标记。                                                                            | 保留代码文本、换行和语言，不解释代码中的 HTML。        |
| HardBreak、HorizontalRule              | 显式 Markdown 换行和分隔线。                                                                      | 保持与段落边界的区别。                                 |
| Admonition                             | `::: tip`、`::: info`、`::: warning`、`::: error` 容器，类型后接标题的内联 Markdown，随后为正文。 | 保留类型、可编辑标题及其 Marks 和内部块。              |
| 折叠块                                 | 受控 `<details>`、`<summary>` 及正文。                                                            | 恢复摘要、正文和打开状态。                             |
| Mention                                | 受控 Mention HTML。                                                                               | 保留稳定 ID 和显示名称，不只转成丢失 ID 的普通 @文本。 |
| 下划线、高亮、颜色、背景色、字号、对齐 | 仅包含允许标签、属性和 CSS 属性的受控 HTML。                                                      | 恢复本阶段支持的样式；不把任意 CSS 带入页面。          |
| 普通图片                               | Markdown 图片语法。                                                                               | 保留安全地址、替代文本及标题。                         |
| 带尺寸的图片                           | 受控图片 HTML。                                                                                   | 保留尺寸及图片基本信息，不导出临时缩放 DOM。           |

Admonition 开始行由至少三个冒号、空格、类型及可选标题构成；结束行使用与开始行数量相同的冒号。没有标题文本表示空标题，不能在重新导入时补默认标题；默认标题只在工具栏新建容器时填写。标题使用内联 Markdown，标题内的硬换行使用受控 `<br>`。

Admonition 内允许本阶段支持的正文节点，包括嵌套列表、代码和折叠块。序列化嵌套容器时，外层围栏比任何内层容器围栏至少多一个冒号；正文中需作为普通文本保留的容器边界行转义其首个冒号。转换必须识别代码围栏，代码内的 `:::` 保持原文，不作为容器边界。RFC 将这些规则落实为确定的 tokenizer、序列化契约及组合测试。

只支持本项目 schema 所能表示的输入。表格、H5/H6 等超出范围的结构返回明确诊断，不悄悄删除或降级后覆盖原文。受控 HTML 的规范化与拒绝规则在 JSON、Markdown 和粘贴入口一致适用。

输入 HTML 不以原始字符串交给浏览器执行。白名单限制标签、属性、节点类型、URL 协议和 CSS 属性；事件属性、执行性协议及其他未知或危险内容使整次显式导入失败。链接默认接受 HTTP、HTTPS、站内相对路径及 mailto；图片接受 HTTP、HTTPS 和站内相对资源，演示可显式开启栅格图片 Data URL，禁止 SVG Data URL。不得允许通过 CSS url、任意 class 或 style 注入页面样式。

颜色和字号允许的值域、样式组合、尺寸范围及 Markdown HTML 边界由 RFC 列出有限清单。只读输出也需校验这些属性，不能仅依赖编辑状态下的工具栏约束。

外部平台可能去掉 HTML 或不认识 Admonition 容器。预览页的 Markdown 区域说明该兼容性边界，不宣称导出结果能完整保留所有第三方平台的视觉效果。

## ExUI 样式与工具栏

参考旧版的标题层级、列表间距、引用侧线、代码容器、折叠块、图片选中和 Admonition 外观；不逐字迁移硬编码颜色、字体、重复主题分支或内嵌图标。

编辑器与查看器共用作用域化内容样式。正文继承 ExUI 字体、文本色、表面色和边框 token；代码采用项目已有的等宽字体规则。圆角使用当前有效的组件或密度 token，不假设存在 `--exui-radius-*`。必要的自定义排版尺寸使用 rem，不建立本地 token 层。

Admonition 类型映射当前 ExUI 语义状态颜色，Lucide 图标与类型一同表达意义。链接、高亮、图片选中、拖动提示、焦点和菜单状态均跟随主题。文档显式设置的颜色作为内容属性保留，默认配色和工具栏调色选项需在明暗主题中验证可读性。

工具栏覆盖已确认节点与 Marks 的插入、切换、清除和撤销重做。采用 ExUI Button、菜单、Popover、Tooltip 及必要输入控件；命令激活状态和不可用状态与当前选区一致。窄屏将低频命令移入更多菜单，不能隐藏后失去入口。

图标按钮具有可读名称，格式切换表达按下状态，菜单可通过键盘打开和关闭。保持内容选区的同时允许键盘进入工具栏。Tab 不被全局吞掉；拖柄并非插入与编辑节点的唯一入口，支持内容剪切与粘贴调整位置。

## 临时 React 预览页

页面建议位于 `apps/web/src/pages/Dev/TiptapPreview/`，仅在开发构建登记 `/dev/tiptap`。使用现有应用主题和组件，不挂载第二个 ThemeProvider；沿用 ThemeToggle，因此主题偏好沿用网站现有机制，文档内容本身仅存于内存。

页面包含以下区域：

1. 顶部显示预览用途、主题切换和恢复示例。
2. 编辑区包含共享编辑器与完整工具栏。
3. 只读区实时接收编辑器 JSON，展示同文档的阅读效果；窄屏上下排列。
4. 折叠的格式面板提供 JSON 和 Markdown 当前快照、复制、显式导入及诊断。正常预览以内容为主，不把原始数据面板默认铺满页面。

初始示例覆盖全部节点、Marks、四类 Admonition、嵌套列表、任务状态、折叠内容、Mention、图片尺寸及长文本。恢复示例同步恢复编辑与只读内容，并使旧异步演示操作失效。

Mention 使用本页固定演示名单；图片支持样例资源、URL 插入和本地文件演示。演示资源不发给服务端，本地图片引用离开页面后不作为持久链接使用。实现需限制演示文件类型和大小，并清理临时资源。导出内容若含临时资源，格式面板显示相应提示。

预览页不加入正式导航，不要求业务提交，不把用户本地文件上传。生产构建不得登记该路由或包含可执行预览页面代码，访问该路径走现有 404 行为；需检查构建产物，不能只以隐藏导航证明隔离。

## 验证与完成标准

| 层次           | 必须验证的行为                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Schema 与命令  | 无重复扩展；清单节点可创建；Admonition 插入、改类型、解除后内容保留；官方分隔线及图片尺寸有效。                     |
| 格式转换       | 每种节点和 Mark 单独及组合往返；Mention ID、Details 状态、图片尺寸、列表序号、任务状态、标题和代码精确保留。        |
| 导入失败与安全 | 无效 JSON、未知节点、表格、危险 HTML、事件属性、危险 URL 和 CSS；失败不修改现有文档；代码中的危险样本文本正常保留。 |
| React 生命周期 | 普通重渲染不重建实例或重置选区；显式替换生效；卸载与文档替换丢弃迟到上传和 Mention 响应；多实例不共享可变状态。     |
| 查看器         | 同文档样式一致；折叠可交互；任务状态只读；不存在编辑、拖动或缩放手柄。                                              |
| 开发页边界     | 开发直达入口可用，示例恢复和同步预览正确，生产路由及产物不包含可执行预览页。                                        |
| 真实浏览器     | 浅色、深色、系统主题；桌面及 375px 窄屏、200% 缩放；工具栏键盘导航、格式命令、块拖动、图片缩放和折叠操作。          |

沿用项目 Vitest、React Testing Library 与真实浏览器约定；没有 `TESTING.md` 时以现有测试配置为准，详见 `.ai/architectures/contract-tests/test-layers.md`。jsdom 不能证明拖柄位置、图片缩放、窄屏布局或实际主题可读性。

实现完成后执行 `pnpm typecheck`、`pnpm test` 和 `pnpm build`，另外报告真实浏览器结果。根命令包含 Outline 及数据库容器相关流程，所需环境不足时明确报告阻塞，不改连开发库或缩减后宣称全量通过。本阶段无上线部署验收。

## 风险、验证边界与后续

- 官方 Markdown 仍为 Beta。锁定版本，为本设计的转换清单建立行为回归；版本升级时重新验证，不以支持 parseHTML 推断特殊节点必然可以无损转换。
- 受控 HTML 与容器语法需要补齐转换规则。RFC 须核对已锁定官方源码和公开接口，确定白名单、转义与嵌套行为；若官方接口无法满足已确认语义，应先指出具体冲突，再调整方案，不能静默缩减节点支持。
- 旧版和新版 Image、Divider、自定义样式的 JSON 名称或属性可能不同。本阶段没有历史数据迁移要求，不增加未经确认的兼容层。
- 主题资料可能与实际 ExUI 包有差异。以锁定发布包的公开 types、token CSS 和当前指南核对，禁止创造不存在的 token。
- 本设计只基于仓库阅读、参考代码与官方文档调研，尚无实现、运行测试或浏览器验收证据。

本阶段结束后，业务页面可通过公开回调接入上传和 Mention 服务。真实服务的 Contract、权限、存储生命周期、业务 Markdown 消费方及其转换要求分别在后续业务设计中确认，不从本通用组件设计推导服务已具备这些能力。

## 替代方案

直接迁移旧编辑器会带入 Ant Design、旧 Markdown 内部实现、重复扩展和未完成命令，维护成本高。现成编辑器 UI 套件能减少初期工具栏代码，但需要适配 ExUI 和自定义节点，并引入额外 UI 约定。采用官方扩展加 ExUI 组合能保持节点来源清晰，将定制范围集中在 Admonition、转换和应用样式。

## 官方资料

- [Tiptap Image 与官方缩放](https://tiptap.dev/docs/editor/extensions/nodes/image)
- [Tiptap Markdown 能力与限制](https://tiptap.dev/docs/editor/markdown)
- [自定义扩展的 Markdown 接入](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension)
- [自定义 Markdown 序列化](https://tiptap.dev/docs/editor/markdown/advanced-usage/custom-serializing)
- [Tiptap Details](https://tiptap.dev/docs/editor/extensions/nodes/details)
- [Tiptap StarterKit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)
- [React DragHandle](https://tiptap.dev/docs/editor/extensions/functionality/drag-handle-react)
