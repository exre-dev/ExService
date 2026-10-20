# `web` 模块：社区入口、邀请注册与认证 UI

本文件说明共享认证 UI、应用流程和浏览器存储之间的边界。HTTP operation 与字段形状以 `api/openapi.yaml` 和 SDK 生成类型为准。

_最后更新：2026-10-19_

## 责任分层

```text
packages/components
  登录与邀请表单 / AuthModal
          ↑ props 与回调
apps/web
  AuthFlow / InvitationRegistrationFlow / AuthProvider / 路由页面
          ↓
  @workspace/sdk
```

共享组件只管理字段、校验、焦点和可访问状态。它不读取浏览器存储、不调用 API、不决定导航。`apps/web` 负责请求分支、token 生命周期、SSO 上下文和整页跳转。设置 Modal 与 `/account/profile` 通过同一个设置控制层读取、更新及上传本人资料，界面由共享组件接收值和回调。

登录与邀请注册表单使用 React Hook Form 与 Zod；服务端字段错误通过 `setError` 展示。`AuthForm` 只分派登录与图片验证码步骤；邀请的邮箱、数字码和完善资料各有独立表单。登录中的 Google、QQ 入口仅为禁用占位，不发请求，也不代表已经接入第三方认证。

普通登录与 SSO 密码登录先在凭据表单点击“继续”，再于同一认证容器切换到图片验证码步骤。该步骤目前只显示矩形图片占位与可留空的输入框，明确提示尚未启用校验；点击“登录”时才由 `AuthFlow` 调用对应 operation，不附加伪造的验证码凭证。邀请注册不经过这个占位步骤。

## 入口与容器

- 顶栏登录与注册使用受控 Modal；关闭会卸载当前流程。
- `/login` 使用 `AuthFlow`，`/register` 使用 `InvitationRegistrationPage`；两者位于 `RootLayout` 之外，不渲染站点顶栏或认证 Modal，复用认证背景与外围容器。
- 顶栏桌面与移动注册入口挂载同一个 `InvitationRegistrationFlow`；完成后在原 Dialog 切到普通登录。关闭按当前桌面或移动触发器恢复焦点。
- `/communities` 默认跳转至 `/communities/rifling-911`；社区页面 `/communities/rifling-911`、`/communities/caep` 位于 `RootLayout` 内。登录的加入回调先关闭 Dialog，再前往 `/communities/rifling-911`。顶栏不再提供 Join；Products 使用 `/products`，该内容页尚未实现。
- `/sso/success` 与 `/sso/*` 的兜底页面也位于 `RootLayout` 之外，不渲染站点顶栏；认证页面代码集中在 `apps/web/src/pages/AuthPage/`。
- 普通独立认证页通过左上角 Home 返回首页；带 `ssoRequestId` 的登录页面隐藏该入口。独立认证页与 SSO 成功页复用 `MeshGradient` 背景，共享组件不依赖着色器。
- 登录入口只要 URL 中出现 `ssoRequestId`，就必须通过格式与单值检查；空值、重复值或非法值显示无效入口，不能回退成普通登录。

图片验证码的取图与提交字段已在 Contract 中预留，真实校验启用前须单独决定有效期、重试规则以及要求凭证的版本策略。

## 社区展示与邀请注册

社区页面保留介绍、既有图片和配置中的外部社区入口，不挂载在线申请表单。旧 `/join/rifling-911`、`/join/result` 和 `/admin/join-applications` 返回现有 404；通知正文也不再允许链接到旧 Join 页面。

申请提交、结果查询、审核、邀请重发及申请附件下载的八个 HTTP operation 已退役。既有邀请注册仍通过 `/auth/invitations/*` 工作；历史申请与邀请数据、内部服务和读取历史资料所需的 schema 保留，数据职责见 `.ai/databases/data-model.md`。

Hero 图片继续来自 `apps/web/public/images/heros/join/rifling-911/`。构建时按文件名排序收集支持的图片格式；多张图片时点击背景循环切换，也支持聚焦背景后按 Enter 或空格，不显示独立切换按钮；单张图片作为静态背景。

`InvitationRegistrationFlow` 在应用层控制 email、code、profile、registered 四个状态。邮箱通过只读资格检查后才挂载空验证码表单；检查不请求发码。验证成功取得完善凭证才挂载用户名与密码表单，邮箱只读，QQ 来自申请。主动重发使用服务器时间差计算冷却，采用条件式发送反馈；验证的失败重试由用户输入或显式重试按钮触发，不由渲染循环驱动。

独立页纯读取一次 URL 入口快照。合法 email 只预填，合法 email/code 才自动检查后验证；非法或重复参数不请求。passive effect 删除所有 code 参数并保留 `history.state`。自动链 Promise 与响应订阅分别保存：StrictMode 重新订阅同一次请求，实际返回、修改邮箱或卸载则拒绝迟到结果和通知。数字码、密码和完善凭证只在内存保存，返回或关闭清理，不写日志、路由 state 或浏览器存储。

邀请流程按 `sessionScopeRevision()` 绑定 API 范围，每次发送和接收结果时均核验。实际切换 root 会重建流程及其 RHF 表单，清理旧验证码、完善凭证、密码、错误交接与导航计时器，回到邮箱步骤要求重新验证；旧自动链不能继续向新 root 发请求。规范化后等价的 root 不重建流程。

注册成功清空敏感材料并使用 `toast.info` 提示，随后一次性前往普通登录。页面 replace 到 `/login`，只用内存路由 state 传邮箱；弹窗切换原容器。手动前往登录或卸载清理自动切换计时器，不创建会话，不带入 SSO 上下文。资格检查与持续错误的通知规则统一见 `.ai/rules/frontend-notifications.md`。

入口 `apps/web/index.html` 在所有脚本和资源声明之前设置 `no-referrer`，避免邀请 URL 的邮箱和数字码进入资源请求的 Referer。Vite 会在该 meta 前注入开发脚本，因此 `apps/web/vite.config.ts` 还为本地开发服务设置 `Referrer-Policy: no-referrer` 响应头。URL 清理发生在 React 挂载后，不能替代加载前的入口策略；这些策略不会隐藏原始入口请求 URL。

邀请注册的持续错误由所属 RHF 表单持有，根错误展示与跨步骤挂载交接见 `.ai/knowledge/web/invitation-error-handoff.md`。

## 本站会话

### API root 与持久凭据

Web 的 `apps/web/src/auth/storage.ts` 按当前选中的 API root 管理 `localStorage` 凭据。`apps/web/src/api/client.ts` 的 `installSdkIntegration()` 在首个请求和 React 挂载前先调用 SDK `setBaseUrl` 验证 root，再由 `selectSessionScope()` 选择存储键；非法 root 不改变原来的应用范围或释放原集成。未设置或为空的 `VITE_API_BASE_URL` 显式选择当前 origin `/api`，从自定义 root 返回默认值也会重新设置。

通过 SDK 校验后，应用以 `new URL(baseUrl, window.location.origin).href.replace(/\/+$/, '')` 取得规范化 root，并选择以下键：

| 规范化 root        | `localStorage` 键                                               |
| ------------------ | --------------------------------------------------------------- |
| 当前 origin `/api` | 保留既有 `exwebsite.auth.token`                                 |
| 其他 origin 或路径 | `exwebsite.auth.token:` 加 `encodeURIComponent(normalizedRoot)` |

相对地址与等价绝对地址、尾部斜杠的不同写法共用同一键；不同 origin 或路径各自保存。自定义 root 不读取、复制或迁移旧默认键，也不删除其他 root 的凭据。升级前若自定义 root 的用户只有旧默认键，须在所选自定义 root 重新登录一次；之后可从该 root 的专属键恢复。

SDK 自身仍只在默认 root 自动逐请求读取旧键；非默认 root 只接受显式内存凭据，完整规则见 `.ai/architectures/sdk/client-boundaries.md`。Web 的 `syncSessionToken()` 在启动时读取当前自定义 root 的有效持久 token，再通过 `setAccessToken()` 显式安装到 SDK，并记录该值的存储归属。这是应用适配层的恢复行为，不增加 SDK 自动存储来源。默认 root 的正常同步保留 SDK 自动读取；只有已存在退出或失效抑制时才显式覆盖为空。

### 登录、同步与失效

普通登录成功后，若当前键仍保存另一账号的 token，先撤销旧会话；明确的 `SESSION_INVALID` 表示旧会话已无效，可继续登录，其他撤销失败保留旧 token 并提供重试。写入前再次核对该键未被其他页面替换，`writeToken()` 成功持久化后才设置 SDK 内存凭据、登记存储归属并解除该键的抑制；写入失败不替换 SDK 凭据。成功后才整页导航或继续当前 OIDC challenge。

启动集成和 `AuthProvider` 各持有 `startSessionSync()` 的一个订阅租约，共用一个 DOM storage 监听器；租约释放幂等，全部释放后才移除监听器。当前键的替换、删除及相关 localStorage clear 事件先同步自定义 root 的 SDK 凭据，再通知应用订阅者；忽略其他键与其他 storage 区域。启动集成同时拥有资料与通知缓存的身份同步订阅，即使对应 UI 已卸载，也会在 root 或 token 变化时作废旧缓存；集成释放时注销该订阅。`AuthProvider` 在启动及会话变化后调用 `/auth/me` 恢复身份；浏览器存储本身不作为身份依据。

读取、账号切换的原值比较、写入、条件删除、退出和失效清理都使用当前键。明确的 `SESSION_INVALID` 只删除仍与本次请求匹配的 token，避免迟到响应清掉较新的登录；资料页读取或修改收到此错误时同步更新顶栏认证状态。SDK 处理显式凭据失效后，应用的 `expirePersistedSession()` 仅清理由登录写入或自定义 root 恢复所登记的持久值，并在删除前核对浏览器存储对象及原 token；其他 root 和已替换的新值保留。默认自动来源的条件清理仍由 SDK 负责。

临时网络错误保留 token 并显示可重试状态，资料读取失败也结束等待并允许重试。获取 `localStorage`、`sessionStorage` 对象本身也可能抛异常；会话恢复的首次读取失败进入不可用状态，不借用其他 root 的凭据。退出或已归属凭据的失效清理遇到存储读取、删除失败时，对原值保留内存抑制，存储恢复可读后仍视为匿名；抑制按键保存在模块生命周期的 Map，切到另一 root 再返回也不会丢失。返回默认 root 时即使存储暂不可读，也恢复空覆盖。观察到不同持久值或成功持久化一次登录可解除对应抑制，同 token 的成功重新登录也可解除；该抑制本身不跨模块重载持久化。

观察到不同持久值而解除抑制时，应用保留待恢复标记，直到 `syncSessionToken()` 将当前凭据显式安装到 SDK 并登记持久化归属。其他读取先解除抑制也不会丢失该标记；成功登录写入或新的主动退出会清除旧的待恢复状态。这使默认 root 在不可读期间建立的空覆盖能恢复新登录，同时保留 SDK「首次恢复可读仅建立基线」的规则。

API root 变化会更新应用范围版本。`AuthProvider` 的恢复请求、捕获的失效及退出回调，`AuthFlow` 的登录、旧会话撤销、SSO 延续与保留的验证码步骤草稿，以及 OIDC challenge 的检查和接受结果均须仍归属原范围；旧 root 结果不能写入新 root、导航或继续发送凭据，即使两边 token 字符串相同。SDK 的请求版本检查继续独立生效。重新安装集成使旧处理器失效，旧 disposer 不能移除新处理器；HMR dispose 释放本次集成拥有的处理器和监听租约。

### 主动退出与导航

主动退出由 `AuthProvider` 立即完成本地状态切换：删除当前 root 的持久 token、当前标签页 `sessionStorage` 的 SSO 成功展示记录，清除 SDK 内存凭证和缓存的本人设置资料，关闭认证容器并切换为匿名。两种 storage 独立尝试清理，存储异常仍清除内存身份。已有身份查询的请求代次失效，不能恢复退出前的资料；其他 root 的凭据及主题等非认证偏好保留。

本地清理前捕获的 token 仅用于后台 `/auth/logout` 撤销请求，通过显式 Authorization 传递。API 拒绝、断网、超时或请求未完成均不阻止浏览器退出；请求结束不再修改本地身份，因此迟到结果不能清除后来登录的新会话。此路径不立即刷新页面，以免中断尚未送达服务端的撤销请求。本地退出不等于服务端撤销成功；跨服务会话撤销仍依赖服务端请求成功处理。

会话失效处理器同步应用状态后，保留支持中心、身份路由及带 `ssoRequestId` 的登录页继续处理当前流程；其他非登录页替换到 `/login`。

## 身份页面

`apps/web/src/App.tsx` 注册 `/identity/login`、`/identity/consent`、`/identity/logout` 和 `/identity/signed-out`。挑战页面通过 SDK 检查或接受 Hydra challenge；已有有效本站 Bearer 可直接完成登录与授权，缺少会话时经现有登录 UI。挑战与当前 token 不匹配时重新开始，避免迟到响应将旧身份带入新会话。

身份密码登录将目标服务说明放在共享表单的标题区，通过可选 `description` 展示，并在验证码步骤继续保留；表单显示时不再叠加外围登录标题。页面底部的信息入口通过 `OidcSharingDialog` 打开独立 ExUI Dialog，只描述 challenge 检查返回的 scope：`openid` 为账号身份，`profile` 为基本资料，`email` 为邮箱；每项使用图标、标题与用途说明，原始 scope 收在弹窗内的技术详情。其他 scope 保留原标识，不推断权限。关闭、Esc 或“知道了”返回入口并保留表单输入；该弹窗只供查看，不增加授权确认步骤，已有会话仍按原流程自动继续。

SDK 的 `instance({...})` 直接返回成功数据，失败抛出 `ExAxiosError`，身份页面按其状态码和错误码决定重试、重新开始或拒绝无效入口。身份路由中的会话失效由当前页面继续处理；共享请求层同步浏览器会话后不把该路由跳到普通 `/login`，以保留 challenge 和退出确认流程。

`/identity/signed-out` 重新验证当前 token，只删除已确认无效且仍匹配的 token；请求代次与会话变化订阅使迟到退出检查不能清除后来登录的新账号。该页只提供首页返回，不读取旧 Docs return/resume 参数或自动导航。服务端撤销仍是会话有效性的依据。跨服务边界见 `.ai/architectures/identity/integration-boundaries.md`。

## 用户设置

登录用户菜单的“设置”和“个人资料”打开同一 Modal，分别默认选中通用和个人资料；`/account/profile` 以页面容器复用相同主体。共享界面负责分类、单项表单和头像裁剪；`apps/web/src/settings/` 负责经 SDK 请求本人资料。通用分类的主题由 ExUI `ThemeProvider` 决定，Valtio 中的值只是读取投影。

设置资料只缓存在内存，以 API 范围版本和 token 共同确定归属，并用请求代次拒绝迟到结果；不同 root 即使 token 相同也会清空旧快照并作废旧读取及写入。旧保存的错误不能清理新范围资料，旧完成回调不能释放新范围的提交状态。设置分类的已读取标记也包含范围版本，切换后重新读取当前分类；通知偏好的请求归属见 `.ai/knowledge/notifications/request-lifecycle.md`。重新打开会刷新，明确失效或账号切换会清空。保存成功先采用服务器返回的完整本人资料，再调用既有 `AuthContext.refreshProfile()` 同步顶栏；顶栏刷新失败不会回滚已经保存的设置。退出仍交给 `AuthContext.logout()`。设置状态与认证状态的职责依据见 `.ai/decisions/web/04-settings-state-separate-from-auth-context.md`。

## SSO 接收流程

SSO 页先检查请求，再尝试用已有本站 token 确认；失效 token 被清除后显示密码表单，网络或服务错误保留 token 并提供重试。密码确认使用独立 SSO operation，不把返回值写入 `localStorage`。

服务端确认完成后，当前标签页才把 `{ssoRequestId, confirmedAt}` 写入 `sessionStorage` 的 `exwebsite.auth.sso-success`，再整页替换到 `/sso/success`。成功页只接受五分钟内的当前标签页记录；该记录只控制提示，不是授权凭据。

成功页复用登录页的品牌 Icon 和外围 Glass 卡片。有效成功记录时提示“登录成功”“正在返回应用”，五秒后尝试关闭当前页面；浏览器可能拒绝脚本关闭非脚本打开的标签页，此时提示用户手动关闭。缺少有效记录时在同一卡片内直接显示居中的“发生错误”标题与原因，不叠加错误 Alert 的 Glass，并提供左上角 Home 入口；此时不启动关闭计时。
