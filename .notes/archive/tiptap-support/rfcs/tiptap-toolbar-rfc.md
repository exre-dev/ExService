# RFC：Tiptap 工具栏组件与宽度适配

状态：已取代。日期：2026-10-14。模块：`tiptap-support`。当前实施依据为 `.notes/tiptap-support/specs/2026-10-14-official-ui-design.md`；本 RFC 保留旧自研方案背景，不再作为当前工具栏契约。

来源设计：`.notes/tiptap-support/specs/2026-10-14-tiptap-toolbar-design.md`，用户已于 2026-10-14 确认。此 RFC 细化实现契约，尚未实施；不修改或替换来源设计。

## 问题与决策

现有共享工具栏使用原生段落选择器，并将字号、文字颜色、文字背景、高亮与清除操作合并为长菜单。颜色以编号呈现，布局只做 flex 换行，难以识别当前格式和访问窄容器中的完整工具。

使用 ExUI 公共控件、Lucide 和 CSS Modules 重建工具栏，沿用旧 ex-hub 的紧凑分组、图标菜单和圆形色块交互。根容器及分组透明，业务通过 `renderToolbar` 包装背景与定位。使用真实容器测量和固定收纳优先级提供“更多”面板；保持当前文档 schema 与所有命令。

不引入 Ant Design、react-contexify、官方 Tiptap UI 源码或付费组件，不修改 HTTP Contract、数据库、依赖锁文件或 Outline。引用、代码块、列表、Details、Admonition、链接、图片与现有文本样式继续使用当前扩展和门禁。

## 已核对的实现基础

| 位置                                                       | 当前事实及设计影响                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/components/src/tiptap/types.ts`                  | `toolbar?: boolean` 控制挂载，ref 只提供 JSON、Markdown、显式替换与 focus；保持这一公开边界。                              |
| `packages/components/src/tiptap/TiptapEditor.tsx`          | 每个编辑器拥有生命周期实例，`shouldRerenderOnTransaction: false`；工具栏独立订阅 Editor 状态。只读模式取消上传和 Mention。 |
| `packages/components/src/tiptap/toolbar/TiptapToolbar.tsx` | 现有链接、图片表单使用 RHF/Zod；`applyDocumentCommand` 以实际 transaction 事件区分提交成功与过滤器拒绝，重构需保留。       |
| `packages/components/src/tiptap/lifecycle.ts`              | filterTransaction 校验完整候选文档；显式 replace 在 dispatch 前更新私有 generation；上传锚点随 transaction mapping 移动。  |
| `packages/components/src/tiptap/conversion/policy.ts`      | 字号规范化为 0.75–3rem，颜色以规范化十六进制表示；持久内容不接受 CSS 变量。                                                |
| `packages/components/src/tiptap/components.test.tsx`       | 组件回归使用真实 Editor 与扩展，覆写组件不采用整体 Editor mock。                                                           |
| `tests/browser/tiptap-preview.mjs`                         | 真实浏览器辅助断言，由调用方提供已运行服务与 Playwright Page；测试不自行启动业务服务。                                     |
| `packages/components/package.json`                         | 已锁定 ExUI 0.8.0、Tiptap 3.32.0，并以 sideEffects 清单控制 tree-shaking；新模块保留在既有 tiptap 目录。                   |

规范依据：`AGENTS.md`、`.ai/rules/frontend-forms.md`、`.ai/rules/frontend-notifications.md`、`.ai/knowledge/web/exui-integration-traps.md`、`.ai/knowledge/components/tiptap-content-boundaries.md`、`.ai/architectures/contract-tests/test-layers.md` 与 `CONTRIBUTING.md`。

## 公开契约与业务包装

在 `TiptapEditorProps` 添加以下可选属性，原有属性及 ref 不变：

```ts
import type { ReactNode } from 'react'

renderToolbar?: (toolbar: ReactNode) => ReactNode
```

调用规则：Editor 实例存在且未销毁、`toolbar !== false` 且 `editable !== false` 时创建完整工具栏节点；有回调则渲染回调返回值，无回调则直接渲染该节点。其他状态不创建工具栏、不调用包装回调。运行时只读切换需同步卸载所有工具栏 portal。

回调是同步、无副作用的 React render callback，不承诺调用次数；业务必须保留并仅渲染一次传入节点。它不接收 Editor、runtime 或 commands。故意返回 null 的调用方承担不显示工具栏的行为；组件不自行重新生成默认工具栏。调用方需保持包装组件类型与 key 稳定，避免反复卸载工具栏。

业务使用示例：

```tsx
<TiptapEditor
  ariaLabel="反馈内容"
  renderToolbar={(toolbar) => <div className={styles.businessToolbarSurface}>{toolbar}</div>}
/>
```

业务包装负责背景、Glass、外层边框、阴影和定位。工具栏根容器及分组使用透明背景，不包含 Glass 标记、backdrop-filter、box-shadow、外层 border 或 sticky/absolute 定位。分组分隔线以及按钮的 hover、pressed、focus-visible 和禁用反馈保留；ExUI 弹层仍使用正常表面背景保证可读性。

`TiptapToolbar` 保持共享包内部组件，不从包根公开接受原生 Editor 的独立入口。`TiptapEditor` 仍是业务使用入口；编辑器现有外框、内容排版和 DragHandle 不属于透明工具栏的背景边界。

## 内部模块及依赖

在 `packages/components/src/tiptap/toolbar/` 内拆分以下职责。文件名作为实施切分约定，不建立通用插件注册系统：

| 模块                                             | 责任                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `TiptapToolbar.tsx`、`TiptapToolbar.module.scss` | 透明根容器、分组、TooltipProvider、更多入口及内部组件协调。          |
| `state.ts`                                       | 当前选区的激活、混合、禁用及字号/颜色状态；统一命令描述和固定文案。  |
| `layout.ts`                                      | 固定逻辑单元、收纳级别、测量和 ResizeObserver 生命周期。             |
| `selection.ts`                                   | 菜单会话选区书签、transaction mapping、代际与焦点恢复。              |
| `ParagraphControls.tsx`                          | 正文/H1–H4、引用、代码块、列表类型及缩进菜单。                       |
| `FontSizeControl.tsx`                            | 独立字号选择，预设、默认与混合状态。                                 |
| `ColorControls.tsx`、`colors.ts`                 | 三类圆形色块面板、token 解析、当前值及清除。                         |
| `InsertControls.tsx`、`UrlForms.tsx`             | 链接、图片地址、本地上传及区块菜单；保留当前字段校验与命令提交判断。 |
| `ToolbarButton.tsx`、`focus.ts`                  | 统一按钮、Tooltip、可读名称与 roving focus。                         |

这些模块只依赖 ExUI 包根、Lucide、现有 Tiptap、RHF/Zod 及内部公开能力；不访问业务 API。可用状态与激活状态由 `useEditorState` 订阅；布局和菜单状态由 React 管理。Editor 文档不复制为工具栏 React state，不随布局重建。

## 命令清单与状态语义

逻辑单元按以下顺序展示；命令状态、直接入口及更多入口使用同一份定义。

| 单元            | 命令与状态                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| history，核心   | undo、redo；不可执行时禁用。                                                                                                             |
| paragraph，核心 | setParagraph、setHeading H1–H4；默认正文、当前标题或“混合”。                                                                             |
| paragraphExtra  | toggleBlockquote、toggleCodeBlock、列表菜单；列表菜单包含三种列表与 sink/lift 操作。taskItem 使用 taskItem 命令目标，其余使用 listItem。 |
| marks，核心     | bold、italic、underline。                                                                                                                |
| textExtra       | strike、inline code、字号、unsetAllMarks；清除范围保持当前选区内 Marks，不擅自重置段落、对齐或节点。                                     |
| colors          | 文字颜色、文字背景、高亮三个独立触发器。                                                                                                 |
| insert          | 链接、图片地址、配置 uploadImage 时的本地图片；Details 的创建/解除、四类 Admonition 的设置/解除、HorizontalRule、HardBreak。             |
| align           | 段落及标题的 left、center、right、justify。                                                                                              |

所有项目具有稳定命令 ID、中文可读名称和适用的激活/禁用状态。按钮使用当前 `can()` 与扩展命令判定；表单提交的可用性由校验后的真实参数决定，不能用空 URL 的 can 检查禁用整个链接入口。

统一值取值规则：光标使用 storedMarks 或所在位置的有效 Marks、段落属性；非空选区遍历实际选中的文本/文本块，排除未选中的边界内容。每个字段返回 uniform(value)、mixed 或 unavailable。mixed 不选中某个下拉项，也不展示误导性的颜色指示；格式按钮以 `aria-pressed="mixed"` 表达混合。相同文档中的非预设合法值不能丢失。

类型菜单使用 ExUI DropdownMenuRadioGroup/RadioItem；字号可采用同一菜单组合。状态中的默认值只代表没有显式属性，不能硬编码为内容的最终计算值。

## 字号与颜色面板

字号预设映射：12→0.75rem、14→0.875rem、16→1rem、18→1.125rem、20→1.25rem、24→1.5rem、32→2rem、48→3rem。面板标题注明“字号（16px 基准）”。默认项调用 unsetFontSize；其他合法导入值在触发器展示对应换算数值但不伪造预设选中项。混合选区展示“混合”。预设按当前扩展的 setFontSize 提交并经过原有文档校验。

文字颜色使用默认、链接、成功、警告、危险五个语义选项；默认调用 unsetColor。背景和高亮使用现有四个非默认语义色，并提供“无”，分别调用 unsetBackgroundColor、unsetHighlight。高亮选择使用 setHighlight，避免重复选择当前色时 toggle 清除。三个面板都提供色块、中文名称、选中标记、Tooltip 和独立清除入口；色块是按钮，不能用只有点击事件的 div。

文字颜色、背景色和高亮仍是不同内容属性，不自动合并或互相清除。触发器展示类别及 uniform 实际色值；mixed 和没有显式值使用明确默认提示。圆形色块在透明色、深色主题和选中状态下仍有可见边界。

token 解析在挂载及主题变化时执行，不在每次 Editor transaction 中创建 DOM。使用位于工具栏宿主的临时探针读取 ExUI color token，再以浏览器 1px Canvas 转为 sRGB RGBA，输出现有 normalizeColor 支持的十六进制值。探针不进入 EditorContent；token 解析失败时禁用该色块并显示固定提示，不把失败解释成黑色。Canvas 只负责 CSS 颜色值转换，不加载外部图片或用户文件。

颜色缓存按 token 和当前主题更新，覆盖 light/dark 类切换及相关 color-scheme 变化。色块重算不回写文档已有属性，不将 var(...)、oklch(...) 或新 token 名写入 JSON。浏览器验证覆盖实际 ExUI token 颜色；jsdom 可以替换颜色解析边界，但命令与文档校验仍用真实 Editor。

## 自适应布局算法

根容器 width:100%、min-width:0；按业务提供的实际可用宽度测量，不使用窗口宽度或固定 1050px 阈值。默认控件尺寸 2.25rem，pointer:coarse 时交互区域至少 44px；图标、分隔线和 gap 统一使用 rem 与现有 token。

定义固定收纳级别：

| 级别 | 被收纳的逻辑单元，累计                                               |
| ---- | -------------------------------------------------------------------- |
| 0    | 无，隐藏更多入口。                                                   |
| 1    | align。                                                              |
| 2    | align、insert。                                                      |
| 3    | align、insert、colors。                                              |
| 4    | align、insert、colors、textExtra。                                   |
| 5    | align、insert、colors、textExtra、paragraphExtra；仅保留核心与更多。 |

使用无交互的测量标尺收集每个逻辑单元、分隔线、gap 和更多按钮的 max-content 占用；标尺不挂载第二份命令控件、文件 input、Tooltip 或 portal，不重复注册 Editor 订阅，也不能进入可访问树。字号及标题触发器保留稳定最小宽度，标签变化时重新测量。文字、主题、密度、字体加载和 pointer 类型变化也触发测量。

用已测量单元宽度计算每级所需宽度，选择能容纳的最小级别。开始收纳时预留更多按钮宽度，恢复时只在足够容纳更完整级别时扩展；比较保留 2px 容差避免浮点边界抖动。所有级别均以同一测量结果计算，不能根据已隐藏工具的零宽度反推。

ResizeObserver 回调只记录最新宽度，在 requestAnimationFrame 中最多重算一次；同一级别不 setState。StrictMode effect replay 及卸载清理 observer、字体事件、媒体监听和 pending frame。测量不可用时直接使用级别 5，保证所有命令仍可从更多访问，不猜测缺失尺寸。

当菜单打开或当前 focus 位于拟收纳/恢复的工具时保留已提交级别，将新级别记为 pending；界面允许临时换行，仍保持 min-width:0、防横向溢出。关闭菜单且焦点离开相关控件后应用 pending。首轮测量完成前使用核心与更多布局，不能闪现不可用的隐藏命令。

更多采用 ExUI PopoverContent，按原分组渲染被收纳的控件及标签；每个命令只在主工具栏或更多面板之一挂载。更多面板限制宽度为 viewport 减两侧间距，高度超过可用空间时内部滚动。标题、字号、列表以及颜色等子面板打开期间保持更多父面板与触发器挂载，避免子面板失去锚点；关闭子面板返回所属触发器。

没有 ResizeObserver 或容器不可见时保留紧凑可访问布局；重新出现后重新测量。极窄容器允许核心控件换行，更多入口始终可访问。

## 选区会话、文档代际与提交

打开任一根菜单或表单前建立内部 ToolbarSession：当前 Editor 实例、runtime 文档代际及 SelectionBookmark。首次打开更多捕获一次；其子面板复用同一会话，不用弹层焦点位置覆盖原选区。通过 Editor transaction 事件将 bookmark 随每个已应用 transaction.mapping 移动。

为 `TiptapLifecycle` 添加只读内部 getter `documentGeneration`，返回已有私有 generation，不从包根或编辑器 ref 暴露。显式 replace/dispose 已在 dispatch 前 invalidate，因此会话可在 transaction、提交及 close 回调中检测失效，不新增公共回调或第二套文档版本。

提交前确认 Editor 未销毁、仍 editable、实例与 generation 一致；将 bookmark resolve 到当前文档后执行命令。整篇替换、选区锚点失效或退出编辑模式使会话失效：关闭弹层、清理输入会话、不对新文档应用旧操作。mapped bookmark 的有效性必须按选择类型检查；被删除文本或节点不能通过 Selection.near 静默变成另一段的操作目标。

会话同时记录选区类型与映射边界。NodeSelection 的选中节点被删除时失效；非空 TextSelection 的原选中范围全部被删除时失效，部分删除则保留剩余映射范围；空选区的锚点被删除时失效。通过 transaction.mapping.mapResult 的删除标记和每个实际步骤对原范围的删除覆盖判断，不能只比较最终坐标或假定全部 replace 都等同普通输入。

链接及图片表单输入采用 RHF/Zod。提交通过现有文档校验插件，保留基于真实 transaction 事件的 applied 检查。表单拒绝后不关闭、不聚焦编辑器，字段内容与原文档保留；通过既有字段错误和 runtime 固定诊断反馈。纯格式命令被预算或结构门禁拒绝时保留原文档，不显示成功。

本地文件选择前恢复有效选区，再调用当前 runtime.upload，让上传锚点随后续 transaction mapping 更新。图片上传开始后由现有 runtime 持有文件及锚点；工具栏收纳、弹层关闭或业务包装 rerender 不取消上传、不重复上传。文件控件只存在一个并在处理后清空 value。

成功提交关闭整条面板链，将实际命令结果的选区作为编辑器当前选区并恢复编辑器 focus，抑制 ExUI closeAutoFocus 将焦点抢回触发器。取消/Escape 不修改文档，回到对应触发器；已失效会话不恢复旧选区或操作已销毁实例。取消期间到达的上传结果仍由 runtime 正常处理。

## 键盘与弹层

主工具栏提供单一 Tab 入口，以 roving tabindex 管理当前可用控件；左右箭头循环移动，Home/End 跳首尾，禁用项跳过。更多中的工具形成独立导航范围。DropdownMenu 自身键盘由 ExUI 接管；字号、颜色及表单控件不能同时被外层方向键拦截。

Enter/Space 打开触发器或执行命令。Tab/Shift+Tab 离开工具栏，链接和图片字段保留正常输入导航；不在文档中全局吞掉 Tab。Escape 先关闭最内层菜单，再返回父触发器，不意外退出编辑模式。

只在非编辑控件的 pointer 操作中阻止会导致选区丢失的默认 focus；不阻止弹层 input、textarea、键盘打开以及触屏的正常操作。Mention 失焦取消和组合输入行为继续由原生命周期处理。

TooltipProvider 覆盖工具区且统一延迟；快捷键提示只展示当前扩展真正支持的绑定，菜单中重复提示无需重复绑定 hotkey。浮层使用 ExUI portal，不自行引入浮层库。业务包装为 Glass/overflow 容器时，浮层仍依据触发器正确定位并在视口内避让。

## 安全、兼容与性能

URL、图片属性、样式和值域继续经过现有 RHF/Zod 与完整文档校验，不导入旧项目的宽松 URL 或 Markdown 路径。色块、尺寸及输入不会旁路预算和序列化保真检查。无新增业务数据持久化、localStorage 调色历史、上传服务、遥测或网络依赖。

公开变化只有可选 renderToolbar；默认调用行为与 toolbar=false、只读模式兼容。新增模块保持在既有 tiptap 目录，SCSS 仍由 package sideEffects 保留，源码导出不增加未使用编辑器的全局初始化。新模块避免 import 时读 DOM 或订阅实例。

工具状态只扫描当前选区涉及内容，不全量序列化整个文档；主题色解析、布局测量与命令订阅相互独立。代际 getter 不改变现有上传/Mention 生命周期。

## 验证要求

实现后的检查范围与现有测试规则对齐。以下是待执行的验收命令，本次 RFC 编写不宣称它们已运行：

```text
pnpm exec vitest run packages/components/src/tiptap
pnpm --filter @workspace/components typecheck
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web build
```

`vitest.config.ts` 已包含共享包测试路径，DOM 用例遵循既有 jsdom 注释。新增 `toolbar/state.test.ts`、`toolbar/layout.test.ts`、`toolbar/components.test.tsx` 或按现有结构归并测试；工具状态与命令使用真实 Editor，只有浏览器几何和颜色解析边界允许受控替换。测试不能只是重复固定配置。

| 检查       | 必须证明的行为                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| 状态与命令 | 光标、统一/混合选区、非预设字号及颜色，菜单选中、can 禁用；全部当前命令都有唯一可用入口。             |
| 字号与色块 | 实际 Marks 变化、默认清除、重复高亮选择不清除、背景与高亮独立，JSON/Markdown 往返保持语义。           |
| 会话       | 菜单/表单保住文字及 NodeSelection；异步上传移动锚点；replace、只读、卸载与锚点删除阻止旧会话命令。    |
| 门禁       | 危险链接/图片、非法属性、预算过滤拒绝，表单仍可修正且不丢失文档/输入。                                |
| 宽度变化   | 收纳顺序、更多宽度预算、每个命令只有一个控件、菜单/焦点期间延迟重排、恢复及测量失败回退。             |
| 生命周期   | StrictMode 无重复 observer/listener；关闭表单不重复上传；业务包装 rerender 保持 Editor 与可恢复会话。 |
| 公开契约   | 默认工具栏、renderToolbar 包装、toolbar=false、未就绪、只读切换及多编辑器隔离。                       |

真实浏览器通过现有开发路由验证，并更新 `tests/browser/tiptap-preview.mjs`。覆盖 1440px、375px、pointer:coarse、200% 浏览器缩放以及同一 viewport 下业务容器独立变窄；实际截图和 computed geometry 必须证明字号菜单、圆形色块、状态、全部收纳入口及无横向溢出。检查 light/dark/system、实际 token 颜色转换、键盘流程、滚动后的 portal 定位和临时业务背景包装。

真实浏览器检查工具栏根和分组 computed backgroundColor 透明、无 Glass class/backdrop-filter/外框/阴影；临时业务背景包装只用于验收，不成为共享组件默认背景。自动测试、构建、浏览器及部署分别报告。没有服务端变更，本 RFC 不要求数据库或 Outline 测试替代上述工具栏证据。

## 风险与对应门禁

| 风险                              | 缓解与检测                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| 缩小后用户无法操作被隐藏工具      | 单一完整命令定义、更多面板覆盖全部收纳单元；各级别按可读名称遍历入口。              |
| ResizeObserver 导致抖动或重复挂载 | 独立无交互标尺、固定级别、更多宽度预算及 RAF 合并；浏览器边界宽度反复 resize 验证。 |
| 弹层操作改错选区或替换后的新文档  | mapped bookmark 与 runtime 代际共同门禁；真实 Editor 的删除、上传及 replace 回归。  |
| 业务 Glass 或定位容器裁切菜单     | ExUI portal；使用滚动、overflow 与业务包装的浏览器几何检查。                        |
| CSS token 返回现代颜色导致无效值  | 浏览器 Canvas 转 sRGB、normalizeColor 门禁、失败禁用；实际 token 明暗主题验收。     |
| 混合格式状态误导或长文档扫描过重  | 明确三态，仅扫描选区；结构及 storedMarks 用真实 Editor 验证。                       |
| 重构破坏安全输入与预算拒绝提示    | 保留 RHF/Zod、filterTransaction、applied 事件判定及现有拒绝测试。                   |

## 落地顺序、回滚与交付

1. 完成内部状态、命令表、布局计算与选区会话；新增内部代际 getter 及对应行为测试，不改变公开 ref。
2. 实现字号、颜色、段落与插入控件，复用安全表单；接入 roving focus、Tooltip 和更多面板，移除旧工具栏的背景与混合长菜单。
3. 添加可选 renderToolbar 并在 TiptapEditor 按挂载规则接线，覆盖业务包装与只读行为。
4. 更新组件与开发页浏览器断言，运行上列命令，完成真实浏览器视觉、宽度、键盘及主题验收，再交付实施结果。

以上为有依赖的同一 RFC 范围，不拆成可独立部署的子系统。上线范围为共享组件和本地开发预览；不部署公网，不自行创建 commit 或 PR。

回滚恢复先前工具栏、挂载逻辑及相关测试；业务若已采用 renderToolbar，应先移除该可选 prop 再回退组件版本，避免类型不兼容。文档数据没有迁移，新 UI 继续写现有属性，回滚不删除或重写用户内容。未通过门禁时保留旧实现或继续修复，不以静态 RFC 评审代替运行验收。

本 RFC 无待定架构决策。组件实现、自动检查和真实浏览器验收仍待执行；源设计获确认不等同于 RFC 已获技术评审或实现已完成。稳定 `.ai/` 结论需要按项目规则另行取得用户同意后归纳。
