# Tiptap 内容转换边界

共享编辑内容以 Tiptap JSON 保存完整语义；Markdown 是包含受控 HTML 和 Admonition 容器的交换格式。转换失败必须保留调用方原文，不能过滤掉不支持的内容后报告成功。

`useTiptapEditor` 配合 `useMarkdownPreset` 使用独立纯 GFM 预设，面向以 Markdown 交换的轻量正文；完整富文本预设继续使用受控 HTML。两者的转换入口与 schema 分开，不能混用 JSON 或沿用完整预设的属性。

_最后更新：2026-10-19_

## 双 Preset 与统一接入

`useMarkdownPreset` 选择纯 GFM，`useTiptapPreset` 选择完整富文本；两者只生成配置描述，不创建 Editor。`useTiptapEditor` 内部只调用一次官方 `useEditor`，按初始化预设选择既有 runtime，返回原生 `editor`、同级挂载一次的 `interactions`、`issues` 和稳定的 `readJSON` / `exportMarkdown` / `replaceContent` / `focus`。共享 `TiptapEditor` 复用相同接线，`TiptapViewer` 采用所属 viewing 工厂；Editor 与 Viewer 可复用同一描述，但扩展、存储、历史和交互状态各自独立。

Preset options 与完整预设的嵌套 policy 均在初始化复制；更改 options 或传入另一 preset 不更新 schema、策略和交互配置。`placeholder` 支持 string、callback、false，`slash` 与 `emoji` 默认 true；GFM 独有的 `pasteMarkdown` 默认 false，启用后把没有 HTML 的 clipboard 文本作为 Markdown 原子插入，代码块内仍保留字面文本，空 clipboard 不删除原选区。配置变化需要显式卸载重建，先通过所属预设导出并验证正文。`initialContent` 仅初始化读取，Viewer 的 `content` 持续响应更新；editable、ariaLabel、事件和完整预设服务回调继续读取最新值。

共享 Editor 不挂载顶部工具栏，公开组件移除 toolbar/renderToolbar 与直接 policy；完整 policy 放入 `useTiptapPreset({ policy })`。调用方使用原生 Editor 显式组合格式按钮与布局；既有内部官方工具栏不公开 runtime。独立 Viewer 不安装历史、placeholder、Slash 或 Emoji。

`packages/components/src/tiptap/content-session.ts` 集中双预设的整篇替换，`content-adapters.ts` 保留各自解析、验证和序列化规则，`content-gate.ts` 统一门禁、操作回执和诊断归属。GFM 的独立 editing extensions 同样安装该 gate，不依赖 Hook。完整 `lifecycle.ts` 只组合内容会话并保留上传、Mention 与位置映射。

整篇替换先解析并验证候选，再通过 Plugin state.apply 回执确认事务接受。只有接受后的同一事务清空官方 history state、取消 Emoji/Slash 与所属异步 session；等价替换也通知一次并隔离旧历史，拒绝保持正文、选区、历史和目标。成功后光标移到文首，焦点保持原状。`packages/components/src/tiptap/history.ts` 包装公开 UndoRedo PluginSpec，保留原 key/props/commands，仅在替换 meta 上调用原 state.init；closeHistory 不能代替清空历史。初始化错误锁存到成功显式替换，普通编辑不能解除导出阻塞；解除锁存与清空展示在真实接纳阶段完成，原生事件内立即读取或导出也必须看到恢复后的状态。

每个操作在真实 state.apply 中获得独立回执，并随其追加事务更新不可变文档快照；不能只比较 Editor 当前保存的最新操作。原生 Editor 事件同步重入时，后一个操作也不能覆盖前一个操作的接纳结果或快照。返回值与 onChange 参数彼此独立，并与实时文档做深层属性隔离；原生 Node.toJSON 会共享 attrs，不能直接将其结果作为可修改快照交给调用方，普通编辑的 onChange 同样需要隔离。`content-events.ts` 在 dispatch 前预留通知批次，按操作顺序 FIFO 发送，允许回调发起下一次替换，但其通知等待当前批次完成；较旧操作结束时不能清除较新操作的诊断。onChange/onError/onNotice 的异常经浏览器全局错误通道暴露，不能转成内容失败或中断后续通知。

回归位于 `packages/components/src/tiptap/presets.test.tsx`，覆盖固定配置、原生与共享接入、两套历史、初始错误、GFM 命令和图片地址表单。剪贴板、Chromium IME、键盘、深浅主题、窄屏和表格只读仍需在实际消费页面中独立进行浏览器验收。

## 纯 GFM 接入与预设

公开入口位于 `packages/components/src/index.ts`：使用统一 Hook 与 Markdown preset，调用方组合官方 `EditorContent` 并挂载一次 `interactions`。`initialContent` 仅用于初始化，换文档必须显式调用 `replaceContent`，导出使用 `exportMarkdown`。旧 `useMarkdownEditor`、getMarkdown/setMarkdown 兼容接口及类型已移除。独立 `createMarkdownExtensions`、parse/serialize 函数和 Emoji picker 仍可使用。`tiptapContentClassName` 用于 EditorContent 的外层容器；它沿用共享正文 CSS，包含 H1–H6 和行内图片排版，不导入 ExUI 全局样式。直接消费 EditorContent 的应用应登记相同锁定版本的 `@tiptap/react` 依赖。

`packages/components/src/tiptap/markdown/extensions.ts` 的 editing、viewing、conversion 共用受限 schema：H1–H6、基础 Marks、列表/任务、代码、引用、行内 Image 与矩形 GFM Table。Image 只保留 src/alt/title；Link 只保留 href/title；表格首行全表头、每列对齐一致、每格单 paragraph，禁止跨度、列宽和 hardBreak。未知 JSON 字段与属性在官方 parser 读取前拒绝，完整候选事务在接受前检查结构与有限预算；原生导入 API 提前丢掉的字段不属于这层检查的保证，因此初始化和替换应使用公开验证入口。

`parseMarkdownContent` 拒绝 code 以外的原始 HTML token。`serializeMarkdownContent` 先校验、建立独立交换快照、调用官方 MarkdownManager 与扩展公开 render hooks，再用同预设重读并比较语义。交换规范化只处理布局空段/空标题、相邻等价文本、Marks 边缘空白、GFM 自动链接和表格普通边缘空格；Unicode、代码文字、地址、任务状态与列对齐不能默默删除。普通文字行首语法、Tab 和缩进使用可重读转义；代码围栏长度与代码段反引号分别适配。官方 paragraph 会把独立图片提升为块，受限预设覆盖这一入口以保留行内图片；交叉 Marks 通过公开渲染包装拆成嵌套区间，避免官方 HTML reopen。斜体定界符按 GFM 的空白、ASCII 与 Unicode 标点边界选择，真实外层左右上下文必须跨粗体等嵌套包装传递；combining mark 和 Emoji 邻接也不能仅用 Unicode 字母/数字判断。无法纯 GFM 表达的语义返回固定失败，不暴露部分 Markdown。

HTML paste 与外部 HTML drop 在创建 DOM 前经过 parse5 原始 token/AST 预算与白名单构造。parse5 会解码属性中的实体，所有再次输出的属性仍需有限枚举与转义；例如 align 只能为 left/center/right，不能把含引号/标签的属性文字升级为节点。显式 hidden/display:none/visibility:hidden 按整棵祖先剪枝，包含表格行组、行和单元格。剪枝前保留各可见原始行的列掩码；不同列隐藏后即使剩余列数相同，也必须文本降级，不能把 Amount 表头重新配到原 Name 列的 Alice。相同隐藏列可在保留原列关系后缩减表格；整行/行组隐藏可以独立移除，清理后不再矩形的表格走文本降级。危险嵌入整棵移除，未知样式/包装降级；未知块包装需保留支持的段落边界，不能简单拼接裸文字。复杂表格与 caption 按原始 DOM 顺序转为可见文本，嵌套表格也保留行和单元格的换行/Tab，不展开跨度或臆造表头。任务身份由 li 的直接所属列表决定，进入子 ul/ol 时重新判定，不能向所有后代传播任务标志。

浏览器 clipboard 的 fragment 与结构容器格式换行不作为正文；paragraph、inline 与 code 内的实际空白仍保留。text/plain 默认保持字面文本，显式启用 `pasteMarkdown` 时按前述规则解析；文件与 HTML 混合输入整体拒绝。无安全 HTML 且没有纯文本 fallback 时也须拒绝，不能用空 Slice 删除原选区。构造 Slice 时保留 isolating 边界：`Slice.maxOpen(content, false)` 保留单格/仅表头 table，同时允许普通 paragraph 在光标处合并。插入后的完整候选通过门禁才一次性提交为 Undo 事件，超预算不能通过纯文本 fallback 绕过。

emoji 属于初始化配置，后续开关变化不生效；editable 和最新 callbacks 继续更新。StrictMode 按 Editor 身份解绑，初始化错误只通知一次。Emoji session 是本地不透明对象，选择和取消均核对当前 session，迟到面板不能写入或关闭新触发。

回归入口为 `packages/components/src/tiptap/markdown/conversion.test.ts`、`guard.test.ts` 与 `session.test.tsx`。转换依赖浏览器 DOM；不承诺 SSR、服务端校验、外部图片可达性或第三方平台渲染一致性。

## 块插入与 Slash 菜单

统一接入通过官方 Placeholder 在当前选中的空顶层 paragraph 显示提示，默认只说明已开启的 `/`、`$`，完整预设仅在提供 resolveMentions 时说明 `@`。自定义字符串或 callback 结果原样使用，false 关闭 decoration；标题、嵌套段落、只读和独立 Viewer 不显示提示。提示不进入 JSON/Markdown。

GFM Slash 复用同一触发、session、映射与弹层，仅列出正文、H1–H6、列表、引用、代码、分隔线、带表头 3×3 表格与图片 URL，不安装左侧控件、DragHandle 或完整表格 NodeView。图片地址表单使用 RHF/Zod/ExUI，只保留安全 src/alt/title；校验或门禁拒绝时保留正文和目标，迟到提交核对原 session。

块菜单图标统一继承正文颜色，不对提示、信息、警告或危险类型添加语义色；这只改变菜单图标，正文 Admonition 的颜色语义继续保留。Popup 通过 `--tw-shadow` 使用 ExUI large 外阴影，保留玻璃材质组合内描边。`＋` 和拖动手柄共用尺寸、圆角与悬停样式，拖动手柄保留 grab/grabbing 光标；编辑区按普通指针和触摸指针分别保留相应左侧空间。

`packages/components/src/tiptap/InsertBlockMenu.tsx` 使用 ExUI `Popover` 与虚拟锚点显示两列菜单，每项图标在前、名称在后，分类为文字、列表、内容、提示；不提供搜索框、底部操作说明或工具栏插入按钮。方向键按每个分类的实际两列行移动，分类末尾的不足两项行也参与导航；选中项超出弹窗可视区域时只滚动菜单，不移走 Slash 模式的正文焦点。顶层块左侧的 `＋` 与既有 DragHandle 共用定位，列表、引用、Details 和 Admonition 各视为整体，在其下方插入新块。编辑区保留左侧操作空间，避免窄屏手柄落在视口外。

`packages/components/src/tiptap/insert-block.ts` 只在空的顶层 paragraph 中直接输入 `/` 时打开菜单；代码、嵌套段落、组合输入、粘贴、导入和 Undo 不触发。选择成功后替换原 paragraph 并移除 `/`，光标进入新块；Escape、失焦或外部点击只取消菜单，保留 `/`。菜单使用现有 schema，不新增持久属性或节点。

菜单目标保存原块的完整范围和独立 session，逐 StepMap 跟踪位置；之前的块发生编辑时跟随映射，原块被删除、整体替换、文档替换或切换只读时失效。不能只检查最终位置是否仍存在同类型节点，否则一次事务内删除原块再插入新块会把旧命令写入新内容。事务被内容门禁拒绝时保留原文与菜单目标，不将命令返回值当作已插入。

图片菜单先保留目标再打开本地文件选择器；取消不消耗 `/`，文件返回时核对 session 和可编辑状态。选定文件后，`TiptapLifecycle.upload` 接管完整块范围的映射与取消：左侧 `＋` 在原块下方上传；Slash 仅在成功且原 paragraph 内容未变时替换它。上传期间修改 Slash 原段落、删除原块、成功替换文档或卸载，会丢弃迟到结果；上传失败保留原文。没有上传回调时图片项禁用。既有粘贴、drop 和工具栏上传仍沿用原位置插入模式。

实际 Editor 与 ExUI 的回归入口为 `packages/components/src/tiptap/insert-block.test.tsx`，覆盖原位替换、整块后插入、取消、只读、映射、两列键盘导航与图片迟到结果。真实浏览器还须核对左侧命中区、光标锚点、菜单碰撞避让、两列横向条目和键盘行为。

## Emoji 选择与持久化

`packages/components/src/tiptap/emoji-trigger.ts` 只在可编辑正文的直接 `$` 输入时打开选择框；代码区域、粘贴、导入、Undo 和组合输入不会触发。选择时将仍有效的 `$` 替换为 Unicode 文本，不新增 Emoji 节点、外部图片或独立 schema；JSON 与 Markdown 沿用现有文本转换。取消保留 `$`。触发位置随 transaction mapping 更新，删除或替换触发内容、完整文档替换、失焦和只读切换会关闭，迟到的选择不能写入新位置。

`packages/components/src/tiptap/EmojiPickerPanel.tsx` 按需加载 ExUI `EmojiPicker` 与 inline `EmojiPickerPanel`。ExUI 公共 `Popover` 和虚拟 `PopoverAnchor` 负责唯一的 portal、光标定位、碰撞避让及关闭交互；内层不生成第二个 trigger/popup。Popup 外边距为 4px，隐藏搜索框与肤色选择器，保留分类与原生表情列表。

`packages/components/src/tiptap/emoji-data.ts` 只导入 `emojibase-data@17.0.0` 的中文 data/messages，经公开 `normalizeEmojibaseData` 规范化一次并显式传入 `data`，避免默认 CDN 加载。中文 i18n 与数据处于面板的 lazy 边界；固定默认肤色，最近使用采用独立 key `exwebsite.emoji.recent.v1`，不迁移旧 picker 的偏好结构。正文仍只插入 Unicode 文本。

只有 session 仍有效且编辑器仍聚焦时，适配层才将初始焦点交给 ready 的 `role="listbox"`；方向键与确认由原生组件处理。选择或 Escape 后返回编辑器，外部点击不抢回焦点。迟到挂载不会从外部目标夺焦，内容门禁拒绝插入时保留有效面板。

Radix 的可用高度按当前光标与弹出方向计算，不能直接减去固定 rem 后假定仍为正数。面板优先向上弹出并允许碰撞翻转，列表保留原生 sticky 分类标题与一整行表情的高度，极低视口通过公开分类栏变量收紧其布局。外层受可用高度约束并提供滚动兜底，内层仍使用原生虚拟列表；验证须实际滚轮、检查选项命中并点击插入，仅有正高度不足以证明表情可选。

回归入口为 `packages/components/src/tiptap/emoji.test.tsx`；弹层定位、主题与键盘焦点仍需在实际消费页面中独立进行浏览器验收。

Mention 候选也通过 `packages/components/src/tiptap/MentionPopup.tsx` 使用 ExUI `Popover` 与虚拟光标锚点，沿用 4px 外边距；宽度为 12rem，并受视口宽度约束。打开时不移走正文焦点，保留 Suggestion 的方向键、Enter、查询取消与组合输入保护；候选按钮不在鼠标按下时抢走焦点，外部关闭不会把焦点强制拉回编辑器。

Emoji 与 Mention 的 `PopoverContent` 均启用 ExUI 公共 `glass` 属性，共用应用已有的 `GlassSeed`。Emoji 面板通过公开材质变量 `--emoji-picker-surface` 使用 `--exui-glass-background`，玻璃样式及不支持 backdrop-filter 时的回退由 ExUI 负责。

## 同一 schema 与输入门禁

`packages/components/src/tiptap/extensions/index.ts` 按 editing、viewing、conversion 建立独立扩展实例。三种用途具有相同的文档 schema，仅交互不同；不重复登记 StarterKit 已含的扩展，不启用 Collaboration provider。

`packages/components/src/tiptap/conversion/index.ts` 提供显式 JSON/Markdown 转换，内部 HTML 入口供粘贴和 drop 复用。转换是同步浏览器能力，HTML/Markdown 路径需要 DOM；不保证无 DOM 的服务端运行。结果只包含规范化快照、固定诊断和路径，不携带原始异常或用户文档。

JSON 在官方 schema 读取前拒绝未知字段、节点、Marks 和属性，随后进行 ProseMirror 结构校验。只调用官方 JSON 读取器不能发现被忽略的未知属性。

表格使用与其他 Tiptap 包相同版本的官方 `Table`、`TableRow`、`TableHeader`、`TableCell`。`packages/components/src/tiptap/extensions/table.ts` 保留官方解析，调整交换 HTML 与 GFM 保真选择。编辑宿主通过内部 `tableNodeView` 参数提供 `packages/components/src/tiptap/table/node-view.ts`：保留官方 `TableView` 的 contentDOM、列组和布局，在外壳中用 `ReactRenderer` 添加不可编辑的操作层。转换与独立 Viewer 不安装这层 UI；交换 HTML 只保存表格结构和单元格属性，不持久化布局 DOM 或按钮。

ProseMirror 在整篇替换为等价内容时可能复用 NodeView，且不调用其 update；操作前需用实时 getPos、连接中的 DOM 与节点语义相等检查归属，不能要求节点对象引用相同。ReactRenderer 的 props 更新可能晚于 Editor 订阅，因此当前网格和菜单目标核对读取官方 TableView 的实时 node；视图更新通知仍负责触发布局测量。

`packages/components/src/tiptap/conversion/table-validation.ts` 在 HTML 原始 token 阶段拒绝脱离表格的行/单元格、文字段落内的表格，以及会被 HTML parser 丢弃或移出表格的结构。`thead` 只接受完整 `th` 行；不接受 schema 无法保留的 `tfoot`。JSON 导入和编辑事务再检查完整网格，拒绝缺格、重叠与越界跨度。展开后的虚拟网格也受既有节点预算限制，先检查预算再分配，避免少数超大跨度触发无界分配。单元格列宽为有限整数，数组长度必须匹配 colspan；不通过自动修复来宣称导入成功。

HTML 在创建 DOM 前经过 parse5 原始 token 和 AST 校验。事件、未知属性、属性位置、容器结构都需要检查；结束标签上的属性也必须在 parser 修复丢弃它们之前拒绝。通过 AST 门禁后，使用公开 ProseMirror DOMParser 并保留完整正文空白。不能依赖默认 HTML 空白折叠行为，否则连续空格、首尾空格、换行及 Tab 会丢失。

完整预设的图片是 block 节点，不能保留包裹它的行内 Link；原始 token 门禁拒绝嵌套链接及链接内图片，避免 parse5 修复嵌套链接时先丢掉归属证据，AST 门禁再核对任意深度的图片后代。Details Summary 与 Admonition 标题均只接受受支持的行内内容，嵌套包装也不能隐藏块节点；否则 schema parser 会把标题正文移入容器 body。HTML 粘贴与 Markdown 中的受控 HTML 共用此检查，失败保留原正文、选区和历史。

颜色、字号、URL、图片尺寸和 HTML 属性使用有限白名单。栅格 Data URL 默认关闭，显式开启后仍检查 MIME、签名和大小；SVG Data URL、blob URL 和执行性协议不被接受。合法代码块中的 HTML 或容器边界是代码文本，不按可执行 HTML 检查。

## 规范化与预算

空文档规范化为 paragraph，末尾不是 paragraph 时追加空 paragraph。规范化通过 notices 说明，并保持用户原有的其他空段落。相邻等价文本叶和 schema 默认属性可以统一，正文空白、Marks、身份、尺寸、状态和结构不能忽略。

输入及最终规范化文档受 8 MiB UTF-8、10,000 个节点和文本叶、深度 32 的限制。新追加的末尾段落、默认属性及最终 JSON 字节也计入预算；不能让一次成功结果在相同策略下再次导入时越界。具体值及诊断集中在 `packages/components/src/tiptap/conversion/policy.ts`。

## Markdown 保真机制

每个转换器使用隔离的 Marked 实例和公开 facade，不修改模块级 tokenizers/defaults。官方 MarkdownManager 负责解析与序列化，扩展通过公开钩子补齐受支持语义。

带样式的内容以完整受控 HTML 子树表达，避免在 HTML span 内重新解释 Markdown 标记。Mention ID、图片尺寸、Details 状态和任务状态均属于文档语义。外部平台可能剥离这些扩展表达，不能将本站往返能力等同于第三方渲染兼容。

块菜单可以创建空标题。ATX Markdown 不能表达其空的 heading 语义，`extensions/index.ts` 必须使用受控 HTML 保留，不能导出为会被重新读取成正文的 `#`。

Admonition 使用有类型的容器语法和唯一首标题；嵌套围栏长度、代码围栏、标题 Marks 与空标题必须保留。HTML 中重复或后置标题在进入官方解析前拒绝，防止 ProseMirror 自动补建出输入中不存在的嵌套容器。

图片是 block 节点。Markdown 段落或标题中的句中图片需提升为独立块，同时保留前后文字、Marks、标题级别和顺序；拆分后位于段落首尾的 hardBreak、标题边缘空白需要受控 HTML，普通 Markdown 会将其解释为空白而丢失。相关适配位于 `packages/components/src/tiptap/extensions/block-images.ts`。

导出先校验，再重新导入并比较规范化语义；比较失败返回 conversion-failed，不返回残缺文本，也没有隐式有损模式。

完整预设中，普通段落的行首编号、标题、列表等语法必须按字面文字转义，再交给外层列表或容器添加结构标记。纯空白段落及文本内含 LF 空行的段落使用受控 HTML，避免 Markdown 将文字删去或拆为多个段落；此选择不修改实时 JSON，也不放宽最终语义比较。原始 CR/CRLF 若被解析器归一化，仍返回 conversion-failed，不能把 LF 替换视为等价正文。

普通表格使用 GFM：第一行为完整表头，后续行为普通单元格，每格只有一个可保真的段落，各列对齐一致，且没有合并或列宽属性。空单元格与行内格式可保留。单元格 Markdown 图片复用既有 block-image 提升逻辑，保留前后文字。无表头、合并、列宽、多段/复杂内容和需要保留的特殊空白使用受控 `<table>` HTML；官方 GFM serializer 会折叠 Unicode 空白和内部 U+001F 分隔符，这些字符也必须走 HTML。HTML 再导入仍经过同一安全校验和语义比较。

GFM 会将普通 URL 和邮箱文字自动变为 Link mark。未带 Link 的这类文字需要受控 HTML 表达，避免交换时凭空新增链接；inline code 与 codeBlock 继续按字面代码处理。回归位于 `packages/components/src/tiptap/conversion/autolinks.test.ts`。

## React 与异步交互

公开入口位于 `packages/components/src/index.ts`，只暴露组件、转换函数和契约类型。编辑器通过 ref 提供显式替换与快照读取，不公开原生 Editor；`initialContent` 不作为受控值反复覆盖用户编辑。完整替换先校验，再用隔离历史的事务提交；失败不改变文档、选区、历史或异步代际。

`packages/components/src/tiptap/lifecycle.ts` 负责上传与 Mention 的取消和代际。上传位置通过 transaction mapping 跟随文档变化，选择变化不移动上传目标；锚点删除、文档替换、卸载会丢弃迟到结果。插入前校验返回属性和完整候选文档预算。Mention 使用最新查询与 AbortSignal，组合输入期间停止候选查询与提交。

双预设与独立 GFM gate 排队发布事务拒绝诊断时，使用同一机制捕获 Editor 归属、文档 revision 与诊断序号。新正文接纳、更新的显式读取/导出/替换结果、解绑或销毁使旧报告失效；只变更选区仍保留当前拒绝反馈。同一轮未发布的多个拒绝只报告最新一项，不能在新文档已接受后重新覆盖 issues 或调用旧 onError。检查同时用于事务栈外 microtask 与回调重入产生的通知队列；Plugin view 重建保留当前挂载 owner，并使先前队列失效。

React StrictMode 可能创建并丢弃临时 Editor，官方 hook 也可能短暂暴露已销毁的实例。销毁回调必须核对实例归属，不能让临时实例清理活跃协调器；effect 中调用 commands 前检查实例状态。Viewer 不对相同文档重复 setContent，因此主题切换不会重置本地 Details 展开状态。只读任务状态不允许修改，Details 可以独立展开但不回写源 JSON。

Details 的官方 NodeView 自带折叠按钮，标题 `summary` 必须在共享内容样式中关闭原生列表标记，避免标题前多出黑点。箭头通过按钮的 `aria-expanded` 跟随状态；不能在 CSS Module 中直接使用局部 `.is-open`，因为官方添加的是未经过 Module 改名的类名。

Details 的 `ex-glass` 只添加到实时 NodeView，不进入文档属性或导出 HTML。收起时覆盖公开 glass 背景与降级背景为透明，并关闭 backdrop filter；展开时恢复主题材质，通过 `--tw-shadow` 传入 ExUI medium 外阴影，让材质保留自己的内描边与高光。不能直接覆盖 `box-shadow`，否则会丢失 glass 的组合描边。

Mention 在编辑区失焦时取消查询并退出官方 Suggestion；候选更新还需检查编辑区仍有焦点，防止组合输入后的迟到结果覆盖工具栏弹层。文件 drop 仅在配置上传回调时接管。

图片显示使用 `packages/components/src/tiptap/extensions/image-layout.ts` 包装官方 NodeView。适配只改变布局 DOM 和 CSS 变量，不向持久属性或剪贴板 HTML 添加样式；显式宽高按保存比例显示，缺少尺寸时才使用内在比例。窄屏缩放必须同时约束宽高，避免宽度被容器截断后提交错误比例。官方拖柄、更新与销毁仍由原 NodeView 管理。

图片使用 ExUI 圆角 token，不绘制节点选中边框或四角标记；官方缩放拖柄保留透明命中区和方向光标，缩放行为仍有效。样式限定在共享 Tiptap 内容 CSS Module，不移除其他节点的选中提示，也不改变图片持久属性。

Info 提示容器在节点内覆盖既有 `--exui-feedback-info` 为 ExUI 默认 primary 蓝色 `#0088ff`，供侧边框与标题图标复用；不能直接引用 Website 的 primary token，因为该品牌配置将其覆盖为黑白。Tip、Warning、Error 继续使用各自的 ExUI feedback token。

## 官方编辑 UI 与主题

`packages/components/src/tiptap/official/` 按 MIT 公开源码依赖闭包引入官方 UI Components，revision、许可和适配清单集中在该目录的 `README.md`。工具栏按需组合免费官方控件；用户要求文字颜色与高亮合并到一个色板，已移除独立文字颜色按钮并扩展官方 `ColorHighlightPopover`。字号、独立文字背景色、图片 URL 等旧入口已移除，但不删除文档 schema 或已有内容；块插入使用本页“块插入与 Slash 菜单”所述入口。

官方原语复用 ExUI 公共入口，工具栏图标原样保留锁定 revision 的官方 React SVG 源码；用户已明确豁免这部分的 Lucide 规则，文字颜色面板同样复用官方图标。UI 布局与配色限于 CSS Modules 及其 portal 面板，不引入第二套 Radix 或全局 Tiptap token 样式。工具栏由调用方显式组合，背景和定位由调用方控制。

文字颜色入口使用官方公开 registry 的 `TextColorSmallIcon`，该资产的独立来源与检索日期记录在官方目录的 `README.md`。它不是锁定 Git revision 中的图标，也不引入完整的付费文字颜色面板。

文字颜色与高亮的合并色板使用锁定上游配色的实际十六进制预设，定义在 `packages/components/src/tiptap/toolbar/formatting-colors.ts`，切换主题只更新 UI 和预设展示。两组分别提供默认选项与九种颜色，支持独立设置和清除。官方示例的 CSS 变量颜色与延迟高亮命令不能直接用于本站；命令须在仍有效的文档/选区上同步提交。应用颜色后不关闭色板；捕获按钮操作期间防止命令重新聚焦编辑器造成关闭，下一动画帧将焦点返回仍打开的色板按钮。方向键按五列网格移动，Enter/Space 使用按钮原生行为，Tab/Escape 正常离开。

Link 弹层按用户要求恢复锁定上游的单行输入框与三个纯图标动作，原始浅深配色、圆角、间距、阴影限定在专用 CSS Module 内；ExUI 继续提供定位和关闭交互。链接表单保留 RHF/Zod 与共享 URL 策略，使用 `noValidate` 让受支持的站内相对 URL 交由共享策略校验，事务被拒绝时保留输入与固定错误。

`useEditorState` 在 StrictMode 实例切换后的第一次 transaction 前可能保留旧 Editor 快照，官方 UI hook 必须用当前传入实例判断能力，并拒绝已销毁实例。官方链式 `focus()` 会延迟聚焦，可能抢走随后打开的弹层焦点；UI 命令使用同步宿主 focus。菜单按当前真实焦点处理方向键、Home/End，Tab 正常离开工具栏。

每个弹层拥有映射选区 session；关闭、卸载或文档替换后丢弃旧目标。图片按钮只触发本地选择并调用既有上传生命周期，不加入 `imageUpload` 临时节点。旧文件选择器在替换或只读后返回时不能启动上传。相关真实 Editor 回归位于 `packages/components/src/tiptap/official-toolbar.test.tsx`。

Mention 候选仅保留候选项与必要的加载/空结果反馈，不提供“关闭提及”按钮；Escape 和失焦继续取消候选与迟到查询。选中项使用低透明度主题背景与正文前景色，避免主题主色填充与文字同色。

官方标题、列表、引用与代码块示例的节点定位会将跨段 `TextSelection` 缩成首段；本站保留完整文字选区交给原生命令，仅实际 `NodeSelection` 沿用节点目标适配，避免工具栏静默漏改后续选中段落。

## 消费页面与表格交互边界

Website 不提供 Tiptap 开发预览路由、示例数据或依赖预览页的浏览器辅助脚本。共享编辑器与转换能力由消费方显式接入；浏览器验收应针对实际消费页面执行。

表格通过空段的 `/` 菜单或左侧 `+` 插入，默认 3×3 并包含表头。顶部工具栏不提供表格操作；`packages/components/src/tiptap/table/TableControls.tsx` 在表格顶部和左侧放置列/行手柄，底部和右侧 `+` 追加行列，左上角菜单切换表头或删除整表。菜单使用 ExUI Popover，支持方向键、Escape 和触摸。鼠标进入按钮及其周围 .375rem 命中区时只显示对应按钮，不因悬停表格或表内选区显示全部控件；键盘聚焦及菜单打开时保留该按钮可见，触摸设备保持控件可发现。NodeView 通过显式 enabled 属性同步 editable，切为只读时卸载控件并释放 session，不依赖消费方的祖先 Context；原生 EditorContent 同样适用。前文编辑时复用映射选区 session 和动态 getPos；成功替换文档、目标表格被编辑/删除和只读切换会关闭旧菜单。

行列手柄指向逻辑网格索引，`packages/components/src/tiptap/table/commands.ts` 使用 ProseMirror 公开的 indexed table transforms 执行增删。不能把合并单元格扩大的 CellSelection 直接交给 deleteRow/deleteColumn，否则点第二行或列可能连同第一行或列一起删除。最后一行/列的删除项禁用，整表删除仍在角落菜单。表格沿用 ExUI token，窄屏只在内层 wrapper 滚动；列手柄跟随局部滚动，离屏手柄使用 display:none，visibility:hidden 仍会撑大页面滚动范围。转换与编辑回归分别位于 `packages/components/src/tiptap/conversion/tables.test.ts`、`packages/components/src/tiptap/table-editor.test.tsx`。

表格外框通过共享内容样式的 `.tableWrapper` 绘制 ExUI 边框和圆角，编辑与只读沿用同一显示规则。操作弹层使用 ExUI `PopoverContent glass`，复用应用已有的单一 GlassSeed；背景、折射、blur 和降级均由 ExUI 材质负责，不在本地复制玻璃 token 或覆盖其背景与阴影。

包根入口仅做 re-export，但仍可能让未消费的编辑器依赖进入普通页面首屏包。`packages/components/package.json` 的 `sideEffects` 显式保留既有模块、SCSS 和图标资产，将仅重导出的入口与 Tiptap TypeScript 模块交给 tree-shaking；纯构造调用还使用准确的 PURE 注解。新增根 TypeScript 文件、新模块目录或带副作用的初始化时必须重新审计此清单。当前 Vite 8 的 JavaScript filter 与实际 native 构建对复杂 glob 的处理不能视为同一证据，必须核对真实 chunk 模块与旧组件 CSS 是否保留，不能改成全包 `sideEffects: false`。

官方 TaskItem 的实时 NodeView 没有 `data-type="taskItem"`，样式应定位所属 TaskList 下的 li。

Tiptap 的 CodeBlock 和行内 code 使用自托管中英文等宽字体，编辑与阅读共用 `TiptapContent.module.scss`，不修改 ExUI 的全局 mono token 或正文、工具栏字体。字体来源、许可和按 Unicode 范围加载的资源复现规则集中在 `packages/components/src/tiptap/fonts/maple-mono-cn/README.md`。字体选择仅影响显示，不进入文档 JSON、Markdown 或转换门禁。

## 核对与回归

真实转换、节点命令及安全回归位于 `packages/components/src/tiptap/conversion/foundation.test.ts` 和 `packages/components/src/tiptap/conversion/security.test.ts`。它们覆盖官方 parser、schema、只读 NodeView 及组合内容，不用编辑器整体 mock 替代实际行为。

运行 `pnpm exec vitest run packages/components/src/tiptap/conversion` 验证转换边界。DOM 测试不能证明工具栏布局、拖柄、缩放或主题可读性；这些需要独立的真实浏览器证据。仓库完整验证边界见 `.ai/architectures/contract-tests/test-layers.md`。

编辑器实际生命周期与组件回归位于 `packages/components/src/tiptap/lifecycle.test.ts`、`packages/components/src/tiptap/components.test.tsx`。
