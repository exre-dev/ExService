# About 首页品牌叙事设计

状态：已确认。用户在查看 `.notes/previews/about-us/about-us-refined-prototype.html` 后同意本方向；本设计替代 `.notes/about-us/specs/2026-10-12-about-us-card-redesign.md` 中的彩色三列错落布局，其余内容与功能边界继续适用。

## 视觉决策

参考 [Apple Stories](https://www.apple.com/newsroom/apple-stories/) 的主视觉与次级故事层级，以及 [Work at Apple](https://www.apple.com/careers/us/work-at-apple.html) 的章节阅读节奏；保持现有 ExUI、全站顶栏及加入页的黑白灰表达。

首页左侧大标题，右侧短引言与简介，处于正常文档流。社区采用宽幅图片区，下方标题与简介分列；随后项目与理念并列，团队以文字与横向图片展开，最后 Media 与历程并列。DOM 顺序保持社区、项目、理念、团队、Media、历程。手机以相同顺序单列阅读。

理念只展示完整首页 MDX，不设置图片或无目标按钮。其余五个栏目采用独立图片槽位，图片与文字各自拥有空间，无外围嵌套卡框。背景、字体和边框继承根主题；无彩色卡片背景、Shader、首页栏目导航、面包屑、Hero 按钮或演示控制条。

最大内容宽度约 1120px，桌面主标题约 88px、栏目标题约 40px，手机主标题约 44–52px、栏目标题约 30px。尺寸按 rem 与实际宽度缩放，长文案自然换行，不固定高度裁切。

## 内容与素材

Hero、栏目标题、简介继续由首页元数据维护。新增短引言 `hero.lead` 和五个栏目可选 `entryHeadlines`；缺省时不显示短引言、使用注册表栏目标题。理念标题与正文分别沿用 `introHeading` 和现有 MDX，保留两段介绍与整理中 Callout。

五个栏目提供可选 `cardImages`，复用现有 ImageRef 与资源校验。图片缺省或加载失败时显示同尺寸普通占位；不绘制 SVG/CSS 插画、不增加假播放。初始内容不借用 Apple 或现有社区照片，真实素材由用户后续提供。

## 功能与验收

五个入口来自已校验注册表，每个栏目只有一个链接，图片不成为额外交互目标。理念正文中的链接与作者组件保持语义。首页 h1 为入口焦点，保留 `about-content` hash；加载、重试、文档重新加载、返回位置恢复、子页导航、成员 Modal 和 Media 筛选保持现有行为。

验证 strict 字段、公开投影、嵌套图片资源、图片失败与缺省、正文状态、栏目链接及导航恢复。真实浏览器检查 320px、390px、768px、1440px、浅深色、键盘、200% 缩放、长文案和 reduced motion；核验首页不加载旧 renderer、不创建 WebGL。实现和测试只涉及 About/Web 内容层，不涉及 HTTP、Server、数据库、Outline、依赖升级、部署或提交。
