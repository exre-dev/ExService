# Tiptap 双 Preset 与 Markdown 编辑接入设计

创建：2026-10-14。更新：2026-10-15。模块：`tiptap-markdown`。状态：用户已确认双 Preset、固定配置、共享组件与原生 EditorContent 接入方案；本次修订只更新设计与 RFC，不代表新增接口已经实现或验收。

## 决策与目标

提供 `useMarkdownPreset(options)` 与 `useTiptapPreset(options)`，分别选择纯 GFM 与完整富文本能力。Preset 只保存固定配置和对应能力，不创建 Editor。`useTiptapEditor({ preset, ... })` 内部调用官方 useEditor，返回原生 Editor、交互 ReactNode、诊断和统一内容操作；共享 `TiptapEditor` 自动完成同样的接线，`TiptapViewer` 使用相应查看预设。调用方管理布局、工具栏、表单和提交。

底层保留独立 `createMarkdownExtensions` 工厂，供自行管理 Editor 的调用方以及查看、转换场景使用。Markdown 与现有完整富文本编辑器分别定义 schema，在各自预设内保证编辑、查看、转换的 schema 一致。

已确认的产品选择：

- 内容采用 GFM 纯语法，禁止以嵌入 HTML 保存额外语义。
- HTML 粘贴保留文字与可表达的格式，移除不能表达的样式。
- Emoji 沿用直接输入 `$` 打开选择器的交互，插入 Unicode 文本。
- React Hook 是主要入口，插件工厂是底层公开能力。
- 两个 Preset 均支持 placeholder 覆盖；Markdown 的 slash、emoji 默认开启并分别支持关闭。
- 所有 Preset 配置只在初始化读取；不支持动态更新、节点删减、任意扩展注入或运行时切换预设。
- 所有编辑器均不自带顶部工具栏，调用方按需组装；Markdown 不添加左侧 `＋` 或拖动手柄。
- 保留 `useMarkdownEditor` 的已有入口与 getMarkdown/setMarkdown 名称；统一新入口的内容操作为 readJSON/exportMarkdown/replaceContent。
- 本模块不包含 Issue 业务页面、提交 API、图片上传服务或新整套工具栏。

模块根目录为 `.notes/tiptap-markdown/`。实施契约同步维护于 `.notes/tiptap-markdown/rfcs/markdown-editor-hook-rfc.md`。本次流程到设计与 RFC 更新结束，不开始实现、不创建 Commit，也不将未实现结论写入 `.ai/`。

## 当前实现证据

| 来源                                                                              | 已核对行为与设计影响                                                                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/components/src/tiptap/extensions/index.ts`                              | 内部完整插件工厂按 editing、viewing、conversion 建立实例，包含样式、Details、Mention、Admonition 等；不能直接作为纯 Markdown 预设。                                 |
| `packages/components/src/tiptap/conversion/index.ts`                              | 官方 MarkdownManager 与隔离 Marked 负责转换，现有导出通过受控 HTML 保持完整 JSON 语义；新预设需要独立转换策略。                                                     |
| `packages/components/src/tiptap/conversion/validate.ts`                           | 在官方 schema 读取前验证未知字段、节点和属性；现有部分规则绑定完整预设，例如 H1–H4 与 textAlign，不能不加修改直接套用。                                             |
| `packages/components/src/tiptap/lifecycle.ts`                                     | 已有事务门禁、粘贴接入、替换和异步协调器，但绑定完整预设与上传、Mention；新 Hook 不整体复用这套业务组合。                                                           |
| `packages/components/src/tiptap/emoji-trigger.ts`、`EmojiPickerPanel.tsx`         | 触发位置随事务映射，选择插入 Unicode 文本；选择器使用 ExUI Popover 与现有 emoji-picker-react。                                                                      |
| `packages/components/src/tiptap/TiptapEditor.tsx`、`components.test.tsx`          | 已有 useEditor、独立初始化、显式替换和 StrictMode 归属保护，是生命周期设计参考。                                                                                    |
| `packages/components/package.json`、`packages/components/src/index.ts`            | 包使用源码入口；Tiptap 相关依赖锁定为 3.32.0；当前已公开 createMarkdownExtensions、useMarkdownEditor、MarkdownEmojiPicker 和正文样式类，尚无双 Preset 与统一 Hook。 |
| `packages/components/src/tiptap/markdown/useMarkdownEditor.ts`、`types.ts`        | 当前独立 Hook 已管理原生 Editor、GFM runtime 和 Emoji；尚无 slash、placeholder 配置。现有 emoji 动态更新行为需按本次固定配置决定调整。                              |
| `packages/components/src/tiptap/types.ts`、`TiptapEditor.tsx`、`TiptapViewer.tsx` | 当前共享组件固定使用完整预设，Editor 默认挂载工具栏；新增 preset 接入与去除内置工具栏都是本次明确的行为变更。                                                       |
| `.ai/knowledge/components/tiptap-content-boundaries.md`                           | 已记录完整预设的转换、预算、浏览器和异步边界；新设计不能改变其现有语义。                                                                                            |
| `vitest.config.ts`、`scripts/runtime/tests.mjs`                                   | 共享组件测试属于 Website Vitest 范围；根测试还包含其他模块和 Outline。当前不存在根 `TESTING.md`。                                                                   |

官方 [React 接入文档](https://tiptap.dev/docs/editor/getting-started/install/react)展示 `useEditor` 与 `EditorContent` 的组合。官方 [Markdown 文档](https://tiptap.dev/docs/editor/markdown)说明双向转换允许 HTML，并限制表格单元格内容。纯语法范围以 [GFM 规范](https://github.github.com/gfm/)为依据；本预设主动排除该规范中的原始 HTML，不宣称完整复制 GitHub 产品功能。

## 架构与责任

| 层                   | 责任                                                                         | 依赖与边界                                                                                   |
| -------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 插件预设             | GFM 节点、Marks、编辑辅助及内容限制。                                        | 使用官方 Tiptap 扩展；每次工厂调用返回新实例，不引入 React 状态或业务 API。                  |
| 校验与转换           | 验证输入、转换纯 Markdown、规范化和比较语义。                                | 复用安全 URL、预算和隔离 parser 等基础能力；不调用完整预设的 HTML 回退。                     |
| 粘贴适配             | 将 HTML clipboard 降级为受限内容，再一次性插入。                             | 清理与降级属于显式输入规则，不作为 JSON 导入或导出的隐式有损模式。                           |
| Preset Hook          | 返回固定的预设描述，不创建 Editor。                                          | 初始化快照保持稳定；不缓存任何 Editor 的可变扩展或交互状态。                                 |
| 统一 Editor Hook     | 创建和销毁 Editor、读取最新回调、公开统一内容方法，返回 interactions。       | 内部调用 useEditor；按 preset.kind 静态选择既有两套 runtime，不为包装层再创建第二个 Editor。 |
| 共享 Editor / Viewer | Editor 挂载正文、交互和诊断；Viewer 挂载对应 schema 的只读正文。             | 不自动挂载工具栏；Viewer 不安装编辑交互、历史或 placeholder。                                |
| Emoji 组件           | 呈现受控选择器与焦点交互。                                                   | 使用现有 ExUI 和 Emoji 资源，按需加载；不向文档增加 Emoji 节点。                             |
| 调用方               | 选择共享组件，或挂载 EditorContent 与 interactions，组装工具栏、表单与提交。 | 初始内容与整篇替换走验证入口；Editor 用于显示和格式命令。                                    |

GFM 核心继续放在 `packages/components/src/tiptap/markdown/`；双 Preset 和统一 Hook 放在 `packages/components/src/tiptap/`。保留独立转换与 runtime，提炼必要的 React 接线和 Emoji/Slash 展示能力；完整预设的转换规则不变，工具栏改为消费方显式组装。公开名称从 `packages/components/src/index.ts` 导出，继续使用 `@workspace/components`。

实现只提炼有实际复用需求的安全原语，不引入任意插件注册表、通用多格式框架或运行时 schema 切换。保持现有 React、ExUI 单实例与 CSS Modules 约定，不增加第二套浮层库。

## 内容范围

| 内容     | 规则                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基础结构 | Document、Text、Paragraph、H1–H6、Blockquote、HorizontalRule、HardBreak。                                                                                                    |
| 行内格式 | Bold、Italic、Strike、Code、Link；无 Underline、Highlight、TextStyle、字体、字号、颜色、背景色或段落对齐。                                                                   |
| 列表     | 无序列表、有序列表和嵌套列表，支持任务列表与勾选状态。                                                                                                                       |
| 代码     | 行内代码、围栏代码块及可选语言；保留代码文本，包括 HTML 字面量、换行和 Emoji。                                                                                               |
| 图片     | 使用行内图片以表达 Markdown 段落、列表和表格内的图片；只持久化 src、alt、title，不保留尺寸、缩放属性或布局 NodeView。                                                        |
| 表格     | 矩形表格，首行全为表头，其余为普通单元格；每格一个段落，允许可表达的行内内容。允许 GFM 列级 left、center、right 对齐，各列的单元格对齐一致。无跨度、列宽、嵌套块或多段内容。 |
| 自动链接 | 按 GFM 规则解析和规范化 URL、邮箱；安全协议策略可能拒绝不安全或本预设不支持的地址。                                                                                          |
| Emoji    | 普通 Unicode 文本，保留变体选择符、肤色修饰符和 ZWJ 序列；不支持自定义图片 Emoji、shortcode 转换或 Mention 身份。                                                            |

不登记 Details、Mention、Admonition、Collaboration、DragHandle、完整 Slash 菜单或完整表格控制 NodeView。Markdown 的 Slash 仅提供本预设可表达的命令，不继承完整富文本菜单。编辑辅助保留必要历史、光标与末尾可编辑段落；这些辅助 DOM 和状态不写入 Markdown。

图片地址沿用现有安全 URL 规则中的 HTTP、HTTPS 和站内根相对路径；默认不允许 data、blob、SVG data 或执行性协议。Link 同时允许合规 mailto。本期不开放 Data URL 模式，不增加上传回调。

GFM 插件集必须明确禁用 StarterKit 已包含的非目标扩展，例如 Underline，不能重复登记 Kit 已有节点。限制必须体现在 schema、属性检查和事务门禁中，不能只靠调用方隐藏按钮。

## Preset 配置与生命周期

`useMarkdownPreset(options)` 与 `useTiptapPreset(options)` 返回稳定的 TiptapPreset 描述。每次 Hook 挂载只读取一次配置；后续传入不同对象、改变配置字段或传入另一个 Preset 都不更新已有 Editor/Viewer。需要改变配置时由调用方显式卸载重建，旧正文若需保留必须先通过所属预设导出，再通过新预设验证导入；不进行隐式跨预设转换。

| 配置                                      | 规则                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder?: string / callback / false` | 两个 Preset 均支持。字符串覆盖默认文案；callback 接收 editor、node、pos、hasAnchor 并返回文字；false 关闭 decoration。默认与覆盖均只用于可编辑的空顶层 paragraph，不进入 JSON/Markdown/Viewer。精确联合类型见 RFC。 |
| `slash?: boolean`                         | 两个 Preset 缺省 true；Markdown 仅显示 GFM 支持的命令，false 不安装触发和菜单。                                                                                                                                     |
| `emoji?: boolean`                         | 两个 Preset 缺省 true；false 不安装 `$` 触发和选择器，普通 Unicode Emoji 输入与粘贴仍然有效。                                                                                                                       |
| `policy?: TiptapContentPolicy`            | 仅完整 Preset 可配置，保留现有内容策略；Markdown 不开放 Data URL 模式。                                                                                                                                             |

默认 placeholder 为通用输入提示，按已开启的命令追加 `/`、`$` 提示；完整预设仅在调用方提供 resolveMentions 时提示 `@`。自定义文案或回调结果直接使用，不额外拼接命令说明。回调固定初始化时的函数引用，不承诺冻结外部可变闭包，不增加动态 decoration 更新协议。

Preset 不持有可变插件数组。两个 Editor 或 Editor 与 Viewer 可以复用同一个描述，但各自调用既有用途工厂创建全新扩展、存储、runtime 和 session。只用 kind 选择两套已知能力，不增加插件注册表、可扩展 profile 或通用多格式框架。

## 统一 Hook 与共享组件契约

`useTiptapEditor(options)` 的 options：

| 字段                                      | 语义                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `preset: TiptapPreset`                    | 初始化读取一次，决定 schema、转换、内容门禁和交互。                                            |
| `initialContent?: TiptapInput`            | 缺省安全空文档；只在初始化读取一次，JSON 与 Markdown 均按所属预设验证。                        |
| `ariaLabel: string`、`editable?: boolean` | 正文语义与交互状态，editable 缺省 true。它们是运行状态，不属于 Preset 配置，保留既有更新行为。 |
| `onChange?`、`onError?`、`onNotice?`      | 读取最新回调。正文变化通知已接受的 JSON 快照，不因选区变化或普通重渲染触发。                   |
| `uploadImage?`、`resolveMentions?`        | 保留完整预设既有回调接线；不为 Markdown 开放上传、Mention 或业务 API。                         |

Hook 返回：

| 字段                    | 语义                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `editor`                | 原生 Editor 或 null，用于 EditorContent、选区与格式命令。                                                         |
| `interactions`          | ReactNode；挂载一次，承载该实例的 Slash、Emoji 及完整预设已有的上下文交互，不包含顶部工具栏。无可显示交互时为空。 |
| `issues`                | 当前固定错误诊断，供自行布局的调用方呈现。                                                                        |
| `readJSON()`            | 验证并返回所属 schema 下的 JSON 快照。                                                                            |
| `exportMarkdown()`      | 返回 TiptapResult<string>；Markdown 预设导出纯 GFM，完整预设保留既有受控 HTML 转换规则。                          |
| `replaceContent(input)` | 返回 TiptapResult<JSONContent>；显式验证并原子替换整篇正文。                                                      |
| `focus()`               | 聚焦仍有效的 Editor；与既有 handle 保持一致。                                                                     |

readJSON/exportMarkdown/replaceContent 函数引用保持稳定，未准备或已卸载时返回 not-ready；focus 无有效实例时不操作。initialContent 导入失败使用安全空文档承载错误，不修改调用方原文；锁存初始错误并阻止导出误交空文档，必须通过成功 replaceContent 显式恢复。初始化不调用 onChange，错误在已挂载的 effect 阶段通知。

replaceContent 先在独立上下文完成所属预设的解析、校验与预算检查。成功时选择归到正文起点、关闭旧交互 session、隔离此前撤销历史并通知 onChange 一次，不抢夺正文外的焦点；即使内容相等也执行上述替换语义。失败保留正文、选区、历史与交互，不通知 onChange；最终事务门禁拒绝时同样返回失败，不能只看原生命令布尔值。

TiptapEditor 增加 preset 参数并复用统一 Hook；挂载正文样式、interactions 与诊断，ref 继续暴露 TiptapEditorHandle。省略 preset 时采用默认完整预设，便于既有内容调用迁移。TiptapViewer 同样接收 preset，使用对应 viewing-purpose 工厂和转换；保留 content 更新行为，不装 placeholder、历史、Slash、Emoji 或可修改正文的控制器。

所有 Editor 移除内置顶部工具栏与 toolbar/renderToolbar 接线。需要工具栏的调用方使用统一 Hook 返回的原生 editor 和官方格式按钮自行组合；既有工具栏模块可在显式组合中保留，不通过公开 runtime 或恢复默认挂载维持旧 UI。既有共享组件的 policy 配置迁入完整 Preset，避免两处配置优先级。

以下示例展示拟实现 API：

```tsx
import { EditorContent } from '@tiptap/react'
import {
  TiptapEditor,
  TiptapViewer,
  tiptapContentClassName,
  useMarkdownPreset,
  useTiptapPreset,
  useTiptapEditor,
} from '@workspace/components'

function QuickEditor() {
  const preset = useMarkdownPreset({ placeholder: '请输入正文', slash: true, emoji: true })
  return (
    <TiptapEditor
      preset={preset}
      initialContent={{ format: 'markdown', content: '# Hello' }}
      ariaLabel="正文"
    />
  )
}

function CustomEditor() {
  const preset = useTiptapPreset({ placeholder: '开始编辑' })
  const { editor, interactions, issues } = useTiptapEditor({ preset, ariaLabel: '正文' })
  return (
    <div>
      <button
        type="button"
        disabled={!editor}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        加粗
      </button>
      <div className={tiptapContentClassName}>
        <EditorContent editor={editor} />
      </div>
      {interactions}
      {issues.length > 0 && (
        <div role="alert">
          {issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function MarkdownPreview({ source }: { source: string }) {
  const preset = useMarkdownPreset()
  return (
    <TiptapViewer
      preset={preset}
      content={{ format: 'markdown', content: source }}
      ariaLabel="正文预览"
    />
  )
}
```

自行组合时必须挂载一次 interactions 才能呈现已启用的命令 UI；不额外创建 Editor 或重复挂载 MarkdownEmojiPicker。交互宿主与 EditorContent 是同级布局，不能作为子节点写进正文 DOM。需要原生只读组合时，可用同一 Hook 的 editable=false 挂载 EditorContent；独立 Viewer 使用专门 viewing 工厂，不把两者的插件安装范围混为一谈。

### 已有 useMarkdownEditor 兼容

保留 initialMarkdown、ariaLabel、editable、emoji、事件回调与现有返回字段。getMarkdown 转发 exportMarkdown，setMarkdown(source) 转发 replaceContent({ format: 'markdown', content: source })；保留 emojiPickerProps 与 MarkdownEmojiPicker 的现有挂载方式，兼容路径不再同时自动渲染另一份 Emoji 宿主。

兼容适配器使用同一统一 Hook 与 Markdown runtime，不创建第二个 Editor；保持旧路径不启用 Slash、不显示 placeholder。emoji 的配置改为初始化读取，后续改变该值不生效，这是本次固定配置决定带来的明确行为变化；已有切换演示与测试需迁移为重建实例。editable 与最新 callbacks 的更新保持不变。

## 底层接口与转换

- `createMarkdownExtensions({ purpose, onError?, onNotice? })`：purpose 为 editing、viewing、conversion；每次调用返回独立扩展与可变存储。editing 包含粘贴与内容门禁，viewing 无编辑历史和可修改任务控件，conversion 不装 UI NodeView。Emoji 的 React 状态由 Hook 另行接线，不强制加入底层工厂。
- `parseMarkdownContent(input: TiptapInput)`：显式接收标注为 markdown 或 json 的内容，返回受限预设下规范化的 JSON。Markdown 原始 HTML token、未知 JSON 字段、节点、Marks 和属性返回失败，不能让官方解析器先静默丢弃。
- `serializeMarkdownContent(content: JSONContent)`：校验受限文档并输出纯 GFM，返回规范化 notices。使用独立 Marked 与官方 MarkdownManager，导出后以同一预设重新解析并比较规范化语义。
- `MarkdownEmojiPicker`：Hook 的可选呈现组件，保持现有 ExUI 弹层、原生 Emoji、主题、按需加载和键盘行为。

公开结果复用 TiptapResult 的 success/value/notices 与 failure/issues 结构；规范化说明使用明确固定文案。新诊断需要时按最小范围补充共享类型，不能改变完整预设已有 code 的含义。

Editor 的内部 JSON 是当前可编辑表示；外部输入与提交以 Markdown 为主。允许规范化 Markdown 的围栏、缩进、引用与转义写法，合并相邻等价文本叶；不要求保留原始 Markdown 字节。

纯 Markdown 无法保存多余空段落和空标题：导出时移除用于布局的空段落，将空标题按空段落处理，并返回 notices；不在用户编辑时反复修改这些临时结构。空文档导出为空字符串。Marks 边缘的语法空白按 Markdown 可表达形式规范化，保留正文字符；GFM 自动链接按相同规则规范化，避免使用 HTML 阻止链接生成。表格单元格首尾空白按 GFM 规则规范化并返回说明；其他无法保留的内部空白或内容返回 conversion-failed，不扩大有损规则。

代码文本、链接及图片的地址与说明、列表顺序、任务状态、表格逻辑内容和 Emoji 必须在规范化比较中保留。输出中的 HTML 字面文本需要转义；代码内 HTML 继续是代码。正常编辑使用结构与预算门禁，不在每次击键运行完整往返序列化。无法纯 GFM 表达且未属于约定规范化的内容导出失败，不返回残缺 Markdown。

所有输入与最终结果沿用现有 8 MiB UTF-8、10,000 节点及文本叶、深度 32 的预算。HTML 降级前后都受预算约束，避免使用少数跨度极大的表格属性展开巨量网格。JSON 输入的未知属性在官方 schema 构造前拒绝；原生 Editor 导入 API 不作为公开验证入口。

## 粘贴与 drop

HTML 粘贴与明确外部 HTML drop 使用专属清理和降级流程；编辑器内部移动沿用原生行为，并通过最终事务门禁。普通 text/plain 粘贴保持文字语义，不根据正文猜测为整篇 Markdown；Markdown 导入使用 replaceContent，兼容路径可用 setMarkdown。

| 输入                               | 降级规则                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 支持的文字格式和结构               | 保留粗体、斜体、删除线、链接、标题、列表、代码、引用和简单表格。                                                                                           |
| 颜色、字号、下划线、样式 span      | 去掉格式包装，按原文顺序保留正文。                                                                                                                         |
| Details 和提示容器等不支持的包装   | 提取可见标题与正文，按原有顺序转成支持的块。                                                                                                               |
| 普通图片                           | 仅保留合规 src、alt、title，移除尺寸和其他属性；无合规地址时保留非空 alt 作为文本。                                                                        |
| 不兼容表格                         | 每个原始行转为独立段落，原始单元格按 DOM 顺序以 Tab 分隔；单元格内块边界转换为文本换行。不展开合并跨度，不复制文字，不臆造表头；嵌套表格递归提取原有文字。 |
| 危险属性与地址                     | 不执行事件，不保留事件属性；危险链接解除包装并保留文字。                                                                                                   |
| script、style 和可执行或资源性嵌入 | 丢弃这类节点及其内容，不将脚本源码或样式作为正文。                                                                                                         |
| clipboard 文件或外部文件 drop      | 本期无上传能力，不隐式插入 blob 或 data URL；通过固定诊断交还调用方处理。                                                                                  |

表格文本降级时，普通单元格的段内可见文字、Emoji 和顺序保留，但其富文本 Marks 不保留；该行为发送降级 notice。无法安全处理 HTML 且存在 text/plain 时回退纯文本并通知；无纯文本或输入超过预算时拒绝并保持原选区及正文。

原始 HTML 先经过预算受限的 token/AST 清理；清理执行性节点、危险属性与地址后，才交给 DOM 和 schema 解析，不将未清理输入挂入页面。所有降级先建立独立候选 Slice，再检查完整候选文档并一次性提交。成功粘贴为一个撤销操作；拒绝不产生半份正文。降级通知与错误由调用方呈现，不向全站通知容器重复发送消息。

## Markdown Slash 菜单

slash=true 时，只在可编辑的空顶层 paragraph 直接输入 `/` 打开菜单；粘贴、导入、Undo、代码、嵌套段落与中文组合输入不触发。菜单提供正文、H1–H6、无序/有序/任务列表、引用、代码、分隔线、带表头的简单矩形表格及图片 URL 输入。图片不上传，只保留验证通过的 src/alt/title，并按行内图片 schema 插入。

复用既有虚拟锚点、ExUI 弹层、键盘导航、session 和位置映射规则，只分离命令集合与节点构造；不直接将完整预设 JSON 塞进 GFM schema。图片 URL 输入使用已有表单约定；取消保留 `/`，错误或门禁拒绝保留正文和目标。成功后替换触发段落并进入可编辑位置，作为一次撤销操作。文档替换、只读切换、原块删除和卸载使 session 失效，迟到提交不得作用于新目标。

## Emoji 交互

直接在可编辑正文输入 `$` 才触发；粘贴、导入、Undo、代码区域、中文组合输入和只读状态不触发。选择器使用现有原生 Emoji 网格和 ExUI Popover，保持无搜索、无肤色栏的既有布局。

选择替换仍有效的 `$`，并将焦点返回编辑器；Escape 取消但保留 `$`，外部点击关闭不抢回焦点。锚点跟随事务映射，删除触发字符、完整替换、切换只读或卸载后失效；emoji=false 的实例从初始化起不创建选择器。整篇替换使用独立 session 代际，迟到的选择不能写入新文档；选择器尚未加载时的失焦同样取消。

Emoji 状态与本文的事务门禁共用同一个 Editor。插入被预算或结构检查拒绝时保留触发内容，不能把命令执行视为插入成功。新 Hook 和既有完整编辑器复用该交互，并保持各自独立 session。

## 错误、限制与风险

- 新 Hook 的 initialContent 与兼容 Hook 的 initialMarkdown 都是非受控初始化值；外部换文档使用 replaceContent/setMarkdown，不以 onChange 回传覆盖正文。
- 返回原生 Editor 便于自定义 UI；验证保证覆盖 Hook 和转换函数及接受后的事务，不能声称原生 API 在解析前丢弃的输入字段也被门禁发现。
- Tiptap Markdown 是 beta 能力，采用仓库锁定版本及针对边界的行为测试，不引入升级或第三方 Markdown 实现。
- 工厂高级调用方可以组合不改变内容语义的辅助扩展；添加新的节点、Marks 或持久属性会超出本预设契约，本期不提供任意 schema 插件接口。
- 本期浏览器能力需要 DOM；服务端 Markdown 校验、SSR、跨平台图片 URL 可达性与第三方渲染差异均不属于验收承诺。
- API 与数据库无需修改，不涉及 Outline、不启动运行资源、不部署。现有工作区的其他编辑不属于本设计。

## 验证与验收

自动测试使用真实 Editor、官方扩展及需要 DOM 的 jsdom；不只断言插件数组或 mock 方法调用。

1. 工厂多实例隔离、扩展无重名，以及同一预设三种用途的 schema 一致。
2. 两种 Preset 分别转换；完整预设的受控 HTML 与内容语义保持不变，原来依赖自动工具栏的测试改成显式组装。
3. H1–H6、嵌套列表、任务状态、代码围栏、行内图片、GFM 表格、自动链接、Emoji 的往返语义；覆盖空文档、空标题、空段落、特殊空白和转义。
4. Markdown 的原始 HTML 与 JSON 未知字段、Marks、属性拒绝；图片尺寸、合并表格、多段单元格等不兼容事务不进入正文。
5. HTML 粘贴保留支持格式、去除样式、复杂表格转文本、危险属性和地址清理、code 中 HTML 字面量以及输入与输出预算。
6. Hook StrictMode、多个输入框、最新回调、普通重渲染、动态只读、初始化错误阻止提交、失败替换无副作用、成功替换隔离历史。
7. Emoji 位置映射、迟到选择、失焦取消、组合输入、代码排除、Escape、只读及预算拒绝；固定开关分别在新实例验证，覆盖完整预设回归。
8. 两种 Preset 的固定配置与三种用途隔离；更改 options 或传入另一 preset 不重建、不覆盖正文、选区或历史；显式重建才应用新配置。
9. Markdown Slash 的允许项、H1–H6、图片 URL、简单表格、取消与映射；菜单命令经过最终内容门禁，无左侧控制器和自动工具栏。
10. placeholder 字符串、callback、false、默认命令文案与 Viewer 缺席；统一 Hook 与共享组件行为一致，同一个 Preset 可复用但交互状态隔离。
11. useMarkdownEditor 的返回字段、错误与替换保证兼容；明确验证 emoji 改为固定配置，避免继续宣传动态支持。

实现阶段先运行 `pnpm exec vitest run packages/components/src/tiptap` 与共享组件 typecheck，再运行 `pnpm typecheck`、`pnpm test`、`pnpm build`。根命令可能生成 Contract 产物或依赖运行条件，须报告实际结果和任何阻塞，不能使用开发数据库替代隔离测试。

真实浏览器验收使用临时开发预览组合两种 Preset、共享 Editor/Viewer、原生 EditorContent、interactions 与显式工具栏，验证光标、粘贴、撤销、主题、窄屏、Tab 与 Escape、中文输入和两个实例的隔离。预览用于验证共享 API，不实现 Issue 业务。自动检查、真实浏览器和部署证据分别报告，本期无部署。

本次修订只进行文档自检，不运行代码测试或声称上述验收通过。已确认的类型、模块接线、兼容行为与验证用例同步到现有 RFC；不据此开始实现。
