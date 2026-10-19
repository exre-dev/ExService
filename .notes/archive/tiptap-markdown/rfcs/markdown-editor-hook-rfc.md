# RFC：Tiptap 双 Preset、统一 Editor Hook 与 GFM 接入

创建：2026-10-14。更新：2026-10-15。状态：用户已确认双 Preset 与统一接入设计；既有 GFM 基础已有源码，本次新增接口和固定配置调整仍是实施契约，尚未实现或通过运行验收。

来源：`.notes/tiptap-markdown/specs/2026-10-14-markdown-editor-hook-design.md`。模块根目录：`.notes/tiptap-markdown/`。本文与源设计同步修订，将已确认范围细化为一个可独立实施和验证的 RFC。

## 决策摘要

在同一共享包提供 useMarkdownPreset 与 useTiptapPreset，分别保持纯 GFM 和完整富文本 schema/转换。Preset 是初始化配置描述，不创建 Editor，不持有共享可变插件；配置后续变化不生效，不支持节点删减、任意扩展注入和运行时预设切换。

useTiptapEditor 内部使用官方 useEditor，按预设选择既有 runtime，返回原生 editor、interactions、issues 及 readJSON/exportMarkdown/replaceContent/focus。TiptapEditor 包装同一个 Hook，TiptapViewer 选择对应 viewing 工厂；自行布局的调用方挂载 EditorContent 与一次 interactions。所有 Editor 不自带顶部工具栏；工具栏按需显式组合。

两个 Preset 的 placeholder 支持 string、callback 或 false；slash 与 emoji 默认 true、分别可关闭，仅初始化读取。Markdown Slash 只包含纯 GFM 能力，不引入 Details、Mention 或提示容器，不添加左侧 `＋` 和拖动手柄。已有 useMarkdownEditor 保留公开字段与方法别名，以兼容适配器复用实现；其 emoji 同样改为固定初始化配置。

本期不实现 Issue 页面、业务 API、Markdown 图片上传、Mention、全新工具栏或部署；完整预设保留已有上传与 Mention 回调。HTTP Contract、数据库与 Outline 均无需修改。本次仅更新设计/RFC，不实施代码、不提交、不发布，也不自动提炼 `.ai/`。

## 当前证据与实现约束

| 已核对来源                                                                                                 | 结论与约束                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/components/src/tiptap/extensions/index.ts`                                                       | 完整预设含非 Markdown 节点、样式与受控 HTML 转换；新工厂不能从它返回的数组中过滤几个名字后继续使用其闭包。                    |
| `packages/components/src/tiptap/conversion/validate.ts`、`dom.ts`                                          | 现有 JSON 访问器与 HTML DOM 入口可作为参考，但完整预设的 H1–H4、textAlign、表格跨度规则不能直接用于新 schema。                |
| `packages/components/src/tiptap/conversion/policy.ts`、`marked.ts`                                         | URL、预算、固定错误与隔离 Marked 可复用；不修改模块级 Marked defaults。                                                       |
| `packages/components/src/tiptap/lifecycle.ts`、`markdown/runtime.ts`                                       | 两套协调器各自绑定所属转换和内容规则；统一 Hook 只选用并适配它们，不将完整 runtime 直接用于 GFM。                             |
| `packages/components/src/tiptap/emoji-trigger.ts`、`EmojiPickerPanel.tsx`、`markdown/useMarkdownEditor.ts` | 当前已有 session-aware Emoji 与独立 Markdown Hook；仍需统一接线、固定配置、Slash 和 placeholder，不能声称新增 Preset 已可用。 |
| 安装的 `@tiptap/extension-image` 3.32.0 源码                                                               | Image 默认保存 width、height；只关闭 resize 无法满足无尺寸属性的契约，必须覆盖属性定义与入口检查。                            |
| 安装的 `@tiptap/extension-table` 3.32.0 源码                                                               | 单元格默认 content 为 block+，保留 colspan、rowspan、colwidth、align；需限制到单 paragraph，并检查整个表格。                  |
| 安装的 `@tiptap/extensions` UndoRedo 与 `@tiptap/pm/history` 源码                                          | UndoRedo 使用官方 history 插件。closeHistory 只关闭分组，addToHistory=false 也不清除已有记录；整篇替换需重置 history state。  |
| 安装的 ProseMirror State PluginSpec、StateField 源码                                                       | Plugin.spec、state.init/apply 和 plugin key 是公开组合面；可包装官方 history 的 state.apply 而不读取其私有 Branch。           |
| `packages/components/src/tiptap/TiptapEditor.tsx`、`TiptapViewer.tsx`、`types.ts`                          | 当前固定使用完整预设，Editor 自动挂载工具栏；preset、统一 Hook 与工具栏移除是本次新增契约。                                   |
| `packages/components/package.json`                                                                         | `@tiptap/extensions` 已为直接依赖；Tiptap 3.32.0、Marked 17.0.1、parse5 8.0.1 与现有 Emoji 依赖足够，不计划升级或新增引擎。   |
| `vitest.config.ts`、`scripts/runtime/tests.mjs`                                                            | 新共享测试自动进入现有 Website Vitest include；完整根测试还含容器与 Outline。                                                 |

遵守 `AGENTS.md`、`CONTRIBUTING.md`、`.ai/knowledge/components/tiptap-content-boundaries.md`、`.ai/knowledge/web/exui-integration-traps.md` 和前端通知规则。开发预览若增加表单，必须遵守 `.ai/rules/frontend-forms.md`。

[官方 Markdown 文档](https://tiptap.dev/docs/editor/markdown)允许 HTML 且声明表格限制，本 RFC 在扩展入口和转换门禁主动限制它。[官方 React 文档](https://tiptap.dev/docs/editor/getting-started/install/react)支持 useEditor 与 EditorContent 的组合。语法目标为排除原始 HTML 的 [GFM](https://github.github.com/gfm/)，不包含 GitHub 产品的身份提及或自定义 Emoji。

## 模块与依赖方向

| 路径                                                                     | 责任                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `packages/components/src/tiptap/markdown/types.ts`                       | Hook、工厂与选择器绑定的公开类型。                                         |
| `packages/components/src/tiptap/markdown/extensions.ts`                  | 独立预设、受限 Image/Table、官方扩展转换适配。                             |
| `packages/components/src/tiptap/markdown/validate.ts`                    | JSON 未知字段检查、schema 校验、属性范围与完整表格限制。                   |
| `packages/components/src/tiptap/markdown/normalize.ts`                   | 编辑快照到 Markdown 交换语义的规范化与比较键。                             |
| `packages/components/src/tiptap/markdown/conversion.ts`                  | 带格式的导入、纯 Markdown 导出、token 检查、往返验证。                     |
| `packages/components/src/tiptap/markdown/paste.ts`                       | HTML AST 清理、降级和候选 Slice；不处理文件上传。                          |
| `packages/components/src/tiptap/markdown/guard.ts`                       | 接受前的内容门禁、粘贴/drop 接入、accepted transaction 回执。              |
| `packages/components/src/tiptap/markdown/history.ts`                     | 包装官方 UndoRedo 的 history state，响应本模块替换 meta。                  |
| `packages/components/src/tiptap/markdown/runtime.ts`                     | 当前实例归属、错误状态、整篇替换、Emoji 代际及稳定方法。                   |
| `packages/components/src/tiptap/markdown/useMarkdownEditor.ts`           | 保留字段与别名的兼容适配，复用统一 Hook/runtime，不创建第二个 Editor。     |
| `packages/components/src/tiptap/markdown/MarkdownEmojiPicker.tsx`        | 小型 lazy/Suspense 宿主，复用现有 EmojiPickerPanel。                       |
| `packages/components/src/tiptap/markdown/index.ts`                       | 本模块导出汇总；不公开运行协调器和内部状态。                               |
| `packages/components/src/tiptap/presets.ts`                              | 两种固定 Preset Hook、初始化快照和用途分派；不保存 Editor 状态。           |
| `packages/components/src/tiptap/useTiptapEditor.tsx`                     | 单一 useEditor、既有 runtime 适配与统一返回值，包括 interactions。         |
| `packages/components/src/tiptap/types.ts`                                | Preset、统一 Hook、组件契约与原生内容操作类型。                            |
| `packages/components/src/tiptap/TiptapEditor.tsx`、`TiptapViewer.tsx`    | 共享接入；移除内置工具栏，Viewer 用所属查看预设。                          |
| `packages/components/src/tiptap/insert-block.ts`、`InsertBlockMenu.tsx`  | 复用触发/session/弹层，分离完整与 GFM 命令及图片 URL 输入。                |
| `packages/components/src/tiptap/table/node-view.ts`、`TableControls.tsx` | 完整预设的表格只读门禁改为 NodeView 显式状态，不依赖消费方的祖先 Context。 |
| `packages/components/src/tiptap/content-styles.ts`                       | 公开稳定正文样式类出口，复用 TiptapContent.module.scss。                   |
| `packages/components/src/index.ts`                                       | 添加公开接口和类型。                                                       |
| `apps/web/src/pages/Dev/TiptapPreview/MarkdownDemo.tsx`                  | 仅开发预览：Hook 的真实组合、两个实例、读取和替换操作。                    |
| `tests/browser/tiptap-markdown.mjs`                                      | 接收既有 DEV 页面与浏览器 Page 的验收 helper。                             |

依赖方向为共享 Editor/兼容 Hook → useTiptapEditor → 所选 runtime → 所属 conversion/extension factory/guard。Preset Hook 只用 lazy 初始化生成固定配置描述；底层 extension factory 与转换不导入 React Hook。Emoji 与 Slash 展示复用公共交互。避免工厂、转换与校验互相循环：validate 接收 Schema；conversion 负责构建 conversion-purpose schema；editing guard 使用 Editor 当前 schema，不回调 conversion 重新创建编辑扩展。

现有安全 policy、ContentBudget、隔离 Marked 按原路径复用。新校验器可以复用真正无预设依赖的遍历原语，但不得为了新预设改写完整预设的属性、HTML 或规范化策略。

正文样式公开为 `tiptapContentClassName: string`，施加到 EditorContent 的外层容器，与现有编辑器的使用方式一致。补充 H5/H6 排版到已有 CSS Module；尺寸、内边距、背景与布局由调用方的作用域样式覆盖。类出口不放入 Hook 返回值，不让底层工厂加载 React 或 ExUI 全局样式。

## 公开 TypeScript 契约

以下是拟实现的约束性接口，Editor、JSONContent、AnyExtension 使用 Tiptap 公开类型，Node 使用 `@tiptap/pm/model`，ReactNode 使用 React 类型。TiptapInput、TiptapResult、TiptapIssue、TiptapContentPolicy 与 TiptapEditorHandle 沿用已有含义。

```ts
export type TiptapPlaceholder =
  | string
  | false
  | ((context: { editor: Editor; node: Node; pos: number; hasAnchor: boolean }) => string)

export interface MarkdownPresetOptions {
  placeholder?: TiptapPlaceholder
  slash?: boolean
  emoji?: boolean
}
export interface TiptapPresetOptions extends MarkdownPresetOptions {
  policy?: TiptapContentPolicy
}
export interface MarkdownPreset {
  readonly kind: 'markdown'
  readonly options: Readonly<MarkdownPresetOptions>
}
export interface FullTiptapPreset {
  readonly kind: 'tiptap'
  readonly options: Readonly<TiptapPresetOptions>
}
export type TiptapPreset = MarkdownPreset | FullTiptapPreset

export function useMarkdownPreset(options?: MarkdownPresetOptions): MarkdownPreset
export function useTiptapPreset(options?: TiptapPresetOptions): FullTiptapPreset

export interface TiptapEditorSessionOptions {
  initialContent?: TiptapInput
  ariaLabel: string
  editable?: boolean
  onChange?: (content: JSONContent) => void
  onError?: (issues: readonly TiptapIssue[]) => void
  onNotice?: (notices: readonly TiptapIssue[]) => void
}
export interface TiptapServiceCallbacks {
  uploadImage?: (file: File, context: { signal: AbortSignal }) => Promise<TiptapUploadedImage>
  resolveMentions?: (
    query: string,
    context: { signal: AbortSignal },
  ) => Promise<readonly TiptapMentionItem[]>
}
export type UseTiptapEditorOptions = TiptapEditorSessionOptions &
  (
    | { preset: MarkdownPreset; uploadImage?: never; resolveMentions?: never }
    | ({ preset: FullTiptapPreset } & TiptapServiceCallbacks)
  )
export interface UseTiptapEditorResult extends TiptapEditorHandle {
  editor: Editor | null
  interactions: ReactNode
  issues: readonly TiptapIssue[]
}
export function useTiptapEditor(options: UseTiptapEditorOptions): UseTiptapEditorResult

// Shared Editor 缺省采用完整预设；保留原 handle，不再接收 policy/toolbar/renderToolbar。
export type TiptapEditorProps = TiptapEditorSessionOptions & { className?: string } & (
    | { preset: MarkdownPreset; uploadImage?: never; resolveMentions?: never }
    | ({ preset?: FullTiptapPreset } & TiptapServiceCallbacks)
  )
export interface TiptapViewerProps {
  preset?: TiptapPreset
  content: TiptapInput
  ariaLabel: string
  className?: string
  onError?: (issues: readonly TiptapIssue[]) => void
}

// 已有兼容接口保留，不增加自动 interactions 宿主。
export interface UseMarkdownEditorOptions {
  initialMarkdown?: string
  ariaLabel: string
  editable?: boolean
  emoji?: boolean
  onChange?: (content: JSONContent) => void
  onError?: (issues: readonly TiptapIssue[]) => void
  onNotice?: (notices: readonly TiptapIssue[]) => void
}
export interface MarkdownEmojiAnchor {
  readonly from: number
  readonly to: number
}
export interface MarkdownEmojiPickerProps {
  editor: Editor
  anchor: MarkdownEmojiAnchor
  session: object
}
export interface UseMarkdownEditorResult {
  editor: Editor | null
  getMarkdown: () => TiptapResult<string>
  setMarkdown: (source: string) => TiptapResult<JSONContent>
  emojiPickerProps: MarkdownEmojiPickerProps | null
  issues: readonly TiptapIssue[]
}
export function useMarkdownEditor(options: UseMarkdownEditorOptions): UseMarkdownEditorResult
export function MarkdownEmojiPicker(props: MarkdownEmojiPickerProps): ReactElement | null

export interface MarkdownExtensionOptions {
  purpose: 'editing' | 'viewing' | 'conversion'
  onError?: (issues: readonly TiptapIssue[]) => void
  onNotice?: (notices: readonly TiptapIssue[]) => void
}
export function createMarkdownExtensions(options: MarkdownExtensionOptions): AnyExtension[]
export function parseMarkdownContent(input: TiptapInput): TiptapResult<JSONContent>
export function serializeMarkdownContent(content: JSONContent): TiptapResult<string>
export const tiptapContentClassName: string
```

Preset 是只读初始化描述，Hook lazy 初始化时复制 options 与 policy 等嵌套配置，返回引用稳定；工厂只读此快照，不在后续渲染中热更新。placeholder callback 固定函数引用，不承诺冻结外部可变闭包。schema、policy、slash、emoji、placeholder 均在每个 Editor/Viewer 初始化时固定；换 preset 参数不重建或切换 schema，调用方需要显式更换组件 key。每个用途重新构造扩展及 runtime，不把一个数组复用于多个 Editor。

editable、ariaLabel、事件回调和完整预设服务回调是运行状态，继续读取最新值；它们不是 Preset 配置。initialContent 为非受控初始化输入，Viewer content 则继续响应正文更新。Viewer 始终使用初始化时的预设转换新 content，避免用新 policy 解析旧 schema。

新 Hook 返回原生 Editor，调用方用 EditorContent 与一次 interactions 自行布局；共享 TiptapEditor 完成同样组合，不自动挂载顶部工具栏。interactions 只能从当前 live Editor/session 创建；只读或卸载时及时移除，并释放目标、异步回调和菜单状态。

当前完整表格依赖 EditorContent 上方的 TableEditingContext，单独返回同级 interactions 无法提供该祖先 Context。实施时将表格控制器的只读门禁移到 NodeView 显式 enabled 属性，由统一实例接线在 editable 变化时同步并关闭失效菜单，替换仅依靠祖先 Context 的判断。不增加公开 Provider 或要求消费方包装内部 Context；必须验证原生 EditorContent 接入下只读切换、恢复编辑与表格菜单取消，避免共享组件可用而原生组合泄漏控件。

readJSON/exportMarkdown/replaceContent 结果沿用现有 TiptapEditorHandle；方法引用稳定，内部始终访问归属匹配的当前 Editor。失败返回 issues，不暴露部分 Markdown；导入失败时锁存原始诊断，不允许安全空文档被误交。focus 无有效实例时不操作。

useMarkdownEditor 作为兼容适配器：初始化创建 slash=false、placeholder=false、emoji=options.emoji 的 Markdown Preset；initialMarkdown 映射为 initialContent。getMarkdown/setMarkdown 分别转发 exportMarkdown/replaceContent，保留现有 emojiPickerProps 与外部 MarkdownEmojiPicker 挂载。公共接线在内部只产生一份 Emoji 状态，通过小型私有适配取出绑定，兼容路径不再挂载自动宿主，不增加另一套 runtime。emoji 从动态开关改为初始化配置的行为变化必须迁移演示与测试，其他既有替换、错误和历史保证保留。

options 不接受任意 extensions、节点删减或运行时 schema 切换。高级工厂调用先 parseMarkdownContent 获得验证后的 JSON，再创建原生 Editor；它不自动拥有统一 Hook 的替换与交互保证。不安装官方 Markdown extension 来开放额外未受门禁的 contentType 入口，转换继续使用公开 MarkdownManager。

固定诊断沿用已有 normalized-content/downgraded-content 和其现有消息；失败继续使用 not-ready、invalid-content、unsupported-content、unsafe-content、limit-exceeded、conversion-failed，不记录正文或原始异常。导出/替换结果的 notices 同时发送 onNotice 一次，失败更新 issues 并通知 onError 一次。纯转换只返回结果；同一 operation 的 guard/runtime 不重复报告。初始错误一次活跃挂载通知一次，StrictMode effect replay 不重复发送。

## Placeholder、Slash 与交互宿主

两个 Preset 的 slash/emoji 缺省 true。false 时不安装对应触发与 UI；关闭命令不改变持久 schema，已有 Unicode Emoji 仍为普通文本。placeholder 缺省使用通用输入提示，按已启用的 `/`、`$` 追加说明；完整预设仅在 resolveMentions 可用时追加 `@`。字符串与 callback 结果原样覆盖，不再拼接默认说明；false 完全不安装 decoration。使用官方 Placeholder 的公开配置，只对可编辑的空顶层 paragraph 显示，标题、嵌套段落、只读和独立 Viewer 不显示，不能进入 JSON/Markdown。

Markdown Slash 仅在空顶层 paragraph 的直接 `/` 输入触发，排除组合输入、代码、粘贴、导入和 Undo。命令包括正文、H1–H6、无序/有序/任务列表、引用、代码、分隔线、简单 GFM 表格和图片 URL。表格建立带全表头、每格单 paragraph 的 3×3 矩形；图片 URL 经现有表单约定和 GFM 图片检查，只构造 inline src/alt/title，不读取本地文件、不上传或增加尺寸属性。所有持久结构由受限 schema 构造，不能复用完整预设的 textAlign 等默认属性。

优先复用 insert-block 现有触发、位置映射、session、虚拟锚点、ExUI Popover 与键盘导航，最小化提炼命令集合和内容构造函数；不创建通用插件注册系统。Markdown 不挂载 InsertBlockControls、DragHandle 或完整表格 NodeView。完整预设保留原有上下文控制和上传/Mention 服务接线，菜单禁止出现其 schema 不支持的项。

选择成功替换有效触发段落，选择进入新块，整个插入为一次 Undo；Escape/外部取消保留 `/`。图片 URL 表单延续同一 session，失败或取消不消耗目标。命令结果必须通过当前全文内容门禁并确认接受，不能以 commands=true 当作成功；失败保持正文与锚点。位置随 StepMap 映射，删除、整体替换、只读和卸载使旧 session 失效，迟到图片 URL 提交或 Emoji 选择不能写进新目标。

React 接线提取到统一 Hook 后，共享组件不再保留另一套 useEditor/effect；interactions 是返回的展示节点，不是新的编辑实例。两套 runtime 在 lazy 初始化中静态选择，统一 Hook 始终按固定顺序调用一次 useEditor，不按 kind 条件调用不同 Hook。正文与交互节点放在同一外壳的同级布局，不能把工具 UI 放进 ProseMirror 正文 DOM。只读编辑实例可继续用统一 Hook editable=false；独立 Viewer 使用更轻的 viewing 工厂，没有历史和编辑交互。

## 插件预设与 JSON 校验

StarterKit 保留基础节点、Bold/Italic/Strike/Code/Link、列表与光标，显式配置 heading levels 为 1–6、underline=false、undoRedo=false。editing 另登记受控 UndoRedo；viewing/conversion 无历史。StarterKit 子扩展的 Markdown 适配通过公开 extend 钩子完成，flattenExtensions 检查重名。

加入官方 TaskList/TaskItem、受限 Image 和 Table/Row/Header/Cell。TaskItem nested=true，只读点击不写文档。Link 不持久化 target/rel 等浏览器打开策略；节点仅保留 href、title，属性范围在实际锁定版本的 schema 下显式定义，链接打开策略由 UI 配置，不进入交换语义。每种用途使用相同属性定义。

Image inline=true、allowBase64=false、resize=false，覆盖 addAttributes 只返回 src/alt/title。覆盖 setImage 的输入检查，拒绝 width/height/未知键后才构造节点，避免其被 schema 静默忽略。图片 parseMarkdown 与 serializer 覆盖官方未转义字符串拼接：alt 使用文字转义，目的地址使用能保留括号的合法 Markdown destination，title 转义引号和反斜线；解析对应恢复属性字符，不改变 URL 字符串。

Table resizable=false，不安装现有完整表格操作 NodeView。单元格 content 改为 paragraph，保留 colspan=1、rowspan=1、colwidth=null 这些官方表格插件需要的结构默认值，但验证拒绝其余取值；align 为 null/left/center/right。每表行宽一致，首行全 tableHeader，后续全 tableCell，每格一个 paragraph，无嵌套表格。每列 align 一致。不允许单格换行 hardBreak；不能纯语法表达的此类内容导出失败，粘贴路径将该表降级为文本。

JSON 验证按以下顺序执行：

1. 校验输入结构、原型、循环引用、深度和节点数；逐节点只接受 schema 的已知节点、Marks 与明确字段。
2. 按类型校验 attrs，未知键在 ProseMirror 读取前拒绝。Heading level 为 1–6；OrderedList 只保留 start；CodeBlock 保留受限语言；Link/Image 检查安全 URL；无 textAlign、文字方向或完整预设属性。
3. 检查文本叶、Marks、属性数据类型和字节预算，再调用 Schema.nodeFromJSON 与 Node.check。
4. 对表格逐行逐格做矩形与内容检查，不构建跨度网格；预算计算包含所有节点和文本叶。
5. 导入空 doc 规范为单空 paragraph；需要编辑的结尾补空 paragraph，使用本 schema 默认属性，不填入完整预设的 textAlign。最终默认属性和补建节点再次计入预算。

editing guard 在原始事务接受前验证完整候选文档。禁用相关 HTML/Markdown 自动 paste rules，保持 text/plain 字面语义；正常直接输入的官方 input rules 保留。表格 mergeCells、无表头建表、复杂单元格等原生命令即使返回 true，违规文档也必须被拒绝。既有合法正文无需每击键跑序列化；暂时空标题和空段落可以编辑。

## Markdown 解析、规范化与导出

每个转换上下文用独立 Marked facade 和 MarkdownManager，gfm=true、breaks=false、async=false；不安装完整预设的 tokenizer、Admonition、controlledHtml 或 block-image 提升。数据与 token 预算沿用 policy 的 8 MiB UTF-8、10,000 节点及文本叶、深度 32。

显式 Markdown 输入先 lex，再递归访问正文、列表、表格 cell tokens。code/codespan 内的 HTML 是字面内容；其他 html token，包括注释、内联标签和块标签，返回 unsupported-content。合法 GFM autolink 使用 parser 的对应 token，不用扫描 `<` 字符判断 HTML。图片、链接、标题等 parseMarkdown 适配到本预设后，再做完整 JSON 校验。

新增 canonicalMarkdownJSON 比较函数，不复用完整预设 semanticJSON 对额外属性的忽略规则。它产生交换快照，不修改 Editor 当前正文：

- 合并相邻同 Marks 文本，统一本 schema 默认属性。
- 移除布局空 paragraph，将空 heading 按空 paragraph 处理；容器仍需 schema 所要求的最小结构，无可表达结果时返回 conversion-failed。空 doc 的比较键统一为空正文，导出空字符串。
- Marks 两侧空白移到 Marks 外，正文字符与次序保持；同义 Marks 统一排序与拆分，Code 的文本不按此规则清理。
- 按隔离 GFM lexer 的自动链接规则补齐普通文本中的 Link 语义，代码与已有链接排除；不能用 HTML 阻止自动链接，也不能用简单正则把标点错误并入 href。
- 表格每格仅 trim 允许规范化的段首尾普通空白，并返回 notice；内部 Unicode 空白、Tab、U+001F、换行等不能被 serializer 静默折叠。若实现适配仍无法保真，则导出失败。
- 末尾编辑占位 paragraph 不参与交换比较，实际文字、代码文本、图片属性、任务勾选和列对齐参与比较。

序列化使用官方 extension renderMarkdown 的公开适配；CodeBlock 使用长于代码内部最长反引号序列的围栏。Image/Link、代码、文本和 table pipes 的转义需分别处理，不以全局字符串 replace 修复整篇文档。普通段落按所在上下文转义可能成为标题、引用、列表、分隔线或围栏的行首文字；会被解释为缩进的段首空格与 Tab 使用字符实体保留，普通段内 Tab 也使用可重读的实体。仅编码文字节点，不能改动代码内容或官方生成的结构缩进。列对齐与单元格行内内容走官方 GFM table 路径，禁止受控 HTML 回退。

导出流程为 validate → canonical snapshot → serialize → 输出预算与 token 检查 → parse 同一预设 → canonical compare。重读结果必须不含 code 以外 HTML token，比较失败或超预算返回失败且不暴露部分字符串。第一次成功结果再次导入与导出须稳定；规范化说明不暴露原始正文。

允许编辑中存在尚不能表示的特殊空白与临时结构；规范化之外的语义不能保存时，exportMarkdown（兼容 getMarkdown）明确失败。该行为是纯语法边界，不允许实现时增加自动删除文字或 HTML fallback 来取得成功。

## 粘贴、drop 与文本降级

paste.ts 使用 parse5 原始 token 与 AST。原始输入先检查字节、深度与节点预算，再按白名单构造清理后的 AST；DOMParser 与 ProseMirror parser 只接收清理后的片段，活动页面不挂入未经清理的 HTML。普通包装节点解包，执行性或资源性节点整棵移除。

保留语义标签 p/h1–h6、strong/b、em/i、s/del、code/pre、br/hr、blockquote、列表、合规 a/img 和合格 table。仅在任务列表结构下解释 checkbox 状态，不保留一般表单控件。属性输出来自逐字段构造，不复制输入 attrs 对象。可以将明确有限的 inline font-weight:bold 或 600–900、font-style:italic、text-decoration:line-through 转成对应 Marks；其他 style 不输出。已声明 hidden 或明确 inline display:none/visibility:hidden 的内容移除；不执行外部样式表，也不宣称计算完整 CSS 可见性。

Details、提示容器等按 AST 顺序提取安全标题和正文。危险 a 解包保留文字，危险 img 保留非空 alt 文本；script/style/iframe/object/embed 等连同内容移除。普通 HTML 中的资源不自动上传、下载或转成 Data URL。

简单表格先检查真实结构、首行表头、列级 align、单段行内内容及有限默认跨度。尺寸/列宽样式可以移除；出现合并、无表头、多段、嵌套表格、hardBreak 或无法保留的内容即走文本降级。按原始行 DOM 顺序生成 paragraph，单元格以文字 Tab 分隔，内部块边界为 hardBreak；递归提取嵌套表格文本，不按 colspan/rowspan 展开、不复制单元格、不臆造表头。文本顺序、Emoji 和文字换行保留，Marks 不保留；发送 downgraded-content notice。

无安全 HTML 结果且存在 text/plain 时构造纯文本 Slice；按原生正文语义拆行，不整篇猜测 Markdown。文本不触发 Bold 等 paste rules。超预算不能通过 fallback 绕过拒绝；不支持文件时消费该文件输入并报告固定 unsupported-content，不让浏览器转而打开文件。HTML 与文件混合输入以文件拒绝为准，避免静默遗漏附件。

外部 HTML drop 与粘贴共用降级规则，先计算落点并校验仍属于当前可编辑实例；内部 moved=true 保持原生移动语义，最终通过 guard。无配置文件上传这一事实不意味着可接受 blob/data URL。

清理后构造 Slice.maxOpen，在当前 state 上生成替换选区或落点的候选 transaction。验证的是插入后的整篇 doc，而非只检查片段。接受后一次性提交，作为一个撤销事件；失败保持正文、选区和历史。通知只在确认结果后发出一次。表格降级的 Tab/HardBreak 必须纳入 serialize 回归，不能让粘贴后正文实际有字而 Markdown 导出偷偷折叠。

## 生命周期、替换与历史

runtime 持有活跃 Editor 身份、latest callbacks reader、initial failure、operation diagnostic、document generation 和 accepted-operation 回执；不会持有第二份受控正文。统一 Hook 的 lazy 初始化按所选预设解析 initialContent，兼容入口先映射 initialMarkdown。useEditor content 只接收验证后的 JSON 或安全空文档，shouldRerenderOnTransaction=false。Preset 与实例配置固定；useRef 只保存最新运行状态与 callbacks，effect 更新 editable/ariaLabel 并处理只读取消，不更新 Preset 配置。

readJSON/exportMarkdown/replaceContent（兼容 getMarkdown/setMarkdown）通过稳定函数访问所选 runtime 当前实例；未准备或已销毁返回 not-ready。初始错误锁存到成功 replaceContent，exportMarkdown 在锁存期间失败；后续纯编辑不能把遗失的初始原文当作恢复成功。一次成功正文编辑可以清除普通操作错误，不能清除初始错误。导出失败不改变正文、选区、历史或 Emoji 状态；成功导出清除旧导出错误，但不清除初始错误。

replaceContent 的落地步骤（兼容 setMarkdown 仅将字符串包装为 markdown 输入）：

1. 使用所选预设的独立转换上下文解析 TiptapInput，失败只通知错误，不使 generation 或任何交互 session 失效。
2. 在当前 live Editor state 上构造全篇 replace transaction，选择置为正文起点，携带不可序列化的本模块 replace-session meta 和 operation token；不调用 focus 或 scrollIntoView。
3. 预先验证完整候选，dispatch 后检查 guard/runtime 在 Plugin state.apply 阶段记录的 accepted token；不根据 commands 的 true/false 或内容相等判断接受情况。
4. 同一已接受事务内清空历史、取消旧 Emoji/Slash 及其他所属交互 session、递增 generation。rejected transaction 不触发这些变化。成功方法只通知 onChange 一次，抑制同 operation 的重复 onUpdate；即使新正文相等，显式成功替换仍更新代际并通知一次。
5. 清除初始与操作错误，返回独立 JSON 快照和 notices。普通用户编辑由 accepted update 路径通知 onChange，snapshot 不能是可变内部对象。

history.ts 通过官方 UndoRedo.extend 的 addProseMirrorPlugins 包装父 history 插件：保留原 Plugin.spec（包括 key、config、props）和 state field 的其他方法，只覆盖 state.apply。检测已接受的 replace-session meta 时调用原 state.init 获取空历史；其他事务委托原 state.apply。官方 undo/redo 与 keymap 沿用原 key；不导入私有 HistoryState/Branch，不修改 node_modules，也不扫描键名字符串。

替换事务 addToHistory=false；后续由同次替换触发的 trailing paragraph append 不能形成一条恢复旧文档的记录。必须用公开 undoDepth/redoDepth 和真实 Undo/Redo 操作验证替换后旧历史为空、新文档上的新编辑可正常撤销。closeHistory 仅用于分组隔离，不能代替该 reset。

StrictMode 临时实例的 onDestroy 必须核对身份；effect cleanup 只 detach 自己挂载的实例。回调通知在已挂载且归属匹配时发送；已卸载实例的 queued diagnostics 丢弃。原生 Editor 接口不提供另一个“受控值”模式，调用方不能以 onChange 回传 initialMarkdown 替换正文。

## Emoji 与正文样式

复用现有 emoji-trigger.ts 的独立 session 与可选 isEnabled reader，不重新实现一份触发器。emoji=true 的初始化配置安装此交互扩展一次，交互只读取实时 editable/composing；emoji=false 不安装，后续 options 变化不启用或关闭它。需要改变配置须显式重建实例。

沿用 insertPickedEmoji 的 expectedSession 检查；MarkdownEmojiPicker 与统一 interactions 均传入捕获的 session。选择时核对当前 plugin anchor、session、触发字符、editable、live Editor 和 generation，使用当前映射位置。取消时同样核对 session，不让旧组件关闭新 session。成功替换直接通过 transaction meta 取消，而非先 dispatch 一条独立取消事务。

公共 lazy 宿主引用 EmojiPickerPanel，保留 ExUI Popover、原生 Emoji 网格和既有视觉约定。面板打开前的 blur 由 trigger 插件处理；Picker 加载期间触发失效后，不因模块加载完成再次出现。Escape 保留 `$` 并回到仍有效的正文；外部点击不抢焦点。Unicode 始终是普通文本，emoji=false 仍支持直接输入或粘贴 Emoji。

可选 tiptapContentClassName 的 usage：外层 div 使用该类，内部放 EditorContent 与调用方自己的 scope class；Emoji popup 不嵌入正文 DOM。CSS 使用既有 ExUI tokens 和自托管代码字体；公共组件不导入 ExUI 全局样式。表格在窄屏横向可读，图片不超出容器，H5/H6 与已有 H1–H4 排版保持一致。

## 取舍与风险

| 选择或风险                               | 处理与检测                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 独立预设 + Hook 增加模块数量             | 责任分离；不增加独立 package 或通用 profile 框架，所有模块在同一共享包落地。                                                   |
| 共享组件接收不同 Preset                  | 采用静态 kind 分派，仍使用两套独立 schema/runtime；不在完整扩展数组中过滤节点，不热切换 mode。                                 |
| 动态更新 Preset                          | 不采用；初始化快照降低扩展生命周期与取消逻辑复杂度，显式重建才能应用新配置。                                                   |
| 内置工具栏兼容                           | 依用户决定移除默认 UI 和 toolbar/renderToolbar；迁移消费方为原生 Editor 与显式按钮，不偷偷恢复自动挂载。                       |
| 仅 useMarkdownExtensions                 | 不作为主入口；调用方仍需重复生命周期、错误、替换与 Emoji 接线。                                                                |
| MarkdownManager 与 serializer 的边缘缺陷 | 使用锁定版本的公开适配和往返检查，针对 URL 括号、引号、管道、Unicode 空白写测试。不能保真时明确失败，不偷偷换引擎或输出 HTML。 |
| 包装官方 history 的 state field          | 本地发布源码证明组合面存在；实现后必须通过真实历史 reset、keyboard Undo/Redo、StrictMode 测试，不能只静态断言 metadata。       |
| JSON 门禁扫描是 O(文档大小)              | 沿用现有有限预算；不在击键路径增加 parse/serialize 往返。无需未经测量就引入缓存失效框架。                                      |
| 暴露原生 Editor 的绕行                   | 文档明确初始化/替换的验证入口；特殊命令主动检查输入，接受后的 doc 始终受 guard。不会宣称能发现被原生解析器提前丢掉的字段。     |
| Clipboard 可能被 parser 修复             | 原始 token/AST 与降级前后预算检查；无法安全保留时回退已有纯文本或拒绝，禁止成功插入半份内容。                                  |
| 规范化会改变 Markdown 写法               | 返回明确 notices，只对批准的空结构、Marks 边界、自动链接与表格边缘空白做规范化。                                               |
| 用户输入可能泄漏到日志                   | 不记录正文、HTML、Markdown、URL 或异常；fixed diagnostics 仅携带 code/message/path。                                           |

浏览器 DOM 是明确运行前提；SSR、服务端校验、外部图片可达性和第三方平台渲染一致性不属于本期保证。没有数据库、后端或持久内容迁移。

## 验证矩阵

新增测试按模块 colocate，关键行为必须通过实际 Editor 与公开出口运行：

| 范围             | 必须覆盖的断言                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factory/schema   | editing/viewing/conversion schema 等价；无重复 extension；两个实例不共享历史、存储或回调；所有非目标节点缺席。                                                                                                        |
| JSON/commands    | Unknown field/Mark/attribute 在导入前拒绝；H6 可用；图片 width/height 拒绝；mergeCells、无表头和多段单格事务不改变 doc。                                                                                              |
| Markdown         | 全支持内容往返；原始 HTML 拒绝，code HTML 可用；inline image 在句中/列表/表格保持位置；URL 括号、alt 方括号、title 引号和表格 pipe 正确转义。                                                                         |
| Normalization    | 空文档、空 heading、内部和末尾空 paragraph；Marks 边缘空白；自动链接标点；table edge 空白 notices；以标题/引用/列表符号、数字列表和 Tab/空格开头的普通文字不会变为其他块；代码与 Emoji 序列不变；成功结果再导入稳定。 |
| Paste/drop       | Word/网页格式降级；span 去样式；Details 内容顺序；合并、无表头、多段和嵌套表格转文本；Tab 与单元格换行可再次导出；危险地址、执行性内容、文件与混合输入。                                                              |
| Atomicity/budget | HTML 安全回退、超预算拒绝；粘贴片段本身合法但全文超预算时原文不变；被 guard 拒绝的 replaceContent/setMarkdown 保持选区、历史、generation 与所有交互 session。                                                         |
| Hook/events      | initialContent/兼容 initialMarkdown 不受控；latest callback；错误锁存；effect replay 通知次数；ordinary edit 清除普通错误；成功相同内容替换仍通知一次；get/set 方法引用稳定。                                         |
| History          | 先编辑旧文档产生 undo/redo，成功替换后两者为零且不能恢复旧文档；新正文编辑仍可正常 Undo/Redo；失败替换保留旧历史；等价替换也清空旧历史。                                                                              |
| Emoji            | `$` 仅直接输入触发；组合输入/代码/导入/粘贴/Undo 排除；映射；取消；初始化开关与只读；旧 session 选择和取消不能作用于新 session；加载时失焦；预算拒绝。                                                                |
| Preset/config    | 两种 Hook 引用稳定；配置/placeholder callback 初始化固定，传入新 options/preset 不重建 Editor 或覆盖正文/选区/历史；显式重建才生效；同描述复用不共享插件、runtime 或 session。                                        |
| Placeholder      | string/callback/false；按开关生成默认文案；顶层空 paragraph 限定；不会写入 JSON/Markdown；Viewer/只读缺席。                                                                                                           |
| Slash            | GFM 命令全集可导出，无 Details/Mention/Admonition；H5/H6、带表头表格、行内图片 URL；直接输入限定、取消、映射、只读、迟到表单和预算拒绝。                                                                              |
| Shared/native    | 共享组件与原生 EditorContent + interactions 使用同一 runtime 行为；原生完整 Editor 的表格控件随 editable 关闭、取消 session 与恢复；独立 Viewer 用所属查看 schema；无自动工具栏、无双实例或重复 Emoji 宿主。          |
| Compatibility/UI | getMarkdown/setMarkdown 与旧返回字段；emoji 固定配置的明确变化；完整转换与 Emoji 回归；原有 toolbar/policy 消费迁移；显式工具栏格式操作、上下文 session、共享样式与多实例隔离。                                       |

执行顺序：`pnpm exec vitest run packages/components/src/tiptap` → `pnpm --filter @workspace/components typecheck` → `pnpm typecheck` → `pnpm test` → `pnpm build`。新增边界测试失败时修复该边界后再扩大检查；根测试使用既有隔离容器流程，不回退开发库。保存本次变更路径，防止生成产物或其他用户编辑混入交付。

真实浏览器 helper 使用已有 DEV 服务和 Page，不自行启动/停止资源。开发预览覆盖两种 Preset、共享 Editor/Viewer、原生 EditorContent + interactions、显式工具栏和兼容 Hook；固定配置用独立实例或显式重建展示，包含读取与替换，覆盖深浅主题、窄屏、键盘、组合输入、浏览器剪贴板、文本/表格/图片布局和 source replacement 后的 Emoji/历史。若增加导入表单，使用 RHF/Zod/ExUI；临时通知只从页面调用 ExMessage。

生产构建不包含可执行 MarkdownDemo；沿用既有 DEV route/module 条件，新增 fixture 不引入额外业务路由。自动检查、真实浏览器与部署证据分开报告，本期无部署。

## 落地、兼容与回退

一个 RFC 按依赖顺序落地：

1. 先实现 schema、属性与预算校验、canonical normalization、官方转换适配，证明完整预设与 GFM 的隔离。
2. 再加入 paste/guard 和受控 history，验证候选提交、失败无副作用与真正的历史清空。
3. 在既有两套 runtime 之上接入固定 Preset、统一 useTiptapEditor 与 interactions，补充 GFM Slash/placeholder 和公开类型；同一挂载只创建一个 Editor。
4. 让共享 Editor/Viewer 接收 Preset，移除内置工具栏与 toolbar/renderToolbar，policy 移到完整 Preset。保留 ref 和转换结果契约；将现有 DEV 工具栏示例与相关测试迁移为显式组合。
5. useMarkdownEditor 改为兼容适配，保留字段与方法别名，不启用新 Slash/placeholder；迁移动态 emoji 示例与测试，验证单宿主与固定配置。
6. 最后完善 DEV 示例与 browser helper，完成目标回归、根检查和浏览器验收，再补充基于实现证据的持久知识。

实现角色负责模块与测试；评审/验证角色在获得相应任务后独立检查关键边界。这里不指派未参与的个人，也不调用自动化系统或外部协作者。

实施前查找现有共享 Editor/Viewer、toolbar/renderToolbar、policy 与动态 emoji 调用；本次已确认 UI/配置行为变化，须同步迁移受影响的 DEV 示例和测试，不能宣称所有 props 行为完全兼容。没有业务内容格式转换。回退必须连同新增公开出口、组件接线和消费方迁移一起撤销；若共用 Emoji 或正文样式已调整，恢复此前实现并运行两种预设回归。消费方已保存的纯 Markdown 继续属于其业务数据，回退不得删除或重写它。

停止条件：既有完整预设语义回归、任意导出偷偷使用 HTML、普通替换仍能 Undo 回旧文档、损坏文本后仍报告成功、或未通过必要浏览器交互。不得通过降低验收范围绕过这些条件。

## 未决事项与交接状态

没有需要用户再次选择的产品或架构决策，也没有占位项。既有 GFM 转换、门禁和历史源码可复用；双 Preset、统一接线、Slash、placeholder 与表格只读适配仍需按验证矩阵证明。静态源码核对不等于这些运行验收已通过。

源设计及本次双 Preset 补充均已获用户确认。本次更新完成设计到 RFC 的同步；文档自检不等于新增接口已实现、代码测试通过或浏览器验收。本轮不开始实现、不提交、不发布，也不将未实现结论写入 `.ai/`。
