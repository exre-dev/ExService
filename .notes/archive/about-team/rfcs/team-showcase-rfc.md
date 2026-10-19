# 团队页两屏人物展示与开发团队招募 RFC

状态：设计已确认，实施待启动。创建日期：2026-10-13。

设计依据：`.notes/about-team/specs/2026-10-13-team-showcase-design.md`。本 RFC 保留该设计稿，覆盖同一模块 `.notes/about-team/`；不授权提交、发布或部署。

## 决策摘要

将 `/aboutus/team` 改为两个顺序排列的全屏章节：配置驱动的人物舞台，以及 Web 黑白主题的开发团队招募入口。章节各设一屏最低高度，内容较多时增高。新增稳定的 `/aboutus/team#join` 公开锚点。

成员元数据由 `apps/web/public/config.json` 的 `teams` 提供。旧 MDX 成员注册表继续服务项目、Media 和成员简介引用，不随本次页面展示迁移。招募是入口卡片，目标尚未提供时采用明确的禁用状态。

## 现状与范围

当前 `AboutUs.tsx` 在通用栏目模板中渲染 `TeamList`，点击卡片打开 `MemberModal`。固定页和内容引用由 `build/about/definition.ts` 检查，`team.mdx` 当前使用普通 `sectionSchema`。`useReadingPosition` 已管理文档信息、按 Router key 保存位置、等待正文就绪并进行 hash 定位。

粘性站点顶栏由 `packages/components/src/SiteHeader.module.scss` 定义，公开高度变量为 `--site-header-height`。About 栏目导航不改为第二层固定顶栏。

变更只进入 Web 页面、公开配置、About 集合适配及相应测试。HTTP、Server、数据库、Outline、共享 ExUI 实现和依赖版本不变。通用 MDX 引擎不新增团队数据职责。

## 文件与责任

以下新增路径为建议落点，责任必须保持分离：

| 路径                                                                                   | 责任                                                                 |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/config/team.ts`                                                          | 纯配置 schema、类型、默认值和 URL 语义检查；无浏览器或文件系统依赖。 |
| `apps/web/src/config/team-config.ts`                                                   | 导入公开 JSON，提供解析后的团队展示配置。                            |
| `apps/web/build/team-config.ts`                                                        | Node 文件和资源校验，以及 Vite 开发／构建接入。                      |
| `apps/web/src/pages/AboutUs/TeamPage.tsx`                                              | 组合两屏，持有当前选择，接入现有正文状态和锚点。                     |
| `TeamShowcase.tsx`、`TeamShowcase.module.scss`                                         | 头像选择、人物及资料、成员主题与切换动画。                           |
| `TeamRecruitment.tsx`、`TeamRecruitment.module.scss`                                   | 左侧宣传、右侧唯一入口、Web 黑白主题。                               |
| `TeamBackgrounds.tsx`                                                                  | 两种 Shader 的懒加载、就绪、失败回退及资源清理。                     |
| `AboutUs.tsx`                                                                          | 为团队页选择独立模板；继续持有旧简介 Modal 的其他入口。              |
| `build/about/schema.ts`、`definition.ts`、`source.config.ts`、`content/about/types.ts` | 团队页专用内容契约、公开投影及 `join` 锚点校验。                     |
| `content/about/team.mdx`、`public/config.json`                                         | 招募文案、页面文案、四份占位和可选招募 URL。                         |
| `useReadingPosition.ts`                                                                | 保留既有滚动语义，增加团队 hash 目标的可选焦点能力。                 |

本工作树已有 About、内容编译器、Vite 和其他未提交变更。实施前重读实际 diff，局部补丁只添加本 RFC 所需行为，不能回退这些改动。

## 公开配置契约

`teams` 缺省为 `[]`，`teamRecruitment.url` 可选。顶层既有 `community` 及其他无关配置原样保留；团队项与其嵌套对象采用严格 schema，不把顶层整个文件改成只允许团队字段的结构。

```ts
interface TeamImage {
  src: string
  alt: string
  width: number
  height: number
}
interface TeamMember {
  id: string
  name: string
  role: string
  bio: string
  avatar?: TeamImage
  portrait?: TeamImage
  strengths: { title: string; description: string }[]
  theme: {
    colorBack: string
    accent: string
    colorFill: string
    colorStroke: string
  }
}
interface TeamDisplayConfig {
  teams: TeamMember[]
  teamRecruitment: { url?: string }
}
```

- id 是唯一 ASCII kebab-case；文本非空；图片宽高为正安全整数，alt 非空。
- `strengths` 可为空，空能力列表不展示能力行或虚构默认能力。
- `colorBack`、`accent` 为不透明六位十六进制；点颜色为六位或八位十六进制。缺省点颜色分别为 `#ffffff7d`、`#ffffff`。
- 主面板白色正文及强调色上的白色文字对比度至少 4.5:1；装饰点的透明度不参与正文对比度计算。
- 图片 src 限于 `/images/team/`，拒绝路径穿越、查询和 fragment。构建侧检查实际文件和 realpath 仍在 `public/images/team/` 内。未提供图片时省略字段，初始配置不填不存在的照片地址。
- 四份初始资料使用“成员 01–04”和职责／能力占位。数组顺序就是头像顺序；不增加寄语、计数、排序和私有草稿字段。
- 空列表仍渲染团队页标题、占位说明与完整招募章节，隐藏选择条和人物舞台。
- 招募 URL 缺省或空值为无入口状态。非空值允许无凭据 HTTPS 或已登记的站内根相对路由；未知站内目标、协议相对地址及其他协议报错。该字段不能指向团队页自身的 `#join` 来冒充报名入口。

浏览器直接导入 JSON 模块并使用纯解析器。构建校验器在 Vite `buildStart` 运行，并在配置或团队图片发生开发变更时复核；合法变更继续 JSON HMR，非法变更显示带文件和字段位置的开发错误并阻止发布构建。浏览器不 fetch 配置，不新增 HTTP operation。

配置更新后按稳定 id 保留选择；当前 id 被删除时选择首项，列表清空则进入空态。解析器不依赖手工维护的第二份 DTO。

## About 内容契约

增加独立 `teamSchema` 和 `aboutTeam` doc 集合，从 `aboutSections` 的固定文件清单中移出 `team.mdx`。在 `source.config.ts` 显式注册集合，在业务 classify 和 project 中登记，不让通用引擎推断业务文件名。

保留基础 `title`、`description`、`eyebrow`、`draft`；固定团队页继续必须存在且公开。团队页新增：

```ts
showcase?: { headline: string; lead?: string }
recruitment: {
  eyebrow: string
  title: string
  description: string
  highlights: string[]
  entryEyebrow: string
  entryTitle: string
  entryDescription: string
  buttonLabel: string
}
```

`showcase.headline` 缺省时使用页面 title；招募对象及其非空文本必填，highlights 初始为设计稿中的三条。公开页投影增加明确的 `kind:"team"` 及 `section:"team"` 分支，将这些内容交给 `TeamPage`；其他栏目 schema 不接受团队字段。正文仍经现有 `useContent`／`AboutBody` 展示，占位说明与失败重试入口保留。

招募文字使用已确认设计稿：左侧“加入 Exre，一起创造。”与三条协作亮点；右侧“从这里开始。”、“通过招募入口，了解加入方式。”和“加入开发团队”按钮。删除右侧重复宣传及底部方向文字。

旧 `AboutRegistry.members`、成员正文加载器、项目和 Media 的 related 引用保持现有数据源。新 `teams` 不自动创建 MDX 实体或个人路由，也不把四个展示占位伪装为真实项目贡献者。

## 两屏布局与 hash

`TeamPage` 产生两个兄弟 section，第一块包含标题、正文和舞台，第二块 `id="join"` 包含招募分栏。两块均用 `min-height:100vh; min-height:100svh` 和 border-box。章节内边距计入最低高度；通用 `main` 的额外排版间距仅在团队分支取消。站点顶栏与 About 导航在章节之前保留原行为。

内容足够时在章节中垂直居中；短视口和长内容自然撑高。不能使用固定 height、章节内容裁切、嵌套滚动或全局滚轮劫持。背景层可以裁切 Shader，头像浮动选择条及文字不能被背景裁切容器包住。

`join` 有 `tabIndex=-1`、标题关联和顶栏 scroll-margin。偏移采用粘性站点顶栏当前高度，初始可由 `--site-header-height` 得到；真实浏览器在放大／换行情况下若实际高度变化，使用该顶栏的 ResizeObserver 更新团队局部偏移，不另建全局主题层。

锚点出现后复用阅读位置恢复流程。团队正文状态离开 loading 后才判定初次页面就绪，避免晚加载正文改变第一章节高度而挤走招募定位。图片占位和实际图片保持声明的稳定布局尺寸。

为 `useReadingPosition` 保持现有四个参数兼容，增加可选的第五参数 `{ focusHashTarget?: boolean }`，默认 false。只有团队页传 true：已找到 hash 目标时将焦点交给可聚焦章节，使用 `preventScroll` 后执行现有的即时锚点定位。未带 hash 的导航和 POP 位置恢复保持不变。效果依赖选项的布尔值，不能依赖每次 render 创建的对象身份。

支持初次访问、刷新、站内 Link 导航和同页 fragment 变化至 `/aboutus/team#join`。保留 malformed hash 和未知 hash 的既有处理；不把非法编码转成重定向。成员切换不改变 hash、不主动滚动。

在 About 的内部链接校验中仅为 `team.mdx` 登记模板锚点 `join`。普通 Markdown `/aboutus/team#join` 因此可通过检查；未知团队锚点和其他页面非法锚点仍报错。继续使用现有页面解析，不新增个人路由或 `AboutLink` target 语法。

## 动画、材质与背景

成员数据和当前主题在单一选择控制器中关联，单次选择不产生姓名、图片和能力分属不同成员的状态。选择反馈即时；80ms 淡出后统一切换显示资料，再用 160ms 淡入。主题过渡为 250ms，曲线 `[0.23,1,0.32,1]`。重复选择不重播，连续选择停掉旧动画并从当前值过渡；代次标识阻止旧完成回调回写。

直接使用已安装 `framer-motion` 的 motion values／订阅更新颜色，生产代码不照搬独立 HTML 预览里的 CSS MutationObserver 桥接。减少动态效果模式直接更新资料，最多保留 100ms 的柔和颜色变化。卸载清理动画及订阅，后台状态落到最新选择。

玻璃头像条使用 `ex-glass` 和 `--exui-glass-*` 公共配置，不新增全局 CSS 导入或 GlassSeed。团队分栏沿用 Web 黑白语义：招募文字、对勾和按钮使用现有 `--exui-text-primary`／`--exui-surface-background`，不借用 ExUI 默认蓝色 primary 来替代用户指定的深色按钮。真实深色主题下按语义色适配，不把整个招募区固定成黑底。

两个背景遵循不同契约：

| 背景                  | 约束                                                                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 人物面板 DotGrid      | 用户参数原样：size 2、gapX/Y 32、strokeWidth 0、sizeRange/opacityRange 1、circle；主题只改变颜色。保持 speed 0，同一个实例更新颜色。                                                                              |
| 招募右侧 MeshGradient | 黑白 colors、distortion 1、swirl 0.2、grainMixer/Overlay 0、rotation 90；可见且正常动态模式 speed 1。实际布局源容器 240×264，minPixelRatio 1、maxPixelCount 64,000。通过 border-box 尺寸计算 CSS scale 铺满区域。 |

低分辨率 Mesh 的 CSS scale 不提高 Canvas backing store 尺寸，ResizeObserver 只更新两个缩放比例，不重建组件。像素预算允许整数舍入后的少量误差，但本预览实际为 63,865 像素。库已具备后台和离屏暂停；减少动态效果显式设 speed 0，卸载由 React 组件释放 Shader，并清理本地 resize／媒体查询监听。

背景模块采用页面局部懒加载和 WebGL2 能力检查。预先渲染纯色／静态黑白渐变，使不可用环境仍有可读页面。局部错误边界覆盖同步加载失败；当前库在 effect 中异步初始化，不能声称单靠 React 错误边界可捕获全部初始化失败。

使用公共 Shader ref 的就绪状态及 `data-paper-shader` 就绪标记观察初始化，初始化期间先保留回退层；三秒内未就绪则卸载该背景并保留回退。源码表明标记在构造流程完成后设置，不能只检查 canvas 存在：canvas 会先于 WebGL 初始化插入。对实际 canvas 监听 context lost，撤下失败背景，不全局吞掉无关 rejection。测试必须注入异步初始化失败并确认内容和选择仍可用；控制台日志与视觉回退分别报告。

## 入口与未提供的信息

招募入口尚未提供。用户已确认带禁用状态的入口卡片，因此初始配置可省略 `teamRecruitment.url`，展示“招募入口待开放”，不阻塞布局实施。真实招募渠道由用户补充，不能替换成已知玩家申请或玩家社区地址。

有 URL 时渲染真实链接：站内使用 Router Link，外部使用 HTTPS a 和 `target="_blank" rel="noopener noreferrer"`。无 URL 时渲染 disabled button，保留入口状态描述。显示 `#join` 不会使禁用入口自动可提交。

本次没有申请表单、上传、简历数据、招聘名额、报酬或审核接口；将来新增申请表单须另行设计 Contract 与数据处理范围。

## 验证与落地顺序

先同步落地团队内容 schema／投影／集合配置与 `team.mdx`，再添加公开配置解析及四份占位，随后接入专用页面、焦点／hash 和背景；每个落地步骤应保持现有 About 页面与旧引用有效。无需迁移数据库、创建账号或启动依赖服务。

重点测试：

- 严格配置、id 唯一、颜色对比、路径和文件、空态、URL 缺省和非法值、HMR 选择保持。
- 真正的内容编译：新 team 集合、正确的公开投影、固定页要求、其他栏目不接受团队字段，公开 `#join` 与未知锚点。
- 默认／切换／连续反向选择、图片失败、减少动态效果、后台与卸载、两种 Shader 回退。只验证最终行为，不镜像内部组件结构。
- 原有团队卡片打开 Modal 的测试调整为新舞台行为；另从现有相关成员入口覆盖旧 Modal，避免丢失其他页的简介能力。
- reading hook 的原无 hash POP 回归、就绪等待、目标聚焦、带 hash 首次加载和 Router 导航。jsdom 只证明调用与焦点，不能证明真实像素位置。
- 浏览器几何：1440×1000 时两块各至少 1000px，成员屏定位时 join 起点在视口之外；1440×600、390×844、320px 宽、200% 缩放时自然增高、不裁切、无横向溢出；浅／深色和键盘。
- 直接加载和刷新正式路径 `/aboutus/team#join`，检查目标不被固定顶栏遮住、正文与图像就绪后不漂移，以及无 hash 的返回位置。
- Mesh backing store 在高 DPR、缩放、resize 下仍受预算控制；离屏和后台不持续绘制。

自动检查按仓库惯例使用 `pnpm --filter @workspace/web typecheck`、`pnpm --filter @workspace/web content:check`、对应 `pnpm exec vitest run` 文件以及 `pnpm --filter @workspace/web build`。配置 Node 测试放进已登记的 `tests/` 或 `src/` 测试路径，避免把测试放进未扫描的 build 目录而误认为执行过。如扩大影响则补充必要根检查；不能为本变更触碰无关失败或 Outline。

当前设计阶段仅验证了独立视觉预览：1440×1000 两块各 1000px；1440×600 两块按内容增高；390×844 无横向溢出；预览 `#join` 能定位；Mesh 实测 241×265。尚未执行生产实现的类型、内容、单元、构建或正式路径浏览器验收，这些留给实施阶段。

## 风险、取舍与回退

| 风险或取舍                     | 控制与验证                                                             |
| ------------------------------ | ---------------------------------------------------------------------- |
| 展示配置与旧 MDX 名录并存      | 按用途分开，不自动关联；验证旧项目／Media 引用，后续统一名录另行设计。 |
| 极短视口无法一屏容纳           | min-height 和内容增长，不强制翻页；验证手机、长文案和缩放。            |
| 延迟加载导致 hash 漂移         | 正文 ready 后定位、图片稳定尺寸、真实浏览器刷新验收。                  |
| 多 Shader 与高 DPR 的成本      | Mesh 固定小源与像素预算，实例稳定，离屏／后台暂停；测真实 canvas。     |
| 库异步初始化不能直接被边界捕获 | 就绪标记、局部超时和 context lost 回退，注入真实失败；不隐瞒未验证项。 |
| 招募地址缺失                   | 明确禁用状态，不输出伪链接；用户补充后启用。                           |

保留单一普通文档滚动；没有采用 nested scroll／mandatory snap，因为会增加长内容、锚点及辅助技术风险。没有把 JSON 成员资料塞进通用内容编译器，因为当前需求是独立人物展示，而旧引用已有明确边界。

回退仅撤销本 RFC 的专用团队分支、内容契约及团队配置接入，恢复原团队模板；保留旧成员 MDX、已存在配置、照片资源、用户账号、所有无关工作和数据。不执行 reset、迁移、锁文件重建、提交或部署。

## 交接与范围

一个 RFC 覆盖本模块的完整垂直改版，无独立剩余子项目。招募目标属于未提供的配置值，不是被发明的接口；其占位行为已定义。

交接后停止设计阶段。下一阶段实施须以该 RFC 和源设计为依据；本 RFC 的完成不代表已修改正式页面或完成部署验收。
