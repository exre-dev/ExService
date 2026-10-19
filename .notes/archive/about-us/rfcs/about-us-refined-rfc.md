# RFC：About 首页品牌叙事实现

状态：设计已确认，进入实施。依据 `.notes/about-us/specs/2026-10-12-about-us-refined-design.md`；本 RFC 替代 `about-us-card-redesign-rfc.md` 的首页布局及图片槽位决策，原文件保留。

## 边界与组件

`AboutPageView` 保留 `useContent`、阅读位置与成员弹窗，home 分支挂载 `AboutHome`，子页保持现有导航、正文和列表。`AboutHome` 接收 home 元数据、正文状态、MDX components 与 retry，渲染文字 Hero 和六模块布局，通过现有 `aboutRegistry` 获取五个栏目 title、description、url。样式位于 `AboutHome.module.scss`，不修改全站顶栏或主题入口。

移除正式首页对 `AboutHero` 的导入；旧 Hero/GPU 文件保留，不再由首页加载。调用 `useReadingPosition` 的默认 h1 入口，保留网格 `about-content` id。实际浏览器复现了长首页进入短子页时 cleanup 用压缩后的 scrollY 覆盖已记录位置的问题；最小修复是移除 cleanup 再保存，保留 scroll 事件记录、location key、ready、hash 和 ResizeObserver 机制。

## 元数据契约

在 `apps/web/build/about/schema.ts` 与 `apps/web/src/content/about/types.ts` 同步新增：

| 字段             | 类型与缺省                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `hero.lead`      | 可选非空字符串，未提供时不渲染额外短引言                                                      |
| `entryHeadlines` | strict object，communities、projects、team、media、story 五个可选非空字符串；缺省用栏目 title |
| `cardImages`     | strict object，同样五个可选 ImageRef；缺省或加载失败用占位                                    |

理念没有图片槽位，不接受 `cardImages.belief`；这替代早期 RFC 的六图片字段提案。ImageRef 沿用共享 schema 的 alt、width、height、caption、position，实际图片保留 alt，object-fit 为 cover，position 映射为 object-position。注册表已使用 homeSchema 解析后展开投影；通用编译器已递归检查 ImageRef，无需修改它们，只通过真实定义与编译器测试新增字段。

默认内容使用已确认 Demo 的标题与短引言。首页 MDX 正文原文保留。图片字段全部省略，不写虚构路径。换行沿用既有 headline 的转义换行约定，长文案仍允许自然换行。

## 布局与交互

桌面两列：社区跨两列；项目、理念各一列；团队跨两列并采用内部两列；Media、历程各一列。640px 以下单列；中间宽度调整字号、间距及 Hero 列宽。理念按完整正文自然增高。图片比例：社区约 2.65:1、项目/Media/历程 4:3、团队约 1.55:1；手机统一约 4:3。同一槽位的有效图片、缺省与失败使用相同比例，不因请求结果跳动。

栏目标题、简介和入口视觉共享一个路由链接，不嵌套交互；图片区不点击。缺省占位使用简短文字，无图标插画。现有 MDX 正文加载与错误态放在理念区，其余栏目元数据正常显示。重试仍由 `useContent` 管理，文档重新加载入口保留。

## 落地与验证

先增加实际 About 内容编译与页面行为测试，再扩展 schema/type/content、实现局部组件，调整首页挂载和相关样式。只删除已无消费者的首页样式；子页测试保留。

运行 Web content:check/typecheck、相关 Vitest 及 Web build。生产构建核验 renderer chunk 不再存在；浏览器观察网络与 WebGL 调用，验证首页、五个入口、子页导航、返回滚动、hash、成员弹窗和 Media 筛选。检查图片缺省/失败/有效素材、320/390/768/1440px、200% 缩放与长文案。

同步 `.ai/architectures/web/content-rendering.md` 与 `.ai/knowledge/web/content-authoring.md` 中实际改变的首页行为，保留内容编译、换行和子页知识。以任务开始的文件副本区分已有改动与本次局部补丁；不 restore/reset 整个文件。

## 风险与回退

真实素材尚未提供，视觉验收只覆盖已确认占位状态。长文案和 MDX 可能改变区块高度，通过自然布局及真实浏览器验证，不删减作者内容。新可选字段保证缺省内容仍可构建；旧 strict schema 与新增字段内容回退时必须成组撤销。本次不涉及持久数据迁移，仅本地集成，不部署、不 push、不提交。

没有阻塞实施的未决设计问题。
