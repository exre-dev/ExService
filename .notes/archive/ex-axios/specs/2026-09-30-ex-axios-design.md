# ExAxios 与 Server 通用 HTTP 规范

- 日期：2026-09-30
- 状态：分节设计已确认，完整 spec 待用户审阅
- 模块根目录：`.notes/archive/ex-axios/`
- 后续 RFC 目录：`.notes/archive/ex-axios/rfcs/`
- 本文只定义设计，不授权实现、提交或部署。

## 1. 目标与已确认范围

在 `packages/sdk` 增加 Axios 包装器 ExAxios，导出一个可直接调用的默认实例，供本站和其他工程共用。调用者获得响应正文 `Promise<T>`，无需逐个请求读取 Token、拼接认证头、处理会话失效或发送临时错误提示。

已确认：

1. 本站现有请求迁移到同一 ExAxios 请求层，继续保留 OpenAPI 的路径、参数和响应类型约束。
2. 浏览器默认 API 根地址为当前页面 `location.origin + '/api'`；Node 和其他工程通过 `ExAxios.setBaseUrl` 配置。
3. 允许调用第三方 API；请求默认地址与本站认证地址分开保存。
4. 浏览器初始化尝试读取现有 Token 并缓存到内存；提供 `setToken`。
5. 只向最终 URL 属于本站 API 范围的请求自动添加本站 Token。
6. 浏览器失败默认使用 ExMessage；提示开关命名为 `alert`，支持实例默认值与单次覆盖。
7. 本站 `401 + SESSION_INVALID` 统一清理对应 Token并处理登录过期；其他 401 不触发本站跳转。
8. 默认浏览器跳到本站 `/login`，允许配置登录地址或接管失效回调；Node 只抛错。
9. 成功正文直接返回业务数据，失败沿用统一 ErrorEnvelope；文件响应不包 JSON 外壳。
10. Server 统一提供 `X-Request-Id`，并支持受控的 CORS 来源白名单。

包括本站请求迁移、存储 SDK 的本站 HTTP 阶段接入、生成式 Client 适配、Server 响应头与 CORS、依赖和产物验证。不包括新增业务 operation、刷新 Token、SSO 发起协议、自动重试、数据库模型修改、SDK 发布或公网部署。

## 2. 现状与证据

| 事实                                                                                                     | 仓库来源                                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| SDK 当前只有通用存储，分别构建浏览器与 Node 产物                                                         | `packages/sdk/README.md`、`packages/sdk/src/browser.ts`、`packages/sdk/src/node.ts`                                     |
| 存储的本站 HTTP 经生成式 Client 执行，云上传使用环境对应的 COS SDK                                       | `packages/sdk/src/shared.ts`、`packages/sdk/vite.config.ts`                                                             |
| 生成式 Client 使用 openapi-fetch，返回 data/error/response；该结果结构是客户端行为，不是 Server 成功外壳 | `packages/api-client/src/client.ts`                                                                                     |
| Web 配置集中于 VITE_API_BASE_URL，缺省 /api                                                              | `apps/web/src/api/client.ts`                                                                                            |
| 本站 Token 存在 localStorage 的 exwebsite.auth.token 中                                                  | `apps/web/src/auth/storage.ts`                                                                                          |
| 登录保存 Token；AuthProvider 和设置控制器目前各自读取 Token、处理失效                                    | `apps/web/src/auth/AuthFlow.tsx`、`apps/web/src/auth/AuthContext.tsx`、`apps/web/src/settings/useSettingsController.ts` |
| 全站只挂一个 ExMessageContext，消息发送依赖宿主已激活                                                    | `apps/web/src/main.tsx`、`.ai/rules/frontend-notifications.md`、`.ai/knowledge/components/ex-message-host-lifecycle.md` |
| Server 使用 Contract 注册业务路由，当前没有 CORS 接线                                                    | `apps/server/src/app.ts`                                                                                                |
| 错误结构固定为 error.code/message/requestId，code 在 schema 中为 string                                  | `api/openapi.yaml`、`apps/server/src/errors.ts`                                                                         |
| SESSION_INVALID、INVALID_CREDENTIALS、COMPLETION_GRANT_INVALID 都可能返回 401，但语义不同                | `apps/server/src/auth/errors.ts`                                                                                        |

Axios 的实例、响应正文和拦截器机制分别见 [实例文档](https://axios-http.com/docs/instance)、[响应文档](https://axios-http.com/docs/res_schema)、[拦截器文档](https://axios-http.com/docs/interceptors)。绝对 URL 可以覆盖 baseURL，因此认证判断必须基于实际发送的 URL，见 [请求配置文档](https://axios-http.com/docs/req_config)。

## 3. 架构与替代方案

采用一套 ExAxios 请求引擎，加一层生成式类型入口：

```text
api/openapi.yaml -> generated paths / operations / components
                                |
                    packages/api-client typed facade
                                |
                      injected request transport
                                |
                   packages/sdk ExAxios -> Axios
                        |              |
               browser adapters    Node adapters
               token / ExMessage   explicit token
               login navigation    no UI / navigation
```

`packages/api-client` 只维护生成类型与类型化调用适配，定义可注入的 transport 接口，不 import SDK、Axios、React 或 ExUI。`packages/sdk` 依赖该接口和生成类型，并提供实际 transport。这个方向避免循环依赖，也让本站请求保持经过共享 Client 的边界。

本站在 `apps/web/src/api/client.ts` 组装唯一 ExAxios 实例和类型化 Client；保留 VITE_API_BASE_URL 的配置优先级，未设置或为空时使用浏览器默认值。页面继续调用共享 `api`，不自行创建请求引擎。

外部消费者直接使用 ExAxios；需要本站类型约束时使用 SDK 导出的类型化 Client 工厂及内联生成类型。产物不要求安装私有 workspace 包。

未选择的方案：全部使用手写泛型会丢失本站路径和输入检查；保留 openapi-fetch 与 Axios 两套请求引擎会重复认证和错误策略。迁移完成后本站 HTTP 不再由 openapi-fetch 发送。

## 4. 公开 API 与返回值

以下签名表示设计契约，不是已存在的代码：

```ts
ExAxios<T = unknown>(config: ExAxiosRequestConfig): Promise<T>
ExAxios.setBaseUrl(url: string, options?: { website?: boolean }): void
ExAxios.setToken(token: string | null): void
ExAxios.setAlert(enabled: boolean): void
createExAxios(options?: ExAxiosOptions): ExAxiosInstance
createApiClient({ baseUrl, transport }): TypedApiClient
```

`ExAxiosRequestConfig` 使用 Axios 的常用请求字段：url、method、params、data、headers、timeout、signal、responseType，以及 `alert?: boolean`。默认 method 为 GET。封装不暴露原始实例、可修改的 defaults 或可移除内部策略的 interceptors；首版不开放自定义 adapter、socketPath、底层 transport、状态成功判定或任意响应变换，以保证正文返回、认证边界和统一错误行为。带本站 Token 的请求拒绝调用者覆盖 Host 或 :authority 等路由目标头。

默认实例与独立实例有一致的可调用接口。工厂选项支持 baseUrl、websiteBaseUrl、alert、loginUrl、onSessionExpired；配置含义与 setter 一致。独立实例各自持有 Token、配置、版本号和失效锁。Node 多用户服务使用工厂，为每个会话或调用上下文创建实例，不能把不同用户的 Token 写到同一个默认实例。

```ts
const data = await ExAxios<MyType>({
  url: '/some-resource',
  method: 'GET',
  alert: false,
})

ExAxios.setAlert(false)

// 登记远程本站 API 后，再提供该站 Token。
ExAxios.setBaseUrl('https://example.com/api', { website: true })
ExAxios.setToken(token)

// 只改变普通请求目标，仍保留前面登记的本站认证地址。
ExAxios.setBaseUrl('https://third-party.example/v1')

// 本站路径与响应从 Contract 推导，不手写 DTO。
const user = await api.GET('/auth/me', { alert: false })
```

泛型 T 描述响应正文，不是 AxiosResponse，也不声明运行时 schema 校验。通用请求缺省返回 unknown。本站 GET/POST/PATCH 等方法从生成 paths 推导输入与成功返回类型，禁止覆盖为手写响应类型。

类型化 Client 保留 path/query/body 的结构化输入方式，负责序列化 path 和 query、JSON 与 FormData，调用注入的 transport。Client 的 baseUrl 固定为组装时明确指定的本站地址，生成完整请求 URL，不随通用实例切换到第三方默认地址而改变目标；切换本站环境时重新组装 Client。返回值改为成功正文，失败 rejection；本站调用处从 data/error 分支迁移为直接使用结果和 catch，不保留第二套旧结果协议。

JSON、文本、Blob、ArrayBuffer 等成功结果对应 Axios 的正文；204 显式规范化为 undefined，类型化方法返回 Promise<void>。需要二进制的调用者显式指定 responseType。首版不新增返回完整 AxiosResponse 的入口。

## 5. 地址配置与认证范围

browser 默认 baseUrl 与 websiteBaseUrl 都是当前页面 origin 下的 /api。Node 没有默认值；未设置 baseUrl 就请求时抛 CONFIG_ERROR。模块 import 不访问不存在的 window/localStorage，不自动请求或发送通知。

配置 API 根地址接受浏览器相对路径或 HTTP(S) 绝对地址；Node 要求绝对 HTTP(S) 地址。禁止包含用户名、密码、query 或 fragment 的根地址，统一规范化尾部斜杠。

`setBaseUrl(url)` 仅修改普通请求默认地址，不能扩大本站认证范围。`setBaseUrl(url, { website: true })` 同时显式登记本站认证地址，重算默认登录地址；认证范围发生变化时清除内存 Token、推进版本号。该操作不删除旧站的持久 Token，也不把旧 Token 转移给新站。

按照 Axios 的 URL 合并语义构造最终绝对 URL，再经 URL parser 规范化；认证检查和实际发送必须使用同一个规范化结果。包含 dot segments、绝对 URL 覆盖、协议相对 URL、默认端口和尾部斜杠的情况均纳入测试。

本站范围要求 protocol/host/port 一致，pathname 等于 API 根路径或以「根路径 + /」开头。/api-other 不属于 /api；不同子域、端口或协议也不属于本站。拒绝会令认证范围歧义的编码斜杠、反斜杠和 URL 用户信息。

只有范围匹配且存在内存 Token 时自动添加 Bearer。调用者显式传入 Authorization 时保留该值；不能把失败归因于另一个内存 Token。第三方请求可以使用调用者自己的认证头，但不会获得自动本站认证或本站失效处理。默认不自动开启 cookie credentials。

认证请求不自动跟随重定向：Node 带本站 Token 的请求使用 HTTP adapter 并设置 maxRedirects:0；浏览器为带 Token 的本站请求使用 Axios fetch adapter，并通过内部 fetchOptions 设置 redirect:error。该内部适配仍由 Axios 发送，不允许页面直接调用 fetch。官方 [fetch adapter 源码](https://github.com/axios/axios/blob/v1.x/lib/adapters/fetch.js) 将 fetchOptions 传入 Request/fetch；这是当前源码支持情况，实施仍需核对选定发布版本并通过真实重定向测试确认。本站 API 不用 HTTP 重定向表达登录失效，返回约定的 401 envelope。

## 6. Token 生命周期与应用状态同步

浏览器默认实例初始化时安全尝试读取 exwebsite.auth.token，只把非空字符串作为当前同源本站 API 的内存 Token。存储不可访问、值缺失时按没有 Token 处理；不阻止公开请求，也不发初始化通知。

远程本站地址不能自动借用当前页面原本的 Token；显式修改 websiteBaseUrl 后必须重新提供 Token。其他域名的页面不能跨域读取本站 localStorage，SDK 不试图绕过这一边界。

`setToken` 只更新内存，推进 Token 版本；null 表示清除，不隐式写持久存储。本站已有认证存储适配集中保留：普通登录持久化成功后同步 setToken，退出成功后清除持久 Token并 setToken(null)。SSO 登录成功不签发普通会话，不从其响应提取本站 Token。

本站根认证适配监听跨标签 storage 变更，并将对应 Token同步给唯一实例和认证显示状态；同标签 Token写入通过同一适配同步，不依赖 storage 事件。监听随应用或独立实例适配卸载释放。Node 实例不注册浏览器监听。

每次发送快照认证范围、配置版本、Token版本及实际自动使用的 Token。旧 Token或旧认证范围的请求迟到失败时可以正常抛错，但不得清理新 Token、改变新会话 UI 或触发其登录跳转。认证显示状态和本人资料 snapshot 的异步版本检查仍保留；统一请求策略不代替业务状态隔离。

## 7. 统一会话失效

触发条件同时满足：最终请求属于本站 API、响应状态为 401、有效 ErrorEnvelope 的 code 为 SESSION_INVALID，且失败对应当前认证范围和当前 Token版本。自动 Token为空时的受保护请求也可触发登录入口，但不能清除后来设置的 Token。

INVALID_CREDENTIALS、COMPLETION_GRANT_INVALID、第三方 401、缺失或无效 envelope 不触发该流程。调用者显式认证头不等于当前本站 Token时不清理本站会话。

流程：标记该版本正在失效；清除对应内存 Token；通过浏览器存储适配仅删除仍等于失败 Token的持久值；同步匿名状态；执行失效回调或默认导航。每个失效版本至多一次清理、一次回调/跳转和一次失效通知，并发请求仍分别 rejection。

默认登录地址为登记的本站 API origin 下 /login，使用 location.replace；当前位置已是该登录入口时不再次导航。自定义 loginUrl 必须为 HTTP(S) 或可解析的相对地址；onSessionExpired 接管时不再运行默认跳转。Node 只执行可选回调并抛错。

失效提示仅在 alert 开启时发送，不影响清理和跳转。回调、存储或通知失败不得覆盖原请求错误。设置新 Token、登记新认证范围时恢复失效处理能力。

迁移时保留 SSO 的 ssoRequestId 上下文：相应认证流程用统一失效回调切回当前登录容器或配置对应登录地址。普通登录和后台资料请求使用统一默认行为。

## 8. 错误与 ExMessage

统一 rejection 为 ExAxiosError，具有稳定的 kind、code、可选 status、requestId、retryAfterSeconds，以及安全 message。kind 区分 config、network、timeout、cancelled、http；本地 code 分别使用 CONFIG_ERROR、NETWORK_ERROR、TIMEOUT、CANCELLED，HTTP envelope 的 code 原样保留。非规范 HTTP 响应使用 HTTP_ERROR。公开错误和其序列化结果只包含这些安全字段，不附加原始 Axios config、request、response 或含凭证的 cause。

默认普通请求超时 30 秒，可通过请求 timeout 覆盖。存储上传继续使用现有 120 秒阶段期限。signal 中止与超时分别分类；主动取消默认不弹提示。默认不自动重试任何请求。

提示优先级为单次 alert > 实例 alert > true。无论是否提示，失败 Promise始终 rejection，实例不能把错误转换为成功正文。

只把本站有效 envelope 的安全 message作为提示候选；未知异常、网络失败、超时及第三方响应使用固定、可阅读文案。UI 不显示原始 Axios message、请求 URL、响应 HTML、SQL、Authorization 或堆栈。requestId优先使用错误正文，缺失时使用响应头；两者在本站应一致。

二进制请求收到错误时，仅在 Content-Type 为 JSON 且正文不超过 64 KiB 时解析 envelope；否则按 HTTP 状态生成通用错误，防止下载失败被当作文件成功结果。

browser 通知适配只调用 @exre/exui 的 ExMessage.error，不创建宿主、不安装第二份 Sonner。消费方负责挂一个 ExMessageContext；宿主未激活时跳过当前提示，不缓存稍后补发，原错误照常抛出。Node 入口不 import ExUI 或 React，也不弹提示。

登录、邀请表单、持续错误页、设置保存及已有 loading 反馈根据实际交互设置 alert:false，避免字段错误与 toast重复。开发健康检查始终 alert:false。不对所有普通请求做额外全局去重；会话失效的去重按上一节执行。

## 9. Server 通用请求和响应

### 请求

- /api 为固定业务前缀，operation、路径、HTTP method、security、参数和媒体类型全部来自 `api/openapi.yaml`。
- path 放资源标识，query 放该 operation定义的筛选或查询参数，普通提交用 JSON body；不额外套 data、code、token 等统一请求外壳。
- 上传沿用 Contract 的 multipart 定义，由运行时产生 boundary；不强制全站 Content-Type 为 application/json。
- 认证使用 Bearer header，不把 Token放在 query或日志中。公开 operation仍可在没有 Token时调用。
- 服务端依据 Contract 校验，不通过放宽 additionalProperties 或静默删除字段掩盖客户端错误。

### 成功

使用 operation 已声明的 2xx 状态与业务正文；不新增全站 success/data/code/message外壳，不把失败藏在 200中。新操作是否使用 201或204由其 Contract决定，不改写已有状态码。文件、头像和附件继续使用原媒体类型、流及下载头。

### 失败

所有业务失败使用 4xx/5xx和同一结构：

```json
{
  "error": {
    "code": "SESSION_INVALID",
    "message": "登录状态已失效，请重新登录",
    "requestId": "server-generated-id"
  }
}
```

ErrorEnvelope继续 additionalProperties:false，必填code、message、requestId。code维持 Contract中的 string；稳定错误码在Server统一错误边界管理，客户端只把明确约定的 SESSION_INVALID用于本站会话处理。未知异常固定文案，允许的校验错误和业务固定文案沿用既有安全边界。

### 响应头与关联

Server 为所有 API结果统一设置 X-Request-Id，包含成功、错误、文件、未知API路径及预检；由服务器生成，不信任客户端提供的值。错误正文requestId、该头与日志标识一致。Contract中的业务响应补充共享header定义与引用。

现有Cache-Control和Retry-After规范保留；SDK读取Retry-After但不自动重试，网络和配置错误没有伪造requestId。请求日志不得包含Token、密码、完整连接串、云凭证或上传票据。

## 10. CORS 范围

通过 SERVER_CORS_ALLOWED_ORIGINS配置精确HTTP(S) origin列表；未配置时不启用跨域访问。允许项校验scheme、host、port，拒绝wildcard、null和带路径的条目。非允许来源不会获得允许跨域读取的响应头；CORS不替代Bearer或业务权限检查。

允许Content-Type和Authorization请求头；HTTP方法依据Contract支持的集合限制。暴露X-Request-Id、Retry-After和Content-Disposition，Content-Type沿用浏览器安全列表。默认不启用credentials cookie跨域共享，不假设其他工程能够读取本站Token。

OPTIONS预检只作为/api范围的协议基础设施处理，不创建业务operation或JSON mock。实施时须在仓库规则中明确其基础设施例外；业务路由仍全部来自Contract，serviceHandlers双向覆盖规则不放宽。未知业务路径不会因预检处理变成可用API。

不改变本地Server监听地址，不发布生产域名、不启用公网部署。外部工程的跨域验收使用明确允许的本地origin与现有开发服务。

## 11. 存储 SDK 和构建边界

存储的prepare、本地upload、complete经同一ExAxios引擎和生成式类型入口。COS PutObject继续使用对应云SDK；不向COS附加本站Token。各阶段不得自动重试，不改变上传返回URL、介质选择或既有StorageSdkError契约。

保留createSdk现有baseUrl与getAccessToken选项：每次本站阶段仍调用该getter，使用为该存储实例登记的认证范围和独立请求上下文，不污染默认ExAxios实例。存储适配将ExAxiosError映射回StorageSdkError；为兼容现状，其TIMEOUT与CANCELLED都继续映射成存储TIMEOUT。内部HTTP关闭alert并不执行交互式登录跳转，使已有浏览器和Node存储消费者保持既有异常语义。UI如需全局提示，可在上传动作整体处理一次。

SDK新增专门HTTP条件导出，让只使用ExAxios的消费者不加载COS运行库；根、browser和node入口保留既有存储导出并新增ExAxios。browser与node公开HTTP类型一致，环境实现分别组装。

浏览器通知适配将@exre/exui保留为外部peer，消费方提供同一ExUI实例及其宿主，避免SDK打包第二份通知控制器。该peer对仅使用Node入口的工程为可选；browser入口使用者须安装ExUI及其peer依赖。Node产物和依赖图不得加载React、DOM或ExUI。仅使用HTTP的产物不得加载COS。

生成类型和Client适配内联到外部SDK产物，不遗留@workspace/*依赖、源码别名或本机路径。验证node和browser条件导出、HTTP子入口、声明构建和独立消费工程，不以仓库源码类型检查代替打包验收。

## 12. 迁移与规则同步

1. Contract先增加响应头定义及引用，执行pnpm api:lint与pnpm api:generate；不人工修改生成声明。
2. Client新增注入transport的类型化入口；SDK提供实际ExAxios与环境适配，随后迁移Web及存储本站HTTP。
3. Web移除重复认证头、普通会话失效判断与重复toast；保留字段映射、页面错误、认证显示和资料异步版本保护。
4. Server增加响应头与受控CORS，不增加Contract之外的业务路由。
5. 更新SDK用法及仓库请求边界说明，明确Client类型入口到ExAxios的调用链和预检基础设施例外。

没有现存成功/失败正文形状的破坏性Contract修改。客户端data/error返回协议变化需要全量迁移消费点与测试。若实施发现需要破坏性HTTP变更，必须停止扩展本spec并单独评审版本化。

`.ai/`中稳定结论在设计完成后另行征得用户同意再归档；当前只生成`.notes/archive/ex-axios/`下设计和RFC。保留现有数据库、表单、通知、contribution规则；涉及Form迁移时先读`.ai/rules/frontend-forms.md`。

## 13. 验收

| 类别     | 必须证明的行为                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| 类型     | 通用泛型得到Promise<T>；缺省unknown；本站非法path、method、body、query编译失败；成功类型从生成schema推导           |
| 地址     | browser默认/api；Node未配置错误；setBaseUrl不扩大信任；显式website登记、绝对覆盖、路径越界、同前缀假路径与端口变化 |
| 认证     | 初始化读取失败可继续；setToken即时生效；仅本站范围自动带Token；切换范围不复用旧Token；第三方和COS不带本站Token     |
| 并发     | 旧Token或旧范围401不清新会话；同时失效至多一次回调/跳转；重新登录后可以再次处理新会话失效                          |
| 错误     | 网络、超时、取消、HTTP和非规范响应正确分类；alert实例和请求优先级；提示失败不覆盖原请求错误                        |
| 导航     | 仅SESSION_INVALID触发；密码/注册凭证/第三方401不触发；已有登录页不循环；SSO上下文保留；Node不导航                  |
| 真实HTTP | 可信请求重定向不能泄露Token；FormData边界正确；文件与下载错误解析正常；30秒普通期限和120秒存储期限可配置并分类     |
| 通知     | 同一ExUI实例、单一宿主；宿主未就绪不掩盖请求失败；字段/页面/loading不重复toast                                     |
| Server   | 成功正文、错误envelope、二进制不变；X-Request-Id与正文/日志一致；Contract路由覆盖和原始handler结果检查             |
| CORS     | 白名单允许、非允许来源无授权头；Authorization预检；响应头可读取；默认同源；预检不绕过业务认证                      |
| 产物     | browser/Node/HTTP入口的真实构建消费；Node无需React/ExUI；HTTP入口不加载COS；无私有包名和源码别名泄露               |
| 回归     | 普通登录、SSO接收、退出、资料、邀请、加入申请、文件和COS存储现有交互及异常语义                                     |

实施阶段执行pnpm api:lint、pnpm api:generate、pnpm typecheck、pnpm test、pnpm build，以及browser和Node外部产物验收。数据库测试仍使用独立Testcontainers，失败时不能回退本机exre。真实浏览器、独立Node、真实HTTP与静态/单元结果分别报告PASS/FAIL/NOT_EXECUTED。当前设计阶段不运行代码测试，也不声称实现已通过验收。

## 14. 自审与后续交接

已检查：范围覆盖已确认需求；alert命名一致；成功正文没有二次解包；Client到SDK的依赖不循环；Node无浏览器默认地址或UI依赖；第三方URL与重定向不能扩大Token发送范围；存储既有getAccessToken和错误语义保留；Token持久化与内存更新责任明确。

风险和实施验证重点：浏览器认证请求的Axios fetch adapter重定向行为、现有Web从结果对象迁移到异常协议、ExUI单实例的产物external配置、现有存储异常映射，以及CORS与Contract-only业务路由规则的基础设施接线。

完整spec获批后，使用technical-design-doc-creator，以本文为唯一来源，在`.notes/archive/ex-axios/rfcs/`生成一个实现就绪RFC；保持本spec，不开始实现、不提交、不部署。
