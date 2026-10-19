# ExUI 1.0 全面迁移设计

日期：2026-10-19

状态：范围已确认，书面设计待审核

模块根目录：`.notes/exui-v1-upgrade/`

## 1. 已确认的目标

将本工程的 ExUI 消费端从 0.8.0 统一升级到 1.0.0，保留现有黑白品牌、页面结构、导航与业务流程，全面采用新版本的组件、组合和交互规范。用户已确认这一范围。

全面迁移包含依赖、共享组件、应用中的组件组合、主题与 Token、编辑器浮层，以及对应的自动检查和浏览器验收。现有 API、业务状态与持久数据的语义继续由原模块负责。

本设计覆盖一个完整升级项目。后续使用一个 RFC 组织实施；分阶段验证依赖关系，不拆成需要分别决定产品范围的子项目。

## 2. 调研依据与版本差异

上游依据为用户提供的 ExUI 源码仓库，比较 `@exre/exui@0.8.0`（`4b08c6c`）与 `@exre/exui@1.0.0`（`bcb20b4`）两个 tag。上游路径均相对 ExUI 仓库根目录：

- `packages/components/CHANGELOG.md`。
- `packages/components/src/index.ts`、`packages/components/src/components/ui/`。
- `packages/components/src/components/reui/emoji-picker.tsx`、`packages/components/src/hooks/use-file-upload.ts`。
- `packages/tokens/src/style.css`。

本工程的组件用法依据 `apps/web/src/`、`packages/components/src/`、`packages/sdk/src/`，消费指导依据 `.agents/skills/exui/SKILL.md` 及其组件参考。实施时以实际安装的 1.0.0 声明和产物再次核对所有新增用法。

| 变化                                                                              | 对本工程的要求                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 删除 `Modal`、`ModalProps`、`ModalSize`、`ModalStateProps`                        | 三处直接消费 `Modal` 的弹窗迁移到 `Dialog`。现有消费符号中的其他导出仍存在。                      |
| `Dialog` 增加快捷标题、说明、底栏、标题动作、`DialogBody`、可选移动端全屏         | 按内容结构选择快捷或显式组合，重新明确滚动、关闭与焦点归还。                                      |
| 基础组件与复杂控件的默认几何、Glass 和部分运行时默认值随根字号缩放                | 自定义布局使用合适的 rem 尺寸；显式数字坐标与偏移保留 CSS 像素含义。                              |
| Badge 移除 `ghost`、`link`，`destructive` 改为实底                                | 本站 ExUI Badge 当前使用 `secondary`；核对状态对比度。编辑器内部的同名 Badge 先核对实际导入来源。 |
| Card 默认内边距缩小，区块 gap 独立；Input 默认边框透明；Tabs 圆角、阴影和焦点更新 | 接受库的新默认样式，清理与它冲突的消费方覆盖，保留页面布局所需的尺寸。                            |
| 新增 EmojiPicker、数据表格、树、日历、看板、选择器等能力                          | 使用与现有产品任务匹配的能力，本次明确采用 EmojiPicker；组件目录扩充本身不产生新业务页面。        |
| ExForm 与 ExMessage 公开 API 保留                                                 | 保持现有校验、表单实例及消息宿主归属，验证升级后的显示与生命周期。                                |

本工程当前有 62 个实现文件直接导入 ExUI。升级清单按组件族覆盖这些消费端，避免将三个编译断点当作完整升级范围。

## 3. 方案选择

采用已确认的全面组件迁移：调整公开 API、清理旧实现耦合、用原生能力替换已有等价 UI，并完成全站消费面验收。这样既能使用 1.0 的能力，也能控制业务回归范围。

比较过的其他方案：仅升级依赖并修复编译错误，无法处理失效的旧弹窗样式、滚动和字号适配；同时重设计全站布局，会引入超出本次组件升级的产品决策。两者均不纳入本设计。

## 4. 责任与依赖

| 层                     | 迁移后的责任                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `@exre/exui`           | 基础组件、交互原语、焦点机制、主题 Token、Glass、原生 Emoji UI。   |
| `packages/components/` | 业务展示组件和受控适配，保留现有 props 与回调；不访问 API。        |
| `apps/web/`            | 页面组合、身份和反馈流程、通知控制器、主题偏好与 API Client 接线。 |
| `packages/sdk/`        | 继续通过公开 ExMessage 显示请求反馈，保持 ExUI 为可选 peer。       |

所有实现从公开入口消费 ExUI。全局 CSS、`ThemeProvider`、`GlassSeed` 和 `ExMessageContext` 继续在 `apps/web/src/main.tsx` 单点挂载。公共组件包不另行导入全局样式。

### 4.1 依赖升级

- `apps/web/package.json`、`packages/components/package.json` 的 ExUI 依赖，以及 `packages/sdk/package.json` 的 peer/dev 依赖，统一采用 `^1.0.0`，本次 lockfile 解析固定为 1.0.0。
- 更新 `pnpm-lock.yaml`。按实际安装策略调整 `pnpm-workspace.yaml` 中 ExUI 的 release-age 精确条目，不扩大为通配豁免。
- `packages/components/` 删除 `emoji-picker-react`，新增锁定的 `emojibase-data@17.0.0`，仅用于本地中文数据。ExUI 自身仍从 registry 安装。
- React 与 React DOM 继续使用当前应用的单一实例；已满足 ExUI 的 React 19 peer 范围。保持 Vite、Vitest 的 dedupe 与 SDK external 配置。
- 当前工程已退役 Outline；本次范围以当前工作区的消费者为准。

## 5. 组件迁移设计

### 5.1 三处 Modal

采用 ExUI 的 `Dialog`；不新建用于模拟旧 Modal API 的通用兼容层。业务组件名如 `FeedbackModal`、`MemberModal` 可以继续保留。

| 消费组件                                                             | 新组合                                                                       | 必须保留的行为                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/web/src/pages/Support/feedback/FeedbackModal.tsx`              | 显式 `Dialog`、`DialogContent`、`DialogHeader`、`DialogBody`、`DialogFooter` | 类型选择、分类型草稿、原地放弃确认、固定操作区、独立正文滚动、恢复与继续提交。 |
| `packages/components/src/notifications/NotificationHistoryModal.tsx` | 显式组合，正文为直接子级 `DialogBody`                                        | 桌面双栏、列表与正文各自滚动、窄屏列表/详情切换、嵌套批量确认及焦点归还。      |
| `apps/web/src/pages/AboutUs/MemberModal.tsx`                         | 带标题和说明的快捷 `Dialog`，内容属性通过 `contentProps` 传入                | 成员内容的加载、错误、重试、关闭文案、原触发器及兜底标题的焦点归还。           |

旧 `width`、`height`、`padding`、`bodyClassName` 和 `mobileFullscreen` 按职责迁移到内容/正文的 CSS Module、`contentProps` 和 `responsiveFullscreen`。已从 0.8.0 实现核对：成员弹窗的 `md` 宽度为 32rem，通知历史的 `xl` 宽度为 64rem；保留这两个桌面宽度，并由视口宽度限制实际尺寸。

反馈弹窗继续使用当前的 48rem 表单宽度与 26rem 放弃确认宽度，并保持窄屏有外边距的布局。成员弹窗保留旧组件默认的窄屏全屏行为，通过显式 `responsiveFullscreen` 表达。通知历史显式启用该能力。各处宽度、最大高度与 padding 分别落在正确的布局节点，避免重复内边距。

**关闭与异步操作：**

- 反馈弹窗由现有 `changeOpen` 流程判断关闭：有未提交内容时，先在同一弹窗确认放弃；取消确认返回原草稿。提交或冻结流程已经开始后，关闭按钮、Escape 和外部点击仍允许隐藏弹窗，原提交任务及附件继续由现有 Provider 推进。组件迁移不得把这些渠道改成提交期间锁定。
- 通知历史在 `bulk.pending !== null` 时拒绝关闭：同时禁用角落按钮，在 `onEscapeKeyDown`、`onInteractOutside` 阻止对应默认行为，并在受控 `onOpenChange` 复核。仅设置 `closeButtonDisabled` 无法覆盖全部渠道。
- 嵌套 Select、Popover 与 AlertDialog 的外部交互先服从各自 Radix 层级；不通过全局键盘监听或 document 点击监听实现关闭。
- 保留各业务组件已有的最终焦点目标。成员触发器被移除时继续使用已有兜底；通知从铃铛浮层切换到历史弹窗时保持现有焦点协调。

**滚动与响应式：**

- 反馈正文在 `DialogBody` 内滚动，底栏按钮通过现有表单 ID 提交，不把整个流程换成新的表单状态实例。
- 通知 `DialogBody` 提供可收缩的高度链；列表与详情保留自己的 overflow 区域。外层负责低视口与大字号下所有操作可达的兜底。
- 通知列表/详情模式改用 ExUI 公开 `useIsMobile`，通过显式布局状态控制对应样式，与 Dialog 的 48 个当前根 rem 全屏阈值一致。删除这一区域固定 768px 的独立判断，避免放大根字号后两种模式错位。
- 视口或根字号变化时复用同一内容节点，保留草稿、文件选择与焦点，不用不同的移动/桌面组件树切换。
- 清除 `.ex-modal-header`、`.ex-modal-body`、`.ex-modal-footer` 耦合；对可定制区域直接传入 CSS Module 类。现有浏览器检查改用公开的 `data-slot="dialog-body"` 或业务语义定位。

### 5.2 现有 Dialog 与其他浮层

检查 `AuthModal`、`SettingsModal`、`SettingsPanel` 的编辑/头像弹窗、身份授权弹窗，以及共享 Join 展示组件中的现有 Dialog。仍在编译或公开导出范围中的组件继续满足 1.0 契约。

长内容采用明确的正文边界，标题与底栏按各页面原布局组织。认证弹窗的隐藏可访问标题、表单步骤和底部说明保持现有含义。设置弹窗继续保留自身的导航布局和短视口全屏处理，避免机械套入一层新的可见标题。

保留 `PopoverAnchor` 的虚拟光标坐标与碰撞避让。顶栏导航、账号菜单、主题菜单、通知铃铛、About 导航、编辑器 Mention/Slash/表格浮层均核对打开、Escape、外部点击、焦点、嵌套层级和 Glass 表面。

已有页面的 Card、Button、ActionButton、Tabs、Alert、Badge、Skeleton、Avatar、InputOTP 和选择控件统一检查尺寸、禁用/选中/错误态及主题对比度。只改需要适配的代码；检查通过的用法保留。

### 5.3 设置与表单

`SettingsPanel` 的自定义 `SettingItem` 展示壳改为 `ExItem`，使用水平布局和右侧内容对齐。保留分类、字段编辑、服务器数据、主题选择和 actionPending 的原有归属。

Select、Switch 及包裹的自定义控件显式关联实际 focusable 元素的 ID、标签与说明；不依赖 ExItem 仅针对直接 Input 的自动关联。窄容器由 ExItem 的既有响应式规则换行，页面 CSS 只负责外层间距和必要宽度。

现有 RHF/Zod 表单继续使用自己的实例与 resolver，ExForm 表单继续使用 ExUI 的同源 `useForm`。本次不把业务表单统一重写成 ExForm，也不将外部 RHF 实例传给它。字段值、服务器错误、parsed submit、提交中禁用和 reset 保持原契约。

文件区继续以业务表单中的 `File[]` 为单一值来源。`useFileUpload` 的内部文件状态、逐文件接纳和公开校验选项不能直接替代本站受控文件集合与整批原子校验，因此保留业务 `FileUploader` 适配，使用 1.0 的公开控件整理其展示。保留数量、空文件、单文件、总字节、类型、删除、相同文件重选、大文件补充信息和冻结后的文件重选规则。

现有头像裁剪继续使用其专用实现；ExUI 提供外围 Dialog 与控件。上传和裁剪的网络请求、预算和持久化仍由原业务层负责。

### 5.4 编辑器 Emoji

将 `packages/components/src/tiptap/EmojiPickerPanel.tsx` 内的 `emoji-picker-react` 替换为 ExUI `EmojiPicker` 与 `EmojiPickerPanel`。组件别名用于区分本站同名面板；外层继续使用已有 ExUI Popover 与虚拟 Anchor，只保留一个 portal/关闭边界。

- `hideSearch`，保留分类和原生 Unicode 网格；默认无预览底栏与肤色选择器。
- 使用 `value={null}` 与 `onEmojiSelect` 的 `selection.value` 连接已有插入函数，固定默认肤色；关闭仍由编辑器 session 决定。
- 在按需加载的面板依赖内引入 `emojibase-data@17.0.0` 的中文 data/messages，经公开 `normalizeEmojibaseData` 生成稳定数据后通过 `data` 提供。使用中文 i18n、最近使用模式及本站专属存储键。
- 提供本地数据避免组件默认的第三方 CDN 请求；数据属于构建资源，不增加 API endpoint 或业务 fetch。
- 最近使用记录由新组件管理，旧第三方库的最近使用格式不做迁移。正文与已有 Emoji 文本不受影响。
- `$` 触发、组合输入排除、取消保留 `$`、选择插入 Unicode、有效 session 校验、迟到回调隔离、只读与文档替换取消继续由既有逻辑负责。
- 打开后聚焦可操作网格；选择和 Escape 后回到编辑器，外部点击保留外部目标焦点。分类、方向键及网格滚动交给原生组件，适配代码仅处理编辑器与面板之间的焦点交接。
- 删除旧 `.EmojiPickerReact` 选择器、`--epr-*` 覆盖和主题 MutationObserver。面板继承 ExUI 主题，并核对分类标题背景与 Glass 的实际显示。
- 面板宽高使用 rem 和可用视口约束；既有 `sideOffset={4}`、`collisionPadding={8}` 保留显式像素语义。

其他编辑器浮层沿用原有交互与持久化规则。工具栏和第三方官方源码的图标豁免继续有效。

### 5.5 主题、Token 与样式

继续使用 `apps/web/src/styles/website-theme.css` 作为黑白品牌覆盖的唯一来源，导入顺序固定为 ExUI、品牌 CSS、应用 SCSS。保持现有 light/dark/system 偏好 reconciliation 及原生 `color-scheme` 的对应关系。

不修改应用默认根字号。验证动态根字号时，库拥有的几何采用 1.0 默认；消费方布局根据用途使用 rem，DOM 坐标、明确指定的数字偏移、细边框、焦点环与阴影维持相应单位语义。

按 1.0 的公开 Token 清单核对 CSS。已发现的 `FeedbackMarkdownField.module.scss` 中 `--exui-border-focus` 与 `--exui-feedback-error` 改用存在的焦点和 danger Token，并保持与普通输入框一致的聚焦/错误反馈。核对整个消费面，避免仅修复这两项。

Glass 继续逐表面启用，保留库的内描边、高光、降级背景和焦点环。首页叠卡、顶栏与编辑器 Details 等已有定制继续使用其文档化入口；对布局需要保留的覆盖给出具体理由。

同步修正 `.ai/knowledge/web/exui-integration-traps.md` 中经过源码确认已变化的版本性结论。实现完成后再使用 `codebase-documenter` 更新对应模块的稳定行为，当前设计不提前写入 `.ai/` 成为已实现事实。

## 6. 验收

### 6.1 安装与自动检查

1. 实际安装的三个消费端解析到 lockfile 中的 ExUI 1.0.0；SDK 保留 optional peer，应用和共享组件使用同一实例。
2. 全部公开导入和 props 通过真实发行包声明检查，`Modal` 消费与旧样式选择器清零，`emoji-picker-react` 依赖和源码引用清零。
3. 在现有 Vitest 测试中补充行为回归：三个弹窗关闭/焦点、通知 pending、反馈草稿与后台提交、ExItem 关联、文件整批校验、Emoji session 和键盘操作。保留其他现有接线测试。
4. 顺序执行 `pnpm typecheck`、`pnpm test`、`pnpm build`。生成 SDK 产物的检查不并发。完整自动测试按项目规则使用临时 PostgreSQL；Docker 不可用时明确报告失败，不连接开发库替代。

### 6.2 浏览器验收矩阵

| 区域                                                          | 核对内容                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 顶栏、首页、About、Join 介绍、支持中心、Docs 建设中页、错误页 | Card/Button/导航外观、长短页切换、明暗主题、键盘焦点和横向溢出。                                  |
| 登录、邀请注册、验证码占位、身份授权、设置与资料              | 原业务步骤、输入校验、错误关联、提交状态、切换主题、设置双宿主及嵌套弹窗。                        |
| 反馈                                                          | 类型选择、正文与附件、放弃确认、底栏可达、关闭后提交继续、失败恢复及重新打开规则。                |
| 通知                                                          | 铃铛到历史的焦点、筛选、双栏/窄屏、列表与详情滚动、嵌套确认、pending 关闭阻断。                   |
| 编辑器                                                        | Emoji、Mention、Slash、表格与颜色浮层的定位、Glass、键盘、选区和取消；Unicode/Markdown 内容不变。 |
| 全局通知                                                      | 单宿主、普通消息、loading 完成/失败/取消、主题与位置。                                            |

至少覆盖 1440×900、390×844 和 360×640，浅色/深色、system 跟随及 reduced motion。弹窗和浮层覆盖 16px、20px、24px 根字号，以及切换字号前后同一草稿节点与文件引用；在 640×320、32px 根字号下确认标题、正文与操作仍可达。通知在 48 个当前根 rem 阈值两侧检查布局与全屏同步。

复用 `tests/browser/notification-experience.mjs`、`tests/browser/navbar-geometry.mjs` 和现有 About 浏览器脚本；按需要增加聚焦此次迁移的场景。带 fixture 的浏览器检查验证本站 UI，不代替真实 API、ClickUp 或身份提供方验收。真实页面检查与隔离 fixture 结果分别记录。

### 6.3 完成标准

全部消费者升级并完成组件族检查，自动检查通过，已迁移的弹窗/表单/编辑器核心交互及上述主题、视口、字号矩阵有浏览器证据。任何未完成项单独列明，不能以编译通过替代整体升级验收。当前阶段不部署上线。

## 7. 风险与处理

| 风险                                       | 处理                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Dialog 新布局与原双栏/底栏的高度链互相影响 | 直接子级正文、局部 overflow 和低视口浏览器检查。                            |
| 将通知的关闭锁定错误套用于反馈提交         | 两种业务策略分别接线并回归，反馈继续允许隐藏在途任务。                      |
| 根字号放大后全屏阈值与业务窄屏模式不同步   | 通知使用公开 `useIsMobile` 作为共同判断，测试动态根字号。                   |
| Emoji 默认远程数据引入运行时网络依赖       | 同包中文数据与显式 `data`，浏览器核对无第三方数据请求。                     |
| 组件默认样式改变后旧 CSS 覆盖掩盖问题      | 按组件族检查实际计算样式和渲染，移除失效的实现类耦合。                      |
| 源码与实际发行包声明存在差异               | 安装后以 1.0.0 公开产物复核；若不能表达某项设计，先记录具体差异再调整方案。 |

## 8. 后续交接

书面设计批准后，使用 `technical-design-doc-creator`，以本文件为唯一范围基线，保留源设计并在 `.notes/exui-v1-upgrade/rfcs/` 编写一个实施就绪 RFC。RFC 需明确文件级迁移、关闭事件接线、Dialog 高度链、Emoji 数据组合与验收方法。

本文件是设计，尚不表示依赖已安装、组件已改造或验收已完成。设计审批不等于提交、推送或部署授权。
