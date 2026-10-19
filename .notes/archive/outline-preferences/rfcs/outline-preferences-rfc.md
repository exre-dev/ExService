# RFC：Outline 中文默认与 Website 主题统一

- 日期：2026-10-05
- 状态：实施提案；来源设计已获用户批准，本 RFC 尚未实施
- 模块根目录：`.notes/outline-preferences/`
- 来源设计：`.notes/outline-preferences/specs/2026-10-05-outline-preferences-design.md`
- 适用入口：Website 公共 origin 下的主站和 `/docs`

## 1. 决策摘要

集成 Outline 使用主站现有的浏览器主题键 `theme`，在同源标签页之间双向同步浅色、深色和跟随系统。保留主站当前的黑白品牌覆盖，把已有覆盖集中为一份 CSS 源，让 Outline 的标准 ExUI token 适配器读取同一组有效语义值；集成模式不再采用手机纯黑或工作区品牌覆盖。

集成界面默认简体中文，新集成用户明确使用 `zh_CN`；已有账号保留语言。公共界面接入 i18n，匿名与退出后的界面回到中文。所有变更均保持 Outline 独立 Git/Yarn 应用边界，不新增 HTTP operation、数据库字段或 migration。

## 2. 验证事实与范围细化

| 来源                                                                          | 事实与约束                                                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/main.tsx`、`packages/components/src/ThemeToggle.tsx`            | 主站由 ExUI provider 驱动三态主题。安装实现使用原始字符串 `theme`，支持其他文档的该键存储事件。                            |
| `apps/web/src/styles/index.scss`                                              | 主站另有黑白品牌覆盖：主色、交互状态、链接、placeholder、次级文字、焦点边框/阴影和侧栏别名。                               |
| 两边的公开 `@exre/exui/tokens` 和 CSS 入口                                    | 本次只读比较中，浅色/深色 token 差异数量为零；组件样式表、token 样式表内容也完全相同。仍需在实施时复核。                   |
| `apps/outline/shared/styles/exuiTheme.ts`                                     | 标准 token 的主色是蓝色；已有适配器会将其映射到 legacy 字段、语义对象和 recipe。只取消工作区覆盖仍不足以匹配主站黑白配色。 |
| `apps/outline/app/stores/UiStore.ts`                                          | 当前主题来自 `UI_STORE.theme`，有独立存储事件处理和系统媒体查询。                                                          |
| `apps/outline/app/hooks/useBuildTheme.ts`                                     | 手机深色选择 `pitchBlack`；查询参数覆盖会进入 `themeOverride`。                                                            |
| `apps/outline/server/static/index.html`                                       | 首屏脚本已读 `theme`，但使用旧硬编码背景，未完整解析跟随系统。                                                             |
| `apps/outline/app/components/Authenticated.tsx`                               | 当前账号语言切换仅在受保护路由的包装器里执行，公共页不能依赖它。                                                           |
| `apps/outline/app/scenes/WebsitePublic.tsx`                                   | 导航、搜索、评论、错误、空结果和身份状态提示包含英文常量。                                                                 |
| `apps/outline/i18next-parser.config.js`、`apps/outline/shared/i18n/README.md` | 英文 catalog 由提取工具生成，locale 文件禁止手改。                                                                         |
| 当前安装的 i18next                                                            | 只读探针确认：英文 fallback 会先于中文 `defaultValue` 命中；调用选项 `fallbackLng: []` 可保证缺失中文键使用中文回退。      |

共享 CSS 是对“配色与主站一致”的实施细化：移动主站已有覆盖，不增加第二份颜色常量、不改变主站当前视觉、不新建命名 token 层。来源 spec 保留原文，本 RFC 补充此前未完整核对的主站覆盖事实。

## 3. 目标、兼容与非目标

1. 浏览器允许 localStorage 时，主站和集成 Outline 在同一 origin 下使用同一个主题偏好；刷新、跳转和恢复后仍一致。
2. 桌面/手机、匿名/登录界面使用同一标准深浅色组和主站品牌覆盖；菜单、文字、焦点、控件状态均按共享语义显示。
3. 英文浏览器的匿名文档页仍默认中文；新账号中文；已有英文账号仍英文；退出后恢复中文。
4. 打印浅色且不持久化；独立 Outline 的主题查询参数、手机纯黑、工作区品牌配置和语言策略不变。

跨设备、不同端口或主机名的同步不在范围内。文档正文和用户内容不翻译。主站 ExUI provider 的全站存储禁用兼容改造不在范围内。没有数据库回填、账号语言批量修改、权限或认证行为变更。

## 4. 组件与接口

以下为拟新增内部接口，不是已有导出。代码遵守 Outline 的类型、JSDoc 与既有格式约定。

| 拟新增位置                                                   | 责任及接口契约                                                                                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/outline/app/utils/websiteThemePreference.ts`           | 定义共享键；`readWebsiteThemePreference()` 返回三态，异常/缺失/非法为 `system`；`writeWebsiteThemePreference(theme)` 返回写入是否成功；`subscribeWebsiteThemePreference(onChange)` 返回清理函数。 |
| `apps/outline/app/components/WebsiteThemePreferenceSync.tsx` | 集成模式挂载一次订阅，变化时调用只更新内存的 UiStore action；StrictMode 清理及重复挂载必须安全。                                                                                                  |
| `apps/outline/shared/styles/websiteTheme.css`                | 主站已有黑白覆盖的唯一 CSS 源；只使用现有公开 ExUI 变量与别名。                                                                                                                                   |
| `apps/outline/app/utils/websiteThemePalette.ts`              | 读取共享 CSS 中受覆盖的语义变量，输出有类型的浅色/深色覆盖对象，供纯主题构建函数使用。                                                                                                            |
| `apps/outline/app/components/WebsiteLanguageProjection.tsx`  | 根级语言投影：观察已验证登录态/账号语言，统一切换 i18n，覆盖公共页、工作区和退出后的匿名页。                                                                                                      |
| `apps/outline/app/utils/websitePublicTranslation.ts`         | 为项目特有英文 literal key 提供当前 locale 的回退选项；复用已有翻译时不经过该辅助模块。                                                                                                           |

主题适配器不依赖认证资料或服务端请求。语言投影只读当前 auth 状态，不保存资料或改变登录流程。共享 CSS 不 import React、API client 或路由，不要求 Outline 安装 `@workspace/components`。

## 5. 浏览器主题协议

### 5.1 初始化与持久化

- `theme` 的合法值为不带 JSON 引号的 `light`、`dark`、`system`。
- UiStore 初始化时在集成模式读共享键；独立模式继续读 `UI_STORE.theme`。此处使用公开环境标记，不访问尚未完成初始化的 `rootStore.auth`。
- 集成模式的 `setTheme` 保留现有切换动画，并先更新本页状态，再写共享键；写入失败不回滚本页选择。
- 集成模式处理旧 `UI_STORE` 的存储事件时跳过主题字段，其他侧栏/目录属性保持原逻辑。保存其他 UI 属性不能回写共享主题。
- 不迁移旧 Outline 主题、不删除旧数据；它仅在独立模式仍有意义。
- 新增同步 action 仅更新内存，不能复用有持久化副作用的 `setTheme`，避免循环写入。

### 5.2 订阅、竞争与恢复

新订阅由根级 `WebsiteThemePreferenceSync` effect 管理；挂在 store provider 内、主题消费树的稳定位置，每次挂载先核对当前值。监听共享键的 `storage`、`pageshow`，以及文档从隐藏恢复为可见；清理移除这些新增监听。`localStorage.clear()` 的 `key === null` 事件可触发重新读取，最终解析仍为 `system`。

存储事件须核对真实 storageArea，仅通知重读当前共享键，不相信可能已过时的 `newValue`。最后一次存储写入决定最终偏好；非法值解析为 `system`。读取、写入、取得 storageArea 可能抛错，适配器捕获异常；读失败为 `system`，写失败返回 false，不抛出阻断页面的异常。

主站现有 ExUI provider 可覆盖一般双向切换。如果并发写入或页面恢复测试证明 provider 仍使用迟到事件/旧状态，则在 `apps/web/src/settings/WebsiteThemePreferenceReconciliation.tsx` 加入消费方补偿：通过公开 `useTheme` 在 provider 更新后的 effect 和恢复事件中重读共享键；仅在合法共享值与当前状态不同，或当前状态需要回到 `system` 时调用公开 `setTheme`。合法值写入与当前存储相同，不产生新存储事件；已一致时绝不调用 setter。补偿不替换 provider，不 import ExUI 私有实现。删除/清空后的补偿允许重新持久化规范值 `system`，页面结果必须与无偏好时相同。

主站如无需补偿则不新增该组件；必须通过延迟事件和页面恢复测试给出证据，而不是只证明普通菜单点击。

## 6. 配色统一的实现约束

### 6.1 单一覆盖源与应用接线

把 `apps/web/src/styles/index.scss` 里已有的品牌 token 覆盖及对应别名移至 `apps/outline/shared/styles/websiteTheme.css`；原文件保留 color-scheme、布局和其他站点样式。共有覆盖挂在专用标记类 `website-theme-profile`，深色挂在该类与 `dark` 的组合选择器；不使用会影响独立 Outline 的无条件 `:root` 覆盖。

主站在根节点添加此稳定标记，并在 `apps/web/src/main.tsx` 的 ExUI 样式之后导入共享 CSS。跨目录 import 仅是无运行逻辑的 CSS 资源；不 import Outline 应用或 store。相应 Vite 读取允许范围仅增加共享样式目录，不放开任意文件访问。Website 构建现在依赖已存在的 Outline submodule 中这份 CSS，必须在构建前核对该文件存在。

Outline 在 `apps/outline/app/index.tsx` 以公开入口导入一次 ExUI token CSS，再导入共享覆盖 CSS，保留现有字体导入；不导入 ExUI React 组件总样式或第二套 provider。只有集成模式添加标记类并更新 `light`/`dark` 类；独立模式新增共享覆盖不生效。新增 token CSS 是否影响独立编辑器必须做回归，必要时将该资源按集成模式加载，但不能让独立模式缺失构建输入。

共享文件位于 Outline submodule 内，使 Outline 独立 build 与容器 build 不依赖父仓库文件。根 `Dockerfile` 的构建上下文已有 `COPY . .`，`.dockerignore` 没有排除 Outline 的 `shared/`，可把 CSS 一并送入 Website 构建；实施时验证实际派生 runtime Dockerfile 和构建上下文仍满足这一点。

### 6.2 解析及纯构建函数

在浏览器 layout effect 中使用临时、不可聚焦、无语义的探测元素，分别应用 `website-theme-profile` 与浅色/深色类。读取共享覆盖负责的少量 CSS 变量，随后移除探测元素。不得改变 document 的全局主题来测量另一种配色；不得把主题 GlobalStyles 的镜像输出当作覆盖来源。共享选择器的特异性需高于 `html` 镜像，避免被旧主题反馈污染。

只读出本次已有覆盖的变量：control primary/foreground/hover/active/selected/focusRing/linkHover/linkActive，text link/placeholder/tertiary，border focused，shadow focus，以及侧栏 primary/foreground/ring。其他 token 继续使用标准 ExUI 组。按字段类型构建覆盖对象，空值或缺失值视为接线失败：保留可渲染的标准组作为降级，但该场景不能通过配色验收。

`apps/outline/shared/styles/exuiTheme.ts` 增加显式、可测试的 effective-token 输入或内部构建函数；在解析 legacy 字段、semantic 字段与 recipe 之前应用覆盖。不能只修改最终 `theme.accent`，否则菜单、焦点和控件状态仍会分叉。需要颜色计算的代码接收解析后的颜色值，不把 `var(...)` 交给 `polished`。

同一 CSS 源提供解析值，不复制主站色值到 TypeScript。浅色/深色覆盖在首次布局阶段就绪，初次 paint 前更新主题；其后按 UiStore 状态选择已经解析的组，不在每次 render 读布局。主站与 Outline 使用不同的运行期驱动，但渲染相同的受覆盖语义值。

### 6.3 覆盖优先级与打印

集成普通页面忽略工作区 `CustomTheme` 和查询参数 `theme`；`themeOverride` 不能残留影响 `resolvedTheme`、菜单或键盘快捷键。手机深色走标准 `buildDarkTheme`；独立模式保留原路径。

显式打印/导出渲染使用局部浅色或调用方主题，不写全局存储。打印背景与原生控件继续由 `PageTheme` 同步处理，结束后恢复共享主题。打印时共享标记的深色覆盖也应临时切回浅色，使 CSS 控件与 styled-components 一致；不能将此行为持久化为 `light`。

## 7. 首屏模板

`apps/outline/server/routes/app.ts` 在集成模式下，从公开 ExUI token 取得标准 light 和 dark 的 background。注入最小安全 palette 到已有带 CSP nonce 的环境脚本，JSON 序列化并转义 `<`；不含配置秘密、不接受工作区可注入 CSS。模板只使用该 palette 处理背景，不需要在服务器读取 CSS 或 localStorage。

`apps/outline/server/static/index.html` 的现有首屏脚本在集成模式安全读取共享键，解析 system 媒体查询，设置根节点颜色类/共享标记、body 和 root 背景、theme-color 和 color-scheme。存储不可访问时仍能按系统/浅色 fallback 渲染。脚本运行先于应用模块；独立模式原分支保持兼容。服务端初始界面语言属性使用有效 `zh_CN` 的 BCP47 表达，客户端账号语言投影随后负责更新。

当前主站品牌覆盖没有改变 surface.background，因此首屏直接使用标准 background token 与运行期背景相同。若实施时该事实变化，必须扩展同一覆盖来源的背景方案，不能重新加入硬编码颜色。

## 8. 语言规则与文案

### 8.1 有效默认与账号

`apps/outline/server/env.ts` 在集成标记启用时的有效 `DEFAULT_LANGUAGE` 固定为 `zh_CN`，并经既有公开环境 presenter 提供给客户端；独立模式保持原环境配置和 fallback。新集成账号在 `apps/outline/server/identity/websiteProvisioner.ts` 的创建字段明确写入有效默认语言，避免依赖可能仍为英文的物理数据库默认值；已有账号的同步 update 不写 language。

根级 `WebsiteLanguageProjection` 仅在集成模式工作：有效已验证账号有语言时使用经既有 `resolveLanguage` 规范化的账号语言，否则使用公开默认。缓存账号未验证时不把它当作语言权威。监听账号切换、语言修改、退出和失效后状态变化，并通过 `changeLanguage` 更新 i18n、`documentElement.lang` 与方向。

现有 `Authenticated` 的语言 effect 在集成模式不再另行切换；独立模式保持。`Login`、`WorkspaceSetup`、`TeamSwitcher`、`OAuthAuthorize` 和 `Shared` 中的浏览器语言覆盖在集成模式跳过，不能晚于根级投影又改回英文。不全局改变 `detectLanguage` 的含义，它仍服务于独立模式及语言建议。语言建议不得自动保存或改变现有账号设置。

异步语言切换需要按最新期望值收敛：串行执行或使用世代检查；旧账号的加载完成不能让退出后的公共页停留在英文。翻译文件 URL 继续通过现有 CDN/publicPath 解析，保持 `/docs` 挂载行为。

### 8.2 公共文案

`WebsitePublic` 的每个界面子组件使用 `useTranslation`。已有完整中英键直接使用英文 literal key。初始化尚未完成、身份不可用但公开文档仍可读、评论提交失败等特有语义使用项目辅助选项，按钮事件与状态分支不改变。

拟定辅助接口接收当前 i18n 语言以及调用点的英文/中文回退文案，返回 `defaultValue` 和 `fallbackLng: []`。中文规范化为 `zh-CN`；英文或不支持语言使用英文回退。调用仍保持静态英文 literal key，例如身份状态提示的英文原文，保证提取工具能发现。helper 不隐藏或拼接翻译键，不修改 i18n 全局 fallback，不另建资源 catalog。

辅助 options 里的 defaultValue 根据当前语言计算，提取工具无法静态求值时使用英文 key 生成 en_US catalog。验证提取结果确实如此，不把中文写入英文 catalog，不手改生成文件。新增英文键只能由既有工具生成；中文依靠调用点回退即可正确展示，不依赖 CrowdIn 上线或外部发送消息。

所有按钮、aria-label、placeholder、加载、空状态和错误提示都纳入检查；文档标题、正文、评论内容和用户名称保持原数据。

## 9. 落地顺序与精确变更

| 顺序 | 变更路径                                                                                                                                                                                                                                                       | 落地责任与前置条件                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | `apps/outline/app/utils/websiteThemePreference.ts`、`apps/outline/app/stores/UiStore.ts`、`apps/outline/app/components/WebsiteThemePreferenceSync.tsx`、`apps/outline/app/index.tsx`                                                                           | 建立偏好协议和根级生命周期；先证明旧存储不会覆盖共享值。 |
| 2    | `apps/outline/shared/styles/websiteTheme.css`、`apps/web/src/styles/index.scss`、`apps/web/src/main.tsx`、两边 Vite 配置中必要的精确允许范围                                                                                                                   | 移动已有覆盖，主站视觉保持；不改依赖或 lockfile。        |
| 3    | `apps/outline/app/utils/websiteThemePalette.ts`、`apps/outline/shared/styles/exuiTheme.ts`、`apps/outline/app/hooks/useBuildTheme.ts`、`apps/outline/app/components/Theme.tsx`、`apps/outline/app/components/PageTheme.ts`                                     | 解析共享覆盖、统一主题优先级和打印；无纯黑集成路径。     |
| 4    | `apps/outline/server/static/index.html`、`apps/outline/server/routes/app.ts`                                                                                                                                                                                   | 首屏配色、语言与 CSP；既有非集成分支保持。               |
| 5    | `apps/outline/server/env.ts`、`apps/outline/server/identity/websiteProvisioner.ts`、`apps/outline/app/components/WebsiteLanguageProjection.tsx`、`apps/outline/app/utils/language.ts`、`apps/outline/app/components/Authenticated.tsx`、相关 Login/Shared 入口 | 新账号中文与唯一语言投影，防止匿名浏览器覆盖。           |
| 6    | `apps/outline/app/scenes/WebsitePublic.tsx`、`apps/outline/app/utils/websitePublicTranslation.ts`、工具生成的英文 catalog                                                                                                                                      | 公开界面与完整状态文案翻译；只由工具生成 catalog。       |
| 7    | 上述新文件的相邻测试及已有 `apps/outline/app/utils/i18n.test.ts`、`apps/outline/shared/styles/exuiTheme.test.ts`、`apps/outline/app/scenes/WebsitePublic.test.tsx`；必要的主站主题补偿文件和相邻测试                                                           | 自动验证、类型/构建、真实浏览器验收。                    |

变更是一组协同交付，不在中间版本声称主题一致已完成。代码改动后按仓库规则更新证据支持的持久知识；设计阶段尚未批准向 `.ai/` 提炼，本 RFC 不写入 `.ai/`。

## 10. 验证策略

本次没有执行产品测试；下表定义实施后的必需证据。根与 Outline 当前均未找到 `TESTING.md`，实施开始前再次检查，若新增则以其为准。Outline 使用现有 Vitest app/shared 项目和相邻测试，不创建新测试目录，不运行整个 server suite。

| 层               | 断言                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 偏好单元/UiStore | 无值、非法值、删除、清空、读写异常；原始字符串格式；不迁移 UI_STORE；延迟事件重读最新值；只更新内存不回写；恢复事件与清理；独立模式保留。                 |
| 主题适配         | 共享覆盖作用于 legacy、semantic、recipe；浅/深 primary、foreground、hover、active、link、focus、placeholder 与主站有效 CSS 相同；局部导出与打印不写存储。 |
| 模式/viewport    | 集成手机无 pitchBlack；查询和 CustomTheme 不覆盖集成主题；独立模式原行为仍在。                                                                            |
| 首屏             | 真实模板执行在缺失/浅/深/system 情况选择正确背景；存储抛错不阻断； nonce 保留、注入安全；首屏背景等于挂载后的 token。                                     |
| 语言             | 新集成账号默认中文；资料更新不改已有 language；匿名英文浏览器中文；已有英文账号英文；退出中文；并发切换收敛；HTML lang/dir 同步。                         |
| 公共页面         | 真正载入中英资源；菜单/搜索/阅读/评论及错误提示中文；切英文后无中文残留；缺失中文键即使有英文 fallback 也能显示中文回退；功能/权限分支不变。              |
| 提取             | 英文 literal key 可提取；英文 catalog 没有中文 defaultValue；中文 catalog 没有手工 diff；提取只影响本次新增键，广泛删键时停止调查。                       |
| 跨应用浏览器     | 同源两个标签页双向三态、系统偏好、刷新/导航/恢复、手机和打印；以实际 computed style 与截图证明配色，不只比较源码值。                                      |

定向 app/shared 测试从 `apps/outline/` 执行 `corepack yarn test <具体测试文件>`；类型检查用该应用的 `corepack yarn tsc --noEmit`。前端构建用 `corepack yarn vite:build`，服务模板/环境改动另执行 `corepack yarn build:server`。生成英文 catalog 使用现有 i18next CLI 的参数和配置；不因为生成翻译而执行 Unix `cp` 脚本或全量不必要 build，Windows 下沿用项目可用的构建入口。

新账号真实创建若需要 server/database 测试，使用 `scripts/docs-integration/test-outline.mjs` 的显式文件与 literal case 选择、一次性 PostgreSQL/Redis，不借用开发库。应同时检查创建参数及实际生成用户 language，避免 ORM 默认值掩盖创建逻辑遗漏。

主站源码接线变更后运行根工作区 `pnpm typecheck` 和 `pnpm build`，以及实际新增/受影响的主站组件测试。本次无 API 变更，不运行 api:generate 来产生无关 diff。实际容器构建与运行验收分开记录；不能以宿主构建替代 full 上下文证据。

真实浏览器验收使用已准备的公共入口；不因本任务自动 configure/init/bootstrap、迁移、reset、重建卷或选择管理员。未准备好时保留自动验证证据并将真实验收记为阻塞/未执行。

## 11. 风险、上线和回滚

| 风险                                    | 处理与发现方式                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| token 相同但主站有覆盖                  | 共享现有覆盖源；浏览器比较实际变量及控件状态。                                             |
| 跨 submodule CSS 消费遗漏               | CSS 位于 Outline 自身上下文；主站构建前核对 submodule 文件；验证宿主和真实 full 构建输入。 |
| 根类、CSS 镜像和 styled-components 打架 | 专用标记/精确选择器、纯 token 输入；不从镜像读取源；测试浅深切换与打印。                   |
| 翻译请求竞争或英文 fallback 遮蔽        | 唯一语言投影、最新目标收敛、局部 fallbackLng 空数组；覆盖退出和错误状态。                  |
| StrictMode 或页面恢复重复订阅           | effect 清理和重读当前值；测试挂载/卸载、恢复及无循环写入。                                 |
| 本地 token 产物变化                     | 实施时复核公开导出与 CSS；不自动重写链接或升级 ExUI。                                      |

当前只交付设计，不部署上线。将来实施须作为同一变更集同时交付主站 CSS 接线与 Outline 适配；主站 `theme` 格式不变，滚动期间旧 Outline 仍可能使用自己的主题，完成后必须刷新旧页面。

回滚代码时保留共享 `theme`，不删除存储或账号数据。独立 Outline 的旧 UI_STORE 保留原值；集成后新账号保存的中文是用户数据，代码回滚不批量恢复英文。没有 schema migration，因此不需要数据库回滚。若创建 Git 提交，遵循独立 submodule 和父仓库的贡献规则，当前任务没有提交/推送授权。

## 12. RFC 自检与剩余工作

本 RFC 已对照来源设计、应用边界、当前源码和技能质量清单检查；未改写来源 spec。无待定架构决策或占位符。共享 CSS 位置、主题协议、语言所有者、翻译回退、验证和回滚已明确。

实施时仍须验证真实 CSS 计算、完整提取结果、浏览器首屏和服务器新账号路径；本次只读探针不证明这些产品行为已经完成。是否需要主站补偿组件是由第 5.2 节规定的确定性测试决定的局部实现分支，不重新选择存储方案。

设计流程在本 RFC 交付后结束，不自动实施。
