# 仓库内容编辑

内容作者编辑 MDX/YAML 后，开发页面会重新检查与刷新。发布构建复用同一检查，非法字段、引用或作者语法不会静默上线。

_最后更新：2026-10-14_

## 编辑 About

内容源位于 `apps/web/content/about/`。正文用 MDX，列表所需字段用 frontmatter；视频条目维护于 `media/items.yaml`，音乐使用 Media 页的原生 Apple Music 播放列表配置。字段和默认值以 `apps/web/build/about/schema.ts` 为准。

首页 `hero.headline`、`hero.eyebrow` 和 `hero.summary` 用于背景上叠加的文案；可选 `hero.lead` 提供标题下方的短引言。`introHeading` 是理念标题，首页 MDX 正文完整渲染在理念区。标题可沿用 `\n` 转义换行，长内容仍会自然换行。页面与阅读行为见 `.ai/architectures/web/content-rendering.md`。

`entryHeadlines` 与 `entryDescriptions` 仅允许 communities、team、media、story、donations 五个可选非空字符串，分别覆盖首页栏目标题和简介；省略时使用对应栏目元数据。栏目标签和链接目标由 UI 与已校验注册表管理，不在这些字段中写 URL。

`cardImages` 的数据格式保留相同五个 key，每项为集合 ImageRef；首页社区块仅展示文字和入口，不消费 `communities` 图片。理念是正文区，没有图片 key。嵌套图片仍经过实际资源存在性与路径边界检查；其他四个栏目未填写图片或浏览器加载失败时显示稳定占位。当前素材未提供，不填写虚构资源路径。`hero.image` 保留内容兼容，当前 Hero 不消费它；背景暂沿用加入页现有素材，实际来源见 `.ai/architectures/web/content-rendering.md`。

项目栏目已移除；不再支持 `projects` 首页字段、`related.projects`、`page:projects` 或 `project:<slug>` 作者目标，也不再注册项目 MDX 集合。

社区目录的名称与一句介绍分别来自 `communities/<slug>.mdx` 的 title、description；目录不渲染 `communities/index.mdx` 正文，社区详情页仍渲染各自完整正文。可选 cover 用于目录图片；省略时 Rifling-911 与 CAEP 复用现有加入页素材。文档入口由公开注册表的社区 URL 生成，不在正文中重复维护。布局和降级行为见 `.ai/architectures/web/content-rendering.md`。

社区 frontmatter 可选 theme 使用与团队人物卡相同的点阵字段：colorBack、accent 为 `#RRGGBB` 且满足白字对比度至少 4.5:1；colorFill、colorStroke 支持 `#RRGGBB` 或 `#RRGGBBAA`，默认分别为 `#ffffff7d` 与 `#ffffff`。每个社区独立维护，切换社区时同时切换背景；省略 theme 保留深灰主题。accent 保留与共享主题一致的字段语义，当前点阵背景不消费它。

### 音乐和影像

`media/index.mdx` 属于独立 `aboutMediaPage` 集合。基础 title、description、eyebrow 与正文用于开场；必填 `backgroundVideoUrl` 是无凭据 HTTPS 视频地址，`playlist` 提供 title、description、embedUrl，`videos` 提供 title、description。其他栏目不接受这些展示字段。

`playlist.embedUrl` 只接受 `https://embed.music.apple.com/<两位地区>/playlist/<名称>/pl.<ID>`，不能携带凭据、自定义端口、查询或 fragment；复制 Apple 的播放列表嵌入地址即可，不粘贴原始 iframe HTML，不使用单曲或专辑地址。播放器尺寸与权限由 UI 维护，字段修改不需要改组件。

`media/items.yaml` 的 items 只接受 `type: video`。保留 id、title、creator、usage、order、draft，以及可选 sourceUrl、cover、related；顺序按 order 与 id 排序，草稿不公开。封面使用集合 ImageRef 并检查资源边界；缺少封面或 HTTPS 来源时显示占位，不编造外链。站内关联和深链继续使用 `/aboutus/media#media-<id>`；模板章节使用不同前缀，不占用视频 id。

### 捐赠渠道与名单

`donations.mdx` 的 title 和 description 用于页面元信息与栏目入口，eyebrow 用于开场标签，完整 MDX 正文用于开场介绍；展示标题由页面模板维护，不在正文重复 h1。`donations/items.yaml` 独立维护 channels 与 donors。渠道支持 id、name、可选 description、HTTPS url 和集合 qrCode ImageRef；url 与 qrCode 至少提供一个。捐赠者记录 id、nickname、YYYY-MM-DD 格式 date；日期必须是有效日历日期。列表顺序由作者维护，不按金额或时间自动排名。

渠道与捐赠者均支持 `draft: true`，未公开条目不会进入公开投影；清单不要移入 MDX frontmatter，原因见 `.ai/architectures/web/content-rendering.md`。id 在各自列表内必须唯一，含草稿。草稿引用的二维码也必须存在并遵守集合资源边界，草稿独占图片不公开。缺省列表为 []，页面显示整理中状态；只填写已核对并允许公开的昵称、日期和实际渠道，不编造示例捐赠记录或收款地址。

以下仅演示编辑格式，条目为草稿：

```yaml
channels:
  - id: example-channel
    name: 示例渠道
    url: https://example.com/support
    draft: true
donors:
  - id: example-donor
    nickname: 示例昵称
    date: '2026-10-12'
    draft: true
```

内容检查在解析前将 CRLF 统一为 LF。`gray-matter` 截取 CRLF frontmatter 时会留下末尾 `\r`，使最后一行的数字或布尔值被 YAML 解析为字符串；不能通过字段强制转换绕过类型检查。`tests/content/compiler.test.ts` 覆盖两种换行下的数字类型与草稿过滤。

固定首页与栏目介绍不能缺失或设为草稿。社区和成员文件 basename 必须与 slug 一致。未知事实明确使用占位、unknown 或 draft，不填写未经核实的运营状态、日期或来源。

```mdx
---
title: 社区标题
description: 一句话介绍
slug: example-community
status: unknown
draft: true
---

## 为什么做

介绍问题与思路。
```

正文从二级标题开始，不重复模板 h1。支持标准 Markdown、表格和 fenced code；Lua、JavaScript、TypeScript、JSON、YAML、Bash 在构建时高亮，未知语言保留名称并按纯文本展示。

```mdx
<Callout title="阅读提示" kind="note">
  说明文字。
</Callout>
<ContentImage image={{ src: 'assets/example.webp', alt: '图片说明', width: 1200, height: 800 }} />
<AboutLink target="page:communities">查看社区</AboutLink>
<MemberButton slug="example-contributor">查看贡献者</MemberButton>
```

作者组件的属性必须是字符串或静态 JSON 形态值；不允许 import/export、任意表达式、事件属性、原始 HTML、展开或函数调用。组件白名单及属性契约在 About schema 中登记。MDX 是仓库编辑契约，不是执行不可信输入的沙箱。

普通外链须为没有凭据的 HTTPS URL；内部链接、完整解码后的锚点、AboutLink 和 related 目标必须已存在。slug/id 直接校验原始 ASCII kebab-case 值，不自动修剪空格，防止校验结果与静态 JSX 渲染值不同。公开条目不能引用草稿；草稿仍需有效字段和存在的引用。加入入口只能用于 active 社区，且目标只能为现有 `/communities/rifling-911` 或 HTTPS 地址；正文与 joinUrl 均不接受已退役的 `/join/rifling-911`。

图片放入该集合 assets 目录，提供非空 alt 与正整数宽高。路径不能跳出资源目录；替换失败的图片仍显示 fallback。发布前由作者核对真实比例、版权与图注，不把宽高存在校验当作图片内容验收。

执行 `pnpm --filter @workspace/web content:check` 检查已注册集合；真实编译与前端验证使用 `pnpm --filter @workspace/web build` 和项目测试流程。

### 历程章节与照片

`story.mdx` 使用 `Timeline > StoryChapter > Milestone`，不要在这三层之间插入 Callout 或 Markdown 段落包装；事件正文可以继续使用普通 Markdown 和已登记作者组件。章节与事件组件仅属于 Story；构建检查会拒绝无法渲染的嵌套。旧的 `Timeline > Milestone` 直接结构仍兼容；事件的开始标签、正文和结束标签分别写在独立行，避免 MDX 将行内事件包成段落。

Timeline 可填写 `headline`、`eyebrow`、`note`，标题支持 `\n` 换行。StoryChapter 的 `yearLabel` 是非空字符串；照片填写 `photos`（一至两项集合 ImageRef），素材缺省时可以填写 `placeholderPhotos={1}` 或 `{2}`，两者不能同时使用。照片资源仍遵守本页的 assets 边界；不填两者时显示整理中提示。Milestone 继续使用唯一 `id`、`title`、`dateLabel` 与可选 `image`、`related`。当前年份、正文和图片均明确标为占位，替换时维护真实事件及旧 id 的链接兼容性。渲染与交互见 `.ai/architectures/web/content-rendering.md`。

### 团队人物与招募入口

团队页文案由 `apps/web/content/about/team.mdx` 维护。基础 `title` 仍用于文档标题与面包屑；可选 `showcase.headline`、`showcase.lead` 用于人物章节的展示标题和引言。`recruitment` 维护左侧说明、协作亮点及右侧入口文案，字段以 `teamSchema` 为准；其他栏目不接受这些字段。正文保留明确的占位说明。可用 `/aboutus/team#join` 链接至招募章节，其他未知模板锚点仍会报错。

人物展示单独编辑 `apps/web/public/config.json` 的 `teams`，数组顺序就是选择顺序。每项使用唯一 ASCII kebab-case id，提供 name、role、bio、strengths 和 theme；图片 avatar、portrait 可省略，缺省或加载失败显示普通占位。左侧资料依次展示职责与简介，右侧展示能力。空数组或缺省 teams 显示整理中状态，招募章节仍保留。这份展示配置不会创建旧 MDX 成员条目或个人路由；需要 Media 的成员引用时，继续维护 `apps/web/content/about/members/`。

照片仅使用 `/images/team/` 下的公开资源，附非空 alt 和正安全整数宽高；路径不能带查询、fragment 或越界，开发启动与构建会检查文件和 realpath。背景与强调色为六位不透明十六进制值，与白色正文的对比度须达到 4.5:1；点颜色可使用六位或八位值，默认白色半透明填充和白色描边。团队项及嵌套对象严格拒绝未知字段；公开配置的既有 community 等字段继续保留。此文件所有内容都会公开，只放已获准公开的资料。

实际招募入口填写可选 `teamRecruitment.url`：无凭据 HTTPS、已登记的站内地址，或严格限定的 QQ 聊天地址 `tencent://message/?uin=<QQ号>&Site=qq&Menu=yes`。QQ 号须为 5 至 12 位非零开头数字，不接受其他客户端协议或附加参数；QQ 链接直接交给浏览器唤起本机客户端，不打开空白标签页。缺省、空字符串或仅空格时显示禁用按钮；非法非空值使校验失败。不要用团队页自身的 hash 冒充报名地址，也不要把玩家申请或社区链接当成开发团队招募渠道。站内入口由 Router 导航，HTTPS 外链在新标签页打开并隔离 opener；此页不收集报名数据。

JSON 修改使用 Vite 原生 HMR，当前成员 id 仍存在时保持选择；非法配置显示开发错误。`content:check` 检查 MDX 文案与作者链接，公开 JSON 和照片另由 Vite 启动／构建校验。发布前还需执行 Web 类型检查、对应测试和 Web 构建；Shader 与实际锚点几何须用真实浏览器验证。

## 编辑 Support

内容源位于 `apps/web/content/support/`；`settings.yaml` 与 `contacts.yaml` 必须存在。没有已确认资料时保留 `categories: []`、`clickup: null` 与 `items: []`，不发布设计预览中的案例或人物。字段以 `apps/web/build/support/schema.ts` 为准，完整内容投影以 `apps/web/build/support/definition.ts` 为准。

错误正文放在 `errors/<slug>.mdx`，basename 与原始 kebab-case slug 一致。title、description、category 和 quickAnswer 必填；category 引用设置中的分类。quickAnswer 是独立纯文本，不从正文截取。order 为非负安全整数；featuredOrder 仅允许 1、2、3，草稿也参与精选位置唯一性检查。draft 条目仍校验字段、分类、资源与引用，但不进入公开元数据、正文 loader 或独占资源映射。

正文支持标准 Markdown、Callout 与 ContentImage，不支持 About 专属组件。内部目标仅允许支持首页、列表、实际错误详情与有效正文锚点；公开错误不能链接草稿。联系人可有本集合头像、数字文本 QQ 与单一邮箱，缺失联系方式时不生成按钮。图片作者规范沿用上文。

开发面板使用 `settings.yaml` 中的 `clickup.game`、`clickup.community` 与 `clickup.requestBucket`；三项都必须提供非空 `title`、HTTPS `embedUrl`，可选 `publicUrl` 用于面板下方外链。当前配置使用用户提供的三个 ClickUp 官方分享视图；尚未配置时，整个 `clickup` 保持 null。不能在 YAML 中粘贴 iframe HTML、脚本或扩展来源清单。来源策略、切换与会话边界见 `.ai/architectures/web/content-rendering.md`。

需求桶拥有独立的 `embedUrl` 与可选 `publicUrl`，不再在游戏、社区视图中维护 `requestBucketUrl`。缺少需求桶视图时内容校验失败；缺少 `publicUrl` 时仍展示嵌入面板与重试提示，不生成外链或以其他视图的网址替代。

## 增加其他内容栏目

1. 为新业务创建内容目录与 schema/定义，复用 `ContentDefinition`，给出独立 namespace、文件分类、组件属性检查和公开投影。业务引用规则留在该适配器中。
2. 在 `apps/web/build/collections.ts` 注册定义，在 `apps/web/source.config.ts` 显式导出相应 Fumadocs 集合。配置文件变更按 Vite 提示重启开发服务。
3. 声明 `virtual:content/<namespace>` 的浏览器类型，通过 `createContentStore(loaders)` 与 `useContent` 加载正文。复用 `createMdxComponents`，注入本业务链接、资源和特殊组件。
4. 在 Web 中定义页面与导航，不把路由或交易数据放入通用组件。为该集合添加字段、引用、草稿和实际编译测试。

新栏目不必复制 About 编译器、代码块或加载状态机。模块边界见 `.ai/architectures/web/content-rendering.md`；About 首页布局以 `.notes/about-us/specs/2026-10-12-about-us-refined-design.md` 为准。
