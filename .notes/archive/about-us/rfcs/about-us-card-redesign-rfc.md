# RFC：About 首页文字 Hero 与错落卡片

状态：待实施。用户已确认视觉设计及三项修订；本 RFC 为设计阶段交付，不代表已授权执行代码修改。

设计依据：`.notes/about-us/specs/2026-10-12-about-us-card-redesign.md`。模块根目录为 `.notes/about-us/`；本 RFC 补充既有 `about-us-content-and-ui-rfc.md` 的首页展示规则。源 spec 保留原文，最新确认状态以本 RFC 和会话中的明确确认记录为准。

## 决策

将 `/aboutus` 首页改为全站顶栏、文字 Hero、六模块浅色错落卡片。首页没有 About TabHeader、栏目导航、面包屑、Hero 按钮或 Shader；子页继续沿用现有导航与正文布局。图片采用普通占位容器，后续可通过内容元数据提供素材，不绘制 SVG、CSS 插画或 Canvas 替代品。

实现只涉及 About 内容定义和 Web 页面。无需更改 HTTP Contract、Server、数据库、Outline 或依赖版本。

## 当前证据

- `apps/web/src/pages/AboutUs/AboutUs.tsx` 在首页渲染 `AboutHero`、`AboutNavigation`、介绍正文和 `HomeEntries`；入口焦点选择器为 `a[href="#about-content"]`。
- `AboutHero.tsx` 动态导入 `hero/renderer`；现有首页测试依赖全屏 Hero 和向下跳转。
- `apps/web/build/about/schema.ts` 定义 strict 首页 schema，已有 `hero`、`introHeading` 与 `entryDescriptions`；`definition.ts` 将通过校验的首页字段投影到注册表。
- `apps/web/src/content/about/types.ts` 显式定义浏览器侧首页类型，字段扩展需要同步。
- `useReadingPosition.ts` 默认支持 h1，使用 Router location key 保存位置；本次只调整调用方入口焦点，不重写恢复机制。
- 首页正文来源为 `apps/web/content/about/index.mdx`，现有两段说明与整理中 Callout 必须仍有展示位置。
- 根目录没有 `TESTING.md`；实施遵循当前测试配置与 `CONTRIBUTING.md`。主题约束见 `.ai/knowledge/web/exui-integration-traps.md`。

## 页面职责

`AboutPageView` 继续管理路由内容加载、阅读位置和成员 Modal，在 home 分支渲染新的首页展示组件 `AboutHome`。子页分支保持现有 `AboutNavigation`、标题和列表组件组合。

`AboutHome` 接收首页元数据、内容加载状态和 MDX components，负责文字 Hero、六卡网格和图片区域。它不建立第二份路由表，也不请求 API。五个栏目链接通过已有注册表解析；没有目标的理念卡不生成链接。

新布局可使用 `AboutHome.module.scss` 隔离首页样式；旧 `AboutUs.module.scss` 只移除确认不再使用的首页规则，保留子页共享规则。禁止通过改全站 `SiteHeader` 的样式补偿首页。

首页移除旧 `AboutHero` 挂载与导入。旧 Hero/GPU 文件本轮默认保留为无消费者文件，以保护当前未提交实现；只有实施时明确核对范围后才清理。无论是否保留文件，正式首页必须不加载 renderer，不创建 WebGL context，不注册 Shader 动画循环。

## 内容契约

继续使用 `hero.headline`、`hero.eyebrow`、`hero.summary`，不把文案写入 React。现有 `hero.image` 为兼容作者内容保留，但文字 Hero 不消费它。

首页增加以下可选字段，类型与 strict schema 同步；字段名均为本 RFC 提议的新契约：

| 字段             | 类型                                                                                        | 缺省行为           |
| ---------------- | ------------------------------------------------------------------------------------------- | ------------------ |
| `entryHeadlines` | 仅允许 communities、projects、team、media、story 五个可选非空字符串的 strict object         | 使用对应栏目 title |
| `cardImages`     | 仅允许 communities、projects、belief、team、media、story 六个可选 ImageRef 的 strict object | 渲染普通图片占位   |

`entryDescriptions` 沿用现有规则，缺省使用栏目 description。理念标题使用现有 `introHeading`；正文直接复用当前 `AboutBody` 与首页 MDX，不新增一份理念描述字段。这样保留两段作者说明和整理中 Callout，并消除独立长介绍区。理念卡允许按正文自然增高，不固定高度裁掉内容；其最终高度可能大于视觉示例。

栏目标签、入口短文案和展示顺序作为 UI 结构维护，使用现有栏目名称；路由目标必须来自注册表，不允许作者在卡片字段中写任意 URL 或事件。

ImageRef 复用 `apps/web/build/content/schema.ts` 中的 `imageSchema`，沿用 src、alt、width、height 和现有资源边界校验。注册表投影同步验证新增字段，内容构建实际检查嵌套图片资源，而非仅声明 TypeScript 类型。保留当前 schema 对非空 alt 的要求；展示组件可对纯装饰图片输出空 alt，不修改共享 schema 放宽全部图片。

初始内容不填写虚构图片路径，六个 `cardImages` 字段均可省略。占位是 DOM 容器与简短「图片占位」标签；没有内嵌 SVG、素材图标或复杂几何画。失败图片切换到同尺寸占位，避免 broken-image 图标。

## 布局与样式

桌面基础网格三列，最大内容宽度约 1120px。第一行社区跨两列、项目占右列；第二行理念在左、团队在中、项目继续占右；第三行理念继续占左、Media 跨中右；历程最后全宽。项目上方错位使用卡片自身间距，不创建空白交互区。

DOM 顺序固定为社区、项目、理念、团队、Media、历程。建议 1024px 及以上三列、640–1023px 两列、639px 及以下单列；两列与单列取消顶部错位并遵循 DOM 顺序。断点属于本 RFC 的实施选择，验收时根据真实长文案检查溢出。

文字 Hero 处于正常文档流，不占满一屏；移除旧首页抵消顶栏高度的负偏移。只保留一个 h1，`tabIndex=-1`。首屏露出卡片以桌面 1440×900 和手机 390×844、默认字号、批准文案为参考；200% 缩放时优先完整阅读，不压缩内容以强行露卡。

卡片圆角约 24–28px、间距 14–16px；使用现有 ExUI token，组件局部按 scaling 规则使用 rem。不得假定存在 `--exui-radius-*`，也不新增全局 token 层。浅深色由现有根主题继承，不新增 ThemeProvider 或全局样式导入。

图片区域建议社区约 4:5、项目约 4:3、理念约 1:1、团队约 3:1、Media 约 1:1、历程约 3:1；比例由局部样式按槽位决定。图片使用 object-fit: cover，原始 ImageRef 宽高描述素材本身。窄屏时采用正常流的图片区域，禁止绝对定位覆盖多行文本。实际图片与占位使用同一尺寸规则，避免加载后跳动。

五个入口卡使用明确的栏目链接；标题和入口视觉共享一个链接目标，避免嵌套交互。理念正文内的已有链接或作者组件继续使用原有语义。占位图无 Tab stop，Media 无假播放按钮。允许轻微边框/颜色 hover 与可见 focus，尊重 reduced motion。

## 加载、导航与失败

`useContent` 和 `AboutBody` 保持现有懒加载、重试和重新加载入口。首页正文加载状态出现在理念卡内，其余元数据可正常显示；页面恢复 ready 条件继续以实际内容状态为准。

首页使用 `useReadingPosition` 的默认 h1 入口焦点。保留 `about-content` id 并将其放在卡片网格容器，兼容已存在的 hash 地址，但不渲染向下按钮。返回首页继续按 location key 恢复滚动。所有子页的面包屑、栏目状态、成员 Modal 与 Media 筛选保持现有行为。

## 变更范围与落地顺序

1. 扩展 About 首页 schema、浏览器类型与内容字段，验证 registry 投影和嵌套资源校验。新字段可选，现有内容可先正常运行。
2. 新增 `AboutHome`，把首页正文映射到理念卡并完成六卡布局；在首页分支移除旧 Hero 与 AboutNavigation，修改入口焦点。
3. 更新只针对旧首页的测试与样式，保留子页行为覆盖；进行浏览器验证和局部调整。

文件范围为 `apps/web/build/about/`、`apps/web/src/content/about/types.ts`、`apps/web/content/about/index.mdx`、`apps/web/src/pages/AboutUs/` 与相关内容测试。通用内容编译器原则上无需修改；若发现它未处理新增嵌套 ImageRef，先以真实编译用例定位，再最小修复。不得顺带重构内容系统。

当前工作区有未提交改动。实施前检查最新 diff，以现状为基线，禁止 restore/reset 整个文件。对任务必需的首页改动做局部修改，无法区分的重叠编辑单独说明。设计稿自身保留，不替换既有主 spec。

## 验证

| 层级       | 验证内容                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 内容构建   | 新字段缺省、合法图片、非法卡片 key、缺失图片文件；使用实际 About 定义与编译器验证公开投影                         |
| 页面组件   | 首页只有一个 h1；无 About 栏目导航、Hero 操作按钮、Canvas；五个入口目标正确；理念正文、loading/error/retry 仍显示 |
| 图片       | 未提供及加载失败均为稳定占位，不出现自绘 SVG/Canvas；有效素材按指定槽位显示                                       |
| 导航回归   | 首页进入焦点、子页导航、返回恢复、旧 about-content hash、成员 Modal 与 Media 筛选                                 |
| 真实浏览器 | 320px、390px、768px、1440px；浅深色、200% 缩放、长文案、键盘、reduced motion；检查横向溢出及图片遮挡              |
| 运行证据   | 首页访问不加载旧 renderer chunk、不创建 WebGL；检查网络与实际页面，不能仅靠移除 Canvas 的 mock 得出结论           |

实施时运行 Web 内容检查、类型检查、相关 Vitest 用例与 Web build；具体命令以当时 package scripts 和测试配置为准。无需启动数据库来验证静态 About；完整仓库检查是否需要按实际改动与项目规则判断。分别报告自动检查、浏览器检查和未执行项。

## 风险与恢复

- 理念 MDX 长于视觉稿：卡片自然增高、图片置于正文之后，使用长内容与缩放验证；不裁切或删掉现有内容。
- 主题与参考图色差：使用项目实际 token 并实测对比度，不照抄预览的硬编码配色。
- 删除锚点导致焦点失效：同一变更中调整首页焦点并保留旧 hash 容器，覆盖直接进入和浏览器后退。
- 未提交代码被覆盖：按最新差异进行局部修改，GPU 旧文件默认不删除。

仅本地集成，不部署。回退时撤销本 RFC 实施产生的局部补丁，恢复实施前首页分支及内容；新增可选字段不会阻止旧布局读取基础字段，但旧 strict schema 与新内容必须成组回退。没有数据库或持久服务数据迁移。

## 自检与后续

已核对获批 spec、当前首页调用链、schema/类型投影、阅读位置和主题约束。没有阻塞实施的未决设计问题；真实图片是后续素材输入，不是本轮前置条件。

本 RFC 只完成书面设计交付，未运行实现测试或宣称浏览器验收通过。正式实现完成后，按项目约定同步 `.ai/` 中被实际行为改变的首页知识；设计阶段不把方案写成已落地事实。
