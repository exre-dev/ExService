# Outline 公共与成员阅读界面对齐

日期：2026-10-08\
模块根目录：`.notes/docs-integration/`\
状态：用户已确认复用方向和方案细化；作为 RFC 输入。交互 Demo 的细节仍可调整，尚未进入生产实现。

## 1. 已确认方向与本草案范围

用户已确认以成员工作区的视觉风格为基准，采用共用展示组件和公共页面适配，明确要求“能共用的组件，尽量共用”，并将持续升级 Outline 的维护成本作为设计约束。

本草案选择第一期先统一布局和基础阅读交互，保留现有公开 RPC 与 DTO。自定义图标、颜色、正文全宽等公开外观字段暂不扩展，这是本期范围；以后若补齐外观字段，须另行修订服务端和验收范围。

本期包含公共 Sidebar、公共文档正文页、公共文档集总览与详情页、公共顶部导航，以及上述区域在登录 publicOnly 读者路径中的呈现。现有搜索页只做导航与布局回归检查，不重新设计搜索。

目标是让访问者始终辨认出同一套文档产品：行布局、标题层级、正文排版、Glass 导航与状态反馈一致。页面内容和操作仍随真实可见性及权限变化。

## 2. 现状证据

| 区域     | 当前事实                                                                                                                       | 来源                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 布局     | 公共与成员分支已共用 DocsLayout；成员分支另挂身份、拖拽与工作区行为。                                                          | `apps/outline/app/components/DocsLayout.tsx`、`apps/outline/app/components/AuthenticatedLayout.tsx`                                                                              |
| Sidebar  | 成员向 DocsNavigation 传入空条目，再通过插槽挂原 Collections；公共条目由 NavigationRow 单独呈现。                              | `apps/outline/app/components/Sidebar/App.tsx`、`apps/outline/app/components/Sidebar/DocsNavigation.tsx`                                                                          |
| 树行几何 | 公共展开按钮占用独立横向空间，树深度逐级加一；成员直属文档使用 Math.max(depth + 1, 2)，行几何由 SidebarLink 控制。             | `apps/outline/app/components/Sidebar/components/SidebarLink.tsx`、`apps/outline/app/components/Sidebar/components/CollectionLinkChildren.tsx`                                    |
| 正文     | 两分支最终使用同一个 Editor wrapper；成员页与公共页分别组合标题和正文，已经共用 ReadingMain、ReadingBody、标题样式与目录列表。 | `apps/outline/app/scenes/Document/components/Document.tsx`、`apps/outline/app/scenes/Document/components/Editor.tsx`、`apps/outline/app/scenes/WebsitePublic/PublicDocument.tsx` |
| 导航     | 成员页将面包屑、目录及收藏放入左侧 Glass；公共页的面包屑及目录按钮放在正文标题区域。                                           | `apps/outline/app/scenes/Document/components/Header.tsx`、`apps/outline/app/scenes/Document/components/DocumentReadingFrame.tsx`                                                 |
| 文档集   | 公共总览及集合详情直接使用普通链接列表；成员 DocumentListItem 已复用 DocsSearchResultLink 与 DocsSearchResultContent。         | `apps/outline/app/scenes/WebsitePublic/PublicDirectory.tsx`、`apps/outline/app/components/DocumentListItem.tsx`、`apps/outline/app/components/DocsSearch.tsx`                    |
| 字段     | 公共集合有名称、描述与地址；公共文档详情有标题、正文与更新时间，缺少 icon、color、fullWidth。                                  | `apps/outline/shared/types/websiteIntegration.ts`                                                                                                                                |
| 身份     | 登录 publicOnly 读者仍进入 PublicDocumentView，可按授权接入公共评论。                                                          | `apps/outline/app/scenes/Document/components/PublicOnlyGate.tsx`                                                                                                                 |

本轮先前已查看真实成员文档页。匿名布局结论来自当前源码；未完成两种身份的真实浏览器对照，不能视为完整视觉验收。

## 3. 选择与升级边界

采用“现有基础组件复用优先，公共组合适配其次，新增抽取最后”的顺序。

不把 CollectionRow、DocumentRow、DocumentListItem 或成员 Document 场景改造成统一业务框架。它们继续持有成员 Model、policy、动作上下文、拖拽、保存与协作行为。公共页面只使用身份无关的基础呈现，不能通过构造虚假成员实体获得复用。

本期不新增通用文档树引擎，不建立第二套主题 token，不重命名已有共用组件，不跨 Website 与 Outline 共享 React 实例。新增辅助组件放在现有公共阅读或 Docs 组件边界内，避免为目录整齐移动大量现有文件。

| 层次     | 复用或适配方式                                                                                | 成员业务改动目标                   |
| -------- | --------------------------------------------------------------------------------------------- | ---------------------------------- |
| 布局     | 继续使用 DocsLayout、Header、Scene 与 CenteredContent。                                       | 无新增业务改动。                   |
| Glass    | 复用 GlassToolbar、GlassNavigationToolbar 与既有按钮。                                        | 无新增业务改动。                   |
| Sidebar  | 公共行复用 SidebarLink、现有展开控件及 ExUI 行 token；公共 adapter 负责组合、深度与选中状态。 | 不改成员树加载、排序、拖拽与菜单。 |
| 文档列表 | 公共列表复用 DocsSearchResultLink 和 DocsSearchResultContent。                                | 不拆成员 DocumentListItem。        |
| 正文     | 继续使用 Editor、ReadingMain、ReadingBody、readingTitleStyles 与 ReadingContentsView。        | 不重构成员 Editor wrapper。        |

如实施发现必须改变上游基础组件的公共接口，RFC 必须记录原因、受影响消费者及替代方案。不能把这项设计扩展成顺手重构成员组件。

## 4. Sidebar 设计

### 4.1 外观与结构

公共侧栏增加与成员一致的“文档集”可见分组标题，沿用现有 Sidebar Header 组件，无创建按钮。品牌、主页、搜索、集合区域与底部身份区域沿用既有布局。

集合行与文档行的高度、圆角、内边距、图标尺寸、hover、选中及焦点外观由 SidebarLink 和现有 ExUI token 决定。移除公共行额外增加的固定宽度箭头列，使展开控件位于行既有预留区。集合深度沿用成员基准；直属文档使用成员现有的最小深度规则，后续子文档每层递增。

公共展开按钮与导航链接保持独立交互语义，不把可聚焦按钮嵌入链接。允许公共行以轻量 wrapper 组合现有展示控件；无需强行复用整个成员 CollectionRow 或 DocumentRow。

### 4.2 基础行为

- 点击名称导航，点击箭头只展开或收起，不能意外跳页。
- 当前文档只高亮文档行；所属集合及祖先可以展开，不同时显示成另一个当前页面。集合详情页高亮当前集合。
- 有子项的文档提供展开按钮；没有子项的行保持相同文字对齐位置。
- 展开按钮有包含条目名称的可访问标签、正确的 aria-expanded，并能通过键盘触发。链接保留原生新标签页及修饰键行为。
- 收起、离开路由和重试继续遵守 PublicDocsStore 的取消及请求代次规则。
- 条目多时仅集合区域滚动；底部登录或账号入口持续可达。

允许的内容差异：公共树只有公开条目，隐藏父节点按既有公开规则处理；成员树保留授权范围和原排序。统一展示不意味着两边条目数量、父子关系或排序必须相同。

## 5. 顶部导航设计

### 5.1 桌面

导航放在主内容区域的左上角，紧邻 Sidebar 右边界后的 Header 内边距起点；不跟随居中的正文列定位。侧栏收起时使用已有 Glass 展开控件，避免叠放重复按钮。

公共文档页的 Glass 胶囊包含公开集合入口和目录开关。只显示已由公共数据确认可见的路径，不补查私有祖先。当前文档名称保留为正文大标题，滚动后的 Header 标题按原 Header 行为出现。

文档集详情页的 Glass 胶囊包含总览返回入口与集合内搜索入口；搜索使用现有公共搜索路由及 collectionId 参数。总览页提供搜索入口。成员页保留其现有收藏、编辑、发布、分享等授权操作。

长路径在胶囊内收缩及省略，不能挤出右侧操作、遮挡 Sidebar 展开控件或造成整页横向滚动。

### 5.2 移动端与正文目录

移动端沿用 Header 的 Sidebar 开关；导航胶囊收缩为可读的集合入口和目录按钮。目录按钮打开底部抽屉，容器复用 Outline 现有 Drawer primitives 与 Portal，列表使用 ReadingContentsView 和公开 headings，不使用要求成员 DocumentContext 的 TableOfContentsMenu。

桌面目录列表继续位于正文侧边，按钮控制本地显示状态；移动端目录选择后关闭并跳转标题。无有效标题时不显示目录按钮。公共目录状态不写成员偏好。

同一屏幕只存在一份可访问的公共目录，不把移动目录追加在整篇正文之后。打印保留静态目录，去除交互导航。

### 5.3 单一 Header owner

公共配置加载、未初始化或配置失败由 WebsitePublic 提供 Header。配置就绪后，每个内容场景负责自己的 Header：目录由 PublicDirectory 的 Scene 负责，搜索由既有 PublicSearch 的 Scene 负责，文档由 PublicDocumentView 内部负责。

文档就绪后，拥有 headings 状态的公共 Reader 提供目录按钮；文档加载或失败时由同一公共文档分支提供没有目录动作的 Header。登录 publicOnly 路径继续接入这一公共文档分支，不叠加成员文档 Header。

调整现有 showHeader 调用契约时必须检查所有消费点。每个可见页面只挂一个 Header、一个 Sidebar 开关和一组导航。

## 6. 正文设计

公共文档首屏依次为顶部导航、正文大标题、公开更新时间、富文本内容。面包屑和目录按钮从正文标题区移出，正文列保持居中。

继续使用 ReadingMain、ReadingBody、readingTitleStyles 和同一个只读 Editor。标题与正文的字号、行距、阅读宽度和基础间距沿用现有共用定义，不复制另一套 CSS。

更新时间使用已有 PublicDocumentInfo.updatedAt。成员作者、访问统计、历史、引用、协作者和内部评论能力不投影到匿名页；缺失的信息不以假的成员元数据或空占位补齐。成员标题的可编辑行为继续留在原组件。

公共 Editor 保留 publicReader 和 readOnly，继续禁用成员 integration、内部 mention 预取、写入与协作副请求。现有 headings 初始化的幂等处理及 ref/onInit 双时机必须保留。

本期公共页保持标准正文宽度。成员的 fullWidth、标题编号偏好及自定义图标仍可产生外观差异，不将其误报为本期一致性缺陷。

## 7. 文档集页面设计

### 7.1 总览

总览使用 Scene、CenteredContent 和现有标题样式，展示“文档集”标题及公开集合列表。列表每行包含默认集合图标、名称和可用的描述摘要，使用既有共用列表展示组件，替换裸链接项目符号。

公开集合分页继续提供“更多集合”按钮，不展示尚未完整加载的集合总数，不借页面改版加载成员集合。

### 7.2 集合详情

集合详情依次展示集合标题、公开描述和“文档”列表。标题区域使用与成员一致的基本标题及居中容器；无描述时不保留大块空白。

公开描述已是 Markdown 字符串，可交给支持字符串输入的既有 Editor，以 publicReader/readOnly 模式展示；不使用原始 HTML 注入、不新建 Markdown 渲染器，也不挂成员 Overview。首次实施需验证空描述、链接及静态 mention 的呈现。

文档列表直接使用 DocsSearchResultLink 与 DocsSearchResultContent，沿用成员列表已有的文字、hover 和焦点外观。默认展示集合树的根文档；嵌套条目继续通过 Sidebar 访问，本期不增加正文中的第二套展开树，也不声称根文档列表包含全部文档。

公开列表不显示批量选择、拖拽、收藏、成员菜单和未经 DTO 提供的作者或时间。成员集合的 Overview、排序标签、置顶与管理功能保留，不为了匿名页面改造这些业务结构。

## 8. 数据、权限与失败处理

公共数据继续由 PublicDocsStore 调用既有 public.collections.list、public.documents.list、public.documents.info、public.documents.search。UI 不直接请求 API，不从成员 Store 补齐公开字段。

匿名、登录 publicOnly 读者及成员不是简单的二元登录开关。公共读者使用公共组合；有效身份及明确评论授权可以接入原 PublicComments；成员继续走原授权场景。

保留身份变更和撤权后的 generation/epoch 校验、旧响应失效及标题清除行为。网络失败提供真实重试；不可见或不存在的文档不保留旧标题、面包屑或树选中项。身份探测失败仍在既有导航区域提供恢复入口，不能挤占正文状态。

加载、空列表、不可见和网络失败沿用 DocsStatus/PublicFeedback。局部树与描述加载使用局部状态，整页正文加载使用 page 状态；保留品牌及 Sidebar，不回退成裸错误页。

## 9. 预期变更范围

| 文件或边界                                                             | 预期工作                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/outline/app/components/Sidebar/DocsNavigation.tsx`               | 公共分组标题、公共行几何与独立展开控件组合。成员空条目插槽路径不得新增空分组或重复标题。 |
| `apps/outline/app/scenes/WebsitePublic/PublicNavigation.tsx`           | 公共导航状态及已有 Sidebar 接入。                                                        |
| `apps/outline/app/stores/PublicDocsStore.ts`                           | 如需修改，仅收窄当前行选中投影；不改请求、排序或权限生命周期。                           |
| `apps/outline/app/scenes/WebsitePublic.tsx`                            | 收敛配置状态与就绪场景的 Header owner。                                                  |
| `apps/outline/app/scenes/WebsitePublic/PublicDocument.tsx`             | Glass 导航、公开更新时间、移动目录与现有 Reader 组合。                                   |
| `apps/outline/app/scenes/WebsitePublic/PublicDirectory.tsx`            | Scene、集合描述与共用列表展示。                                                          |
| `apps/outline/app/scenes/Document/components/DocumentReadingFrame.tsx` | 公共组合移出正文内导航；保留成员已消费的样式与目录导出，不移动或重命名。                 |
| `apps/outline/app/scenes/Document/components/PublicOnlyGate.tsx`       | 仅在 Header 调用契约需要时调整公共 Reader 接入。                                         |
| 公共辅助组件与相关现有测试                                             | 必要时局部拆分导航或目录展示，避免把逻辑继续堆入场景文件。                               |

复用而非重构的目标文件：成员 CollectionRow、DocumentRow、DocumentListItem、Document 场景及其 Editor、成员 Header，以及共用 Header、Scene、GlassToolbar、DocsSearch。生产实现若需要改变这些边界，应先在 RFC 中明确必要性。

本期没有 Website HTTP Contract、数据库、迁移、OIDC、附件授权或依赖树变更，也不执行 Outline 版本升级。

## 10. 升级维护规则

1. 在后续 RFC 中记录此次依赖的基础组件接口及消费点，区分现有定制与本次新增接入；不把整个 fork 的维护成本归因于本次界面对齐。
2. 新增业务适配集中在公共组件，避免向成员高频业务文件散布条件分支。
3. Outline 升级后先检查 Header/Scene 布局、SidebarLink/Disclosure、Editor wrapper、共用列表展示及 Portal/primitives 的接口和行为，再检查身份恢复与 publicOnly 接入。
4. Git 无冲突和类型检查通过均不足以认定升级完成。必须重新执行身份矩阵、键盘操作及真实浏览器布局对照。
5. 如上游提供更合适的身份无关组件，优先替换公共适配；不为维持旧抽象而改回上游业务实现。

风险仍然存在：上游可以改变 DOM、样式、路由或 Editor 行为。此方案控制新增耦合范围，不保证零冲突或固定升级工时；本期没有目标版本升级演练，不能给出已经验证的升级成本结论。

## 11. 验收标准

### 11.1 视觉与交互

| 编号 | 场景与通过条件                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| V01  | 同一公开文档，匿名、登录 publicOnly、成员三种读取路径使用同一品牌、Sidebar 容器、基础行样式、标题排版及 Glass 材质；允许本规格列出的数据与能力差异。 |
| V02  | 桌面面包屑及目录按钮位于主区域左上角 Header，不在居中正文标题区域；每个页面只有一个 Header。                                                         |
| V03  | 公共集合及至少三层文档的缩进、箭头区域和文字起点符合成员几何；点击箭头不导航，点击链接不误展开，当前页面高亮唯一。                                   |
| V04  | 公共总览和集合详情呈现正式列表；长名称、无描述、空集合及分页均可用，根文档与全部文档的含义不混淆。                                                   |
| V05  | 桌面目录可开关；移动目录入口在顶部，选择后正确跳转并关闭；无标题文档隐藏目录按钮；打印无交互导航。                                                   |
| V06  | Sidebar 展开及折叠、宽屏及手机窄屏、浅色及深色、长面包屑及 200% 缩放下无遮挡、重复控件或整页横向溢出。                                               |
| V07  | 退出到同一公开文档后，导航仍在同一布局区域，旧成员数据与操作清除；状态提示不造成双 Header。                                                          |
| V08  | 成员重命名、新建子文档、拖拽、收藏、菜单、保存及协作路径保持既有功能；独立 Outline 模式完成受影响区域回归。                                          |

### 11.2 自动验证与证据分层

按现有 Outline 测试惯例补充行为回归：DocsNavigation、WebsitePublic、DocumentReadingFrame 及 publicOnly/Header owner 调用点。覆盖键盘展开与导航隔离、选中投影、目录生命周期、描述只读渲染和重复 Header 防护。

保留现有公共读取、撤权、迟到响应及 Editor headings/ref 回归。即使本期不改服务端，也不能通过 UI 改动重新挂载成员副请求。

执行与变更相符的 Outline typecheck、格式、lint 和构建检查；服务端测试仅在后续规格纳入服务端修改时增加。当前没有根或 Outline TESTING.md，实施前须再次核对，以实施时实际规则为准。

真实浏览器使用有内容的同一公开文档和集合，对照匿名、登录 publicOnly、成员及编辑者；交互 Demo、Mock、自动化和真实身份/OIDC 结果分别报告。已有 `tests/browser/docs-toolbar-geometry.mjs` 可作为 Glass 几何回归入口，不能单独替代完整验收。

## 12. 设计交付与后续步骤

本草案细化已批准的架构方向，用户已再次确认“能共用的组件，尽量共用”；此约束作为后续 RFC 的复用审查标准。布局进入视觉评审时提供可交互 Demo，复用既有预览目录并另建本次预览文件，保留历史预览；Demo 使用样例数据并明确标注，不视为真实账号验收。

书面规格经用户明确批准后，使用 technical-design-doc-creator 创建一份 RFC，输出目录固定为 `.notes/docs-integration/rfcs/`，保留本规格。RFC 需要细化组件接口、Header owner、目录状态及验证落点；不替代真实 Demo 的布局确认。

本阶段仅设计，不改生产代码、不提交或推送，也不把未批准设计提炼到 `.ai/`。生产实现须在书面设计与布局 Demo 确认后另行进入开发流程。
