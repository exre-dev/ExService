# RFC：ExAxios 请求层与 Server 通用 HTTP 规范

- 日期：2026-09-30
- 状态：依据已确认 spec 完成技术设计，待实施阶段评审与验证
- 唯一设计来源：`.notes/archive/ex-axios/specs/2026-09-30-ex-axios-design.md`
- 模块根目录：`.notes/archive/ex-axios/`
- 本 RFC 不授权代码实现、提交、发布或部署。

## 1. 决策摘要

在 `packages/sdk` 实现可调用的 ExAxios 默认实例和独立实例工厂。Axios 是唯一 HTTP 请求引擎，负责发送与底层协议；SDK 负责地址、Token、错误分类、ExMessage 与会话失效策略。`packages/api-client` 保留生成类型，改为通过注入的 transport 提供本站路径、参数和成功正文类型检查，不依赖 SDK 或 UI。

Web 继续通过唯一共享 `api` 访问本站，由应用入口注入 ExAxios。普通失败成为 rejection，成功直接返回正文。Server 保留所有现存请求与响应正文，统一补充 `X-Request-Id` 和可配置 CORS 来源白名单；业务路由仍只来自 OpenAPI。

## 2. 范围、证据与约束

纳入：SDK HTTP 与环境入口、生成式 Client 适配、Web 请求和认证存储接线迁移、存储 SDK 的本站请求阶段迁移、响应头、CORS、相应测试和公共用法文档。

不纳入：新业务 API、成功 envelope 改造、数据库或迁移变更、刷新 Token、SSO 发起方、重试队列、分块上传、公网部署和包发布。没有数据库数据迁移，也不运行开发库 reset。

当前事实和对应源码：

| 当前事实                                              | 来源与实施影响                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| OpenAPI 是唯一 HTTP Contract                          | `api/openapi.yaml`；响应头变更先 lint、generate，生成声明不手改                                                                  |
| Client 当前由 openapi-fetch 发送请求                  | `packages/api-client/src/client.ts`；所有消费点一起迁移结果协议                                                                  |
| 浏览器 Token 在固定 localStorage key 中               | `apps/web/src/auth/storage.ts`；保持键名和已登录会话                                                                             |
| 认证与设置各自使用 Token、失效分支和异步版本检查      | `apps/web/src/auth/AuthContext.tsx`、`apps/web/src/settings/useSettingsController.ts`；合并请求策略，保留业务版本检查            |
| multipart 存在自定义 bodySerializer 和 JSON Blob part | `apps/web/src/join/client.ts`、`tests/contract/join-upload.test.ts`；显式 FormData 替代旧序列化回调                              |
| 存储测试目前 mock 全局 fetch                          | `tests/sdk/storage-sdk.test.ts`；Node 改用 Axios HTTP adapter 后测试需要真实本地 HTTP fixture                                    |
| 部分真实上传测试依赖 response.status/headers          | `tests/contract/join-upload.test.ts`；协议断言改从真实 HTTP 响应获得，不能删除断言                                               |
| SDK 已有独立 browser/Node 构建和声明内联              | `packages/sdk/vite.config.ts`、`packages/sdk/rollup.config.dts.mjs`；增加 HTTP 入口并保持类型与环境隔离                          |
| Server 已有统一错误与上传/下载资源截止时间            | `apps/server/src/errors.ts`、`apps/server/src/join/transport.ts`、`apps/server/src/modules/storage/transport.ts`；不替换资源管理 |

仓库规则继续适用：`.ai/rules/frontend-forms.md`、`.ai/rules/frontend-notifications.md`、`.ai/architectures/api/contract-layout.md`、`.ai/architectures/server/request-lifecycle.md`、`.ai/knowledge/storage/lifecycle-traps.md` 与 `CONTRIBUTING.md`。没有 `TESTING.md`，测试沿用现有 Vitest、Contract 和 Testcontainers 约定。

## 3. 组件与依赖方向

| 位置                                                  | 责任                                           | 依赖限制                                                          |
| ----------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `packages/api-client/src/client.ts`                   | 类型化 Client 工厂、输入映射和序列化           | 只使用生成类型及标准运行时能力；不 import Axios、SDK、React、ExUI |
| `packages/api-client/src/transport.ts`（拟新增）      | 环境中立的请求 transport 类型                  | 不维护 endpoint 表或业务 DTO                                      |
| `packages/sdk/src/http/`（拟新增）                    | Axios 包装核心、地址验证、快照、错误、环境入口 | Token 和通知策略在此，不进入 Client 包                            |
| `packages/sdk/src/shared.ts`                          | 存储 prepare/upload/complete 协调              | 复用 HTTP 核心，保持 COS、返回值和异常契约                        |
| `apps/web/src/api/client.ts`                          | 组装 ExAxios 和本站类型化 Client               | 唯一解析 VITE_API_BASE_URL 的位置                                 |
| `apps/web/src/auth/storage.ts`                        | 持久 Token 与内存同步适配                      | 保留已用 key，不另建持久 Token 表示                               |
| `apps/server/src/http/`（拟新增文件）                 | request ID 响应头、CORS 配置与基础设施 hook    | 不注册业务路由或维护业务 schema                                   |
| `apps/server/src/app.ts`、`apps/server/src/server.ts` | 组装 hook、传入已解析配置                      | 维持 Contract-only 业务路由、现有启动检查                         |

依赖始终为 SDK → api-client，Web → api-client + SDK。Client 接口接受函数注入，不反向 import SDK。只改变客户端 transport，不把 Server 的 endpoint 定义迁移到 SDK。

替代方案及取舍：

| 方案                              | 优点                               | 未选择原因                                                    |
| --------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| 所有请求直接 ExAxios<T>           | 公开调用最简单，Client改动较少     | T不能保证本站path和输入符合Contract，容易出现重复DTO          |
| 保持openapi-fetch并另增Axios      | 原有Web调用和测试迁移成本较低      | 存在两套实际HTTP引擎，认证、期限、失效与提示难以统一          |
| 注入ExAxios的typed Client（采用） | 单一请求策略与生成类型边界同时保留 | 需要重写薄适配、迁移全部旧结果协议，并验证multipart和产物依赖 |

## 4. 对外接口

以下接口为实施契约，代码块用于定义设计，不代表现有实现。

```ts
type ExAxiosErrorKind = 'config' | 'network' | 'timeout' | 'cancelled' | 'http'
type HttpResponseType = 'json' | 'text' | 'blob' | 'arraybuffer'

interface ExAxiosRequestConfig {
  url: string
  method?: string
  params?: Record<string, unknown> | URLSearchParams
  data?: unknown
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  responseType?: HttpResponseType
  alert?: boolean
}

interface SessionExpiredContext {
  error: ExAxiosError
  loginUrl: string
}

interface ExAxiosOptions {
  baseUrl?: string
  websiteBaseUrl?: string
  alert?: boolean
  loginUrl?: string
  onSessionExpired?: (context: SessionExpiredContext) => void | Promise<void>
}

interface ExAxiosInstance {
  <T = unknown>(config: ExAxiosRequestConfig): Promise<T>
  setBaseUrl(url: string, options?: { website?: boolean }): void
  setToken(token: string | null): void
  setAlert(enabled: boolean): void
}

export const ExAxios: ExAxiosInstance
export function createExAxios(options?: ExAxiosOptions): ExAxiosInstance
```

公开错误继承 Error，只公开 kind、code、message，以及可选 status、requestId、retryAfterSeconds；不附带原始 Axios cause/config/request/response。HTTP code 取有效错误 envelope；本地 code 为 CONFIG_ERROR、NETWORK_ERROR、TIMEOUT、CANCELLED，无有效 envelope 的 HTTP 失败为 HTTP_ERROR。错误序列化也只包含上述安全字段。

接口使用受控字段白名单。运行时拒绝未知的底层配置字段，不能通过 JavaScript 调用绕过 TypeScript 限制；不透传 adapter、socketPath、transport、validateStatus、transformRequest/Response、Host、:authority 等会绕过策略的参数。method 使用 Axios 标准 HTTP 方法集合；本站可用方法由生成 Client 进一步限制。

通用 `ExAxios<T>` 的 T 由调用方声明，不做运行时 schema 校验。缺省 unknown。typed Client 不提供手写成功 DTO 的泛型逃生入口。

### 4.1 生成式 transport 与 Client

Client 包定义 HttpTransportRequest，与上述通用配置具有相同的标准字段，但 url 必须由 Client 构造为完整绝对地址。ApiTransport 是接收该对象、返回 `Promise<unknown>` 的函数；类型化工厂通过生成响应类型建立自己的公开 Promise 类型，而不是信任一个由调用方任意实现的泛型 transport。

`createApiClient({ baseUrl, transport })` 的 transport 必填；不存在另一个缺省 openapi-fetch 引擎。Browser 相对 baseUrl 在组装时解析为绝对地址，Node 使用绝对地址。SDK 将工厂和生成的 paths/operations/components 类型内联并对外导出。

Client 的方法列表从生成 paths 中的非 never operation 推导；path 只接受存在该 method 的路径。参数使用 `params: { path, query }`；必填 body/path/query 决定 options 是否必填。headers 为请求 header，alert/timeout/signal 可选。

JSON body 使用生成 schema 类型。multipart operation 接受 FormData body，其他 operation 不接受 FormData；生成 schema 仍用于构造和校验 multipart 中的业务 JSON part，不把原生 File 复制成 string DTO。原生 FormData 的逐 part 类型由业务构造器与 Contract/真实 HTTP 测试保证，不能声称 TypeScript 检查了 FormData 内每个字段。

path 插值逐值 URI 编码；query 按 Contract 默认 form/explode 规则编码，数组重复键、undefined 省略。当前操作使用标量 query；Contract兼容测试直接读取OpenAPI并检查所有参数的style/explode属于已实现组合，遇到未支持组合让兼容测试失败，要求在Contract变更时补齐适配。运行时遇到不支持的复杂参数值报CONFIG_ERROR，不能静默发送另一种格式。生成TypeScript类型不保留style/explode，不能假定运行时可以从paths类型读取这类元数据；不新增手写endpoint表。

默认 responseType:json 时，返回已声明成功 JSON 内容类型的联合；若成功无正文则 void。显式 text/blob/arraybuffer 时返回类型分别映射为 string/Blob/ArrayBuffer，避免把下载结果误声明成 DTO。默认请求 json 而服务端送非 JSON 正文时，失败为 HTTP_ERROR，不把无效 JSON 作为 DTO 返回；文件请求明确指定 responseType。

Client 固定自己的 baseUrl，完整 URL 交给 transport；ExAxios 后续切换第三方默认地址不会改变本站 Client 的目标。跨环境切换重新创建 Client。

### 4.2 返回和序列化

只对 2xx 返回正文，204 返回 undefined。JSON 请求不额外包 data；FormData 不手写 Content-Type；文本与二进制保留实际内容。ArrayBuffer 结果在 Node 中从 Buffer 复制对应视图，不能暴露底层 ArrayBuffer 的其他字节；blob 在 Node 的 HTTP adapter 下先取二进制，再用运行时 Blob 构造，保证公开类型与实际值一致。

不导出 AxiosResponse 或完整响应入口。需要断言状态、响应头的协议测试使用真实 HTTP fixture，不为了测试重新引入公开响应对象。

## 5. 地址、Token 与并发状态机

### 5.1 状态和原子配置

实例保存 baseUrl、websiteBaseUrl、token、scopeRevision、tokenRevision、alertDefault、loginUrl、失效锁。Node 默认 baseUrl/websiteBaseUrl 未设置；browser 在存在 location 时使用 origin 下 /api。缺少 window 时 browser 产物 import 也不能抛错，首次请求没有有效地址则 CONFIG_ERROR。

setter 先完整验证再修改，非法输入保持旧状态。配置根地址只允许 HTTP(S)，无 userinfo/query/fragment，去掉多余尾部斜杠；browser 相对根地址以当前页面 origin 解析，Node 必须绝对地址。

`setBaseUrl(url)` 只变更普通目标；`website:true` 同时登记本站范围。同一规范化范围不会清空 Token；范围变化推进 scopeRevision，清除旧内存 Token、推进 tokenRevision、清除失效锁，并重算未显式自定义的登录地址。自定义 loginUrl 不被普通 setter 覆盖。不会删除或搬运旧站 localStorage。

`setToken` 接受非空字符串或 null，拒绝空字符串、控制字符和 CR/LF；只更新内存，每次显式调用推进 tokenRevision并解除失效锁。请求已经发送的 header 不追随后续变更。

### 5.2 最终目标和认证

合并 baseUrl、url 和 params 后生成实际完整 URL，经 URL parser 规范化，再进行 scope 检查，并以这个完整结果发送。Axios 不再二次拼接 baseURL 或 params。拒绝 URL userinfo、非 HTTP(S)、歧义编码斜杠/反斜杠和路径中的原始反斜杠。

本站范围匹配 origin，pathname 为范围根路径或以根路径加 `/` 开头；认证根为 origin `/` 时按该 origin 全路径处理，不能产生 `//` 比较错误。第三方 origin、/api-other、/docs 和不同端口不匹配默认 /api。

范围匹配且当前 token 非空、没有显式 Authorization 时添加 Bearer；显式认证头保留，只有其值等于当前 Bearer Token时才具备清理本站会话资格。没有 Token的本站请求仍可发送，受保护 operation由 Server验证。

Node 的带本站认证请求使用 HTTP adapter 和 maxRedirects:0；browser 使用 Axios fetch adapter 的 fetchOptions.redirect:error，并设定不自动携带 cookie。内部策略不可被调用方覆盖。重定向失败可作为 HTTP/网络错误，不能导航到第三方或转发 Token。

实施前选定受支持的 Axios 发布版本，核对发布产物的 fetchOptions、signal、FormData 和 timeout 行为；锁文件记录版本。依据是 [Axios fetch adapter](https://axios.rest/pages/advanced/fetch-adapter)、[官方源码](https://github.com/axios/axios/blob/v1.x/lib/adapters/fetch.js) 与 [请求配置](https://axios-http.com/docs/req_config)。不能把当前源码验证等同于选定版本的实测。

### 5.3 Token 初始化与持久化

browser 默认实例创建时尝试读取 localStorage 的 exwebsite.auth.token。工厂只在最终登记的本站认证范围与当前页面 origin 下 /api一致时允许读取该旧 key；其他范围初始 Token为空。Node 和存储内部实例不读取浏览器存储。

SDK 内部 runtime 适配暴露安全读取初始 Token、清除仍匹配的持久 Token、通知与导航能力；这些是内部组合接口，不扩大公开配置面。浏览器适配在其初始化读取确实绑定同源 Token存储时，才可执行对应持久清理。切换本站范围解除这个绑定，不能删除旧站 Token。

本站的应用级 auth session 模块整合 `apps/web/src/auth/storage.ts` 的写入、清除与跨标签监听：登录持久化成功后 setToken，退出成功后清除对应存储并 setToken(null)。模块维护给 AuthProvider/设置控制器订阅的认证状态版本；UI 不能依赖一个缺少通知的 SDK 内存 setter。

该模块由根生命周期绑定并负责卸载，不在每个页面重复监听。跨标签事件读取新 Token后更新内存及显示状态。同标签写入走该模块并主动同步。初始 SDK 读取失败不阻止公开请求；本站 AuthProvider仍可将存储不可访问显示为 unavailable，不能把一次 SDK容错误认为浏览器持久化成功。

远程 VITE_API_BASE_URL 场景在唯一 Web组装处显式登记该远程本站。应用认证存储适配以该明确配置绑定其本地 Token来源，初始化读取后通过 setToken提供，不让 SDK猜测第三方存储归属。

### 5.4 会话失效事务

请求快照包含 scopeRevision、tokenRevision、websiteBaseUrl、实际认证 Token及是否具备管理本站会话资格。实际 Token和清理比较值不进入错误、通知、日志或公开失效回调。

触发前校验最终目标、401、有效 SESSION_INVALID envelope、快照仍为当前版本及认证资格。无 Token的自动本站请求也可触发，但仅当当前仍没有后来设置的 Token。

同步临界段：先获得当前版本失效锁，再清空内存 Token并保留该版本为已失效，进行匹配持久清理，随后运行环境动作。内部失效清空不调用公开 setToken，不解除自己的锁；显式新 setToken才产生新版本。

浏览器默认清理后调用已激活宿主的失效通知（alert允许时），再 location.replace到默认 origin下/login；已有同一登录入口不重复跳转。onSessionExpired存在时接管默认导航；回调返回 Promise时安全捕获 rejection，但不等待回调完成才拒绝原请求。Node默认不导航，只有显式回调会运行。

并发请求逐个拒绝，但同一版本只运行一次清理、一次环境动作和一次失效提示；过期快照只拒绝原请求。alert:false仅关闭提示，不关闭处理。存储内部runtime不清理应用Token、不导航，见第9节。

SSO接收流程的失效回调根据当前有效 ssoRequestId回到相同登录容器，保留现有参数校验；不合成SSO普通会话。AuthProvider和设置快照继续使用现有异步generation/revision检查。

## 6. 错误、通知和期限

普通请求默认30000ms，timeout只允许非负有限数，0显式关闭客户端期限；存储阶段保留120000ms。主动AbortSignal中止分类为CANCELLED，客户端期限到期或signal.reason明确为TimeoutError时为TIMEOUT；已有取消信号不发送请求。没有自动重试或Token刷新。

解析失败正文前校验内容类型和规模：JSON envelope严格检查root仅有error，error仅有必填code/message/requestId且均为字符串，与Contract的additionalProperties:false一致；二进制错误只在JSON媒体类型且正文≤64KiB时解码。其他失败使用HTTP状态分类和固定提示，不显示HTML或原始异常。Retry-After支持非负秒数及HTTP日期，规范化为可选等待秒数，不驱动重试。

错误正文和X-Request-Id同时存在时以正文为错误对象requestId来源；Server一致性测试必须证明二者一致。requestId不用于请求重放、身份或幂等判断。

alert按单次→实例→true取值，并在发送时快照为本次resolvedAlert，后续setAlert不改变在途请求的选择。取消默认不通知；有效本站安全message可展示，其他情况使用固定中文文案。不同来源的message不可透传给ExMessage。通知缺少宿主或抛错时跳过，不缓存，不替换原ExAxiosError。实例初始化不发送消息。

browser从外部同一@exre/exui实例调用ExMessage.error；已有ExMessageContext由消费应用提供。Node不importExUI。UI字段、页面持续错误和已有loading任务使用alert:false；临时反馈按需求保留。401失效由单独状态机去重，普通错误不新增全局消息去重机制。

## 7. Server 与 OpenAPI 接线

### 7.1 请求和响应正文

不改变任何现有operation、请求schema、security或成功状态。path/query/JSON/multipart按既有Contract；成功直接业务正文，失败为原ErrorEnvelope。错误code仍是schema中的string，现有Server分类继续集中构造，不把200当业务错误。

文件和流仍走现有reply.send；网络断开或header发送后的流失败继续关闭连接，不尝试再补JSON错误或第二份header。需要requestId的保证限定为Server实际产生的HTTP响应，无法给未形成响应的连接故障伪造一个响应头。

### 7.2 Request ID

在Fastify工厂显式保持requestIdHeader:false，使用server生成的request.id；不将入站X-Request-Id作为日志身份。根onRequest首先设置reply.header('X-Request-Id', request.id)，覆盖正常、前置校验、未找到路径与预检的响应；必要的onSend一致性断言不改正文。

Contract增加 `components.headers.RequestId`（非空string）并在每个显式成功响应、共享ErrorResponse和RetryableErrorResponse引用X-Request-Id。只增加响应头，不收紧请求或改body。现有Cache-Control、Retry-After和文件头保留。

Fastify生命周期和入站ID开关以 [Hook文档](https://fastify.dev/docs/latest/Reference/Hooks/) 和 [Server配置文档](https://fastify.dev/docs/latest/Reference/Server/#requestidheader) 为依据。现有上传截止时间和释放hook注册顺序不得被新hook替换。

### 7.3 CORS配置

SERVER_CORS_ALLOWED_ORIGINS采用逗号分隔列表，trim空白，空值/未设置表示禁用，去重并规范化为origin。只接受HTTP(S) origin，允许一个根尾斜杠，拒绝子路径、userinfo、query、fragment、wildcard、null和空的中间条目。非法配置在监听前失败，只报告变量名与安全原因。

Server入口解析不可变配置，传给CreateAppOptions；测试显式注入白名单，不读取本地环境。默认同源没有Access-Control-Allow-Origin。允许来源精确回显该origin，合并Vary:Origin，不发送Access-Control-Allow-Credentials。

普通允许来源的响应暴露X-Request-Id、Retry-After、Content-Disposition。允许的请求头为Authorization和Content-Type，大小写不敏感。允许方法从Contract操作集合提取，不维护第二份业务方法清单。

根onRequest在requestId设置后处理/api或/api/前缀的有效OPTIONS预检：检查Origin、Access-Control-Request-Method和请求header集合；白名单命中且方法/header允许时返回204无body，响应包含允许项、Vary相应请求头及X-Request-Id。不在首版设置预检缓存时间。非允许来源不给任何授权CORS头；非法/不支持的预检返回现有统一400错误。OPTIONS缺少预检字段继续走原404边界。

该hook是已确认的协议基础设施例外，不创建Fastify业务route、不伪造operationId、不削弱serviceHandlers覆盖。未知API路径可以通过预检，但后续业务请求仍404；预检成功不证明资源存在或认证成功。/api之外不处理CORS。实际Bearer验证仍由Glue和现有上传认证前移负责。

## 8. Web迁移规则

`apps/web/src/api/client.ts`引入SDK HTTP browser入口，解析VITE_API_BASE_URL，登记明确本站范围，创建transport并注入生成式Client。应用认证适配和回调在该唯一组合边界接线，不让共享UI import SDK或Client。

逐模块迁移：

| 消费者                    | 必须保留的交互与迁移方式                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| AuthProvider/退出/资料    | 用统一Token策略；成功得到正文；catch分类错误；保留unavailable与generation检查                         |
| 普通登录                  | alert:false；仍映射密码错误到字段；持久化成功后同步内存；保持完成导航                                 |
| SSO inspect/login/confirm | alert:false；保留无效入口、fatal/retry分支、ssoRequestId和sessionStorage成功记录                      |
| 邀请注册                  | 直接正文/catch；CODE等错误继续表单显示；completionToken不能当本站Token                                |
| 设置资料与头像            | 移除重复认证头和过期分支；保留snapshot/revision、保存结果及已有反馈                                   |
| 申请提交                  | 提前构造FormData，保留application JSON Blob、proofs文件名/媒体类型和64KiB文字预算；大上传显式120000ms |
| 申请结果/审核             | 保留查询参数、分页、持续错误与loading句柄；HTTP状态从ExAxiosError.status判断                          |
| dev health                | alert:false；成功正文直接读取，catch输出安全开发信息，不依赖旧error对象                               |

现有bodySerializer停止使用；业务只负责FormData结构，Client/ExAxios负责发送。既有测试mock从resolve({data/error/response})迁移到resolve(body)/reject(ExAxiosError)。HTTP状态和响应头断言由app.inject或真实socket fixture承担，不能删减原覆盖来让新API通过。

## 9. 存储兼容适配

createSdk保留原baseUrl和getAccessToken，不使用默认ExAxios共享状态。用同一内部HTTP核心创建存储专用实例，登记其baseUrl范围；内部runtime初始Token为空、清理持久Token与通知为no-op、失效导航为no-op。

每个本站请求阶段调用一次现有getAccessToken，快照该返回值，按当前请求显式加入认证头；不得将并发上传的Token写进共享实例来等待发送。Token为空仍映射UNAUTHORIZED。prepare/file upload/complete均用同一生成式Client、120000ms期限和alert:false。

ExAxiosError通过安全字段映射回StorageSdkError：SESSION_INVALID→UNAUTHORIZED；TIMEOUT和CANCELLED→TIMEOUT；NETWORK_ERROR→NETWORK；其他沿用现有Server code/status映射。已识别HTTP错误保留status/requestId和原sanitizeDetail行为；不能先把所有ExAxiosError归为NETWORK。COS原始异常仍走既有适配，不把临时凭证或票据公开。

COS PutObject和凭证管理不改，直传失败不complete，complete失败不自动重传。存储Token getter逐阶段调用、结果URL、阶段资源释放和已有storage异常语义须回归。

## 10. SDK产物与依赖

新增HTTP源码环境入口，发布exports规划如下；名称为本RFC的绑定选择：

| 导入入口                                                  | 条件运行时                     | 内容                                                                 |
| --------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| `@workspace/sdk`                                          | browser/node，default为browser | 保留createSdk和原存储类型，增加ExAxios、工厂、错误与typed Client工厂 |
| `@workspace/sdk/browser`、`@workspace/sdk/node`           | 明确环境                       | 保留现存用法，增加对应HTTP导出                                       |
| `@workspace/sdk/http`                                     | browser/node，default为browser | 仅HTTP能力和生成类型，绝不import COS入口                             |
| `@workspace/sdk/http/browser`、`@workspace/sdk/http/node` | 明确环境                       | 非条件解析工具可显式选环境                                           |

Axios是SDK运行时dependency，在产物中保持外部包，由安装的依赖提供；api-client适配和生成类型内联。ExUI是optional peer，仅browser通知实现引用，需外部化并使用消费方实例。Node声明和运行时代码不依赖ExUI/React，HTTP入口不加载COS；公开类型不含私有workspace import。根browser入口因新增通知导出需要ExUI peer，README须明确这个依赖变化，不能声称浏览器依赖契约完全不变。

Vite增加HTTP独立entry和external匹配；声明构建增加对应入口、合并生成类型、保留axios这个公开运行时dependency的类型引用。workspace配置不能用手写声明模拟外部SDK验收。Web使用HTTP入口并沿用现有单React/ExUI实例的dedupe策略。

## 11. 依赖与落地顺序

本特性跨Client/SDK/Web/Server且结果协议共同变更，因此一个RFC和一次一致的集成落地即可。内部可以按以下依赖顺序开发，但不能发布半迁移产物：

1. Contract响应头定义，lint/generate；CORS配置与hook设计同步落地，但不改业务body。
2. Client transport和生成式类型适配；验证方法/输入/返回的编译边界。
3. SDK HTTP核心、browser/Node适配、Token快照、错误和条件导出。
4. Web组合边界、认证存储与消费模块，以及原测试结果协议迁移。
5. 存储兼容适配和真实HTTP fixture；再移除openapi-fetch依赖和旧接口实现。
6. SDK用法、Server环境示例、AGENTS请求链说明和CORS基础设施例外；运行完整验收。

贡献/提交按 `CONTRIBUTING.md`；这份RFC不要求建分支、提交或推送。稳定`.ai/`知识提炼需按原规则另得用户同意。已存在的依赖配置改动不因本RFC而自动归属该特性。

## 12. 验收矩阵与执行规则

下列为实施验收要求，当前RFC阶段尚未执行。

| ID  | 层次                 | 必须证明的行为                                                                                                             |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| T01 | TypeScript fixture   | ExAxios<T>为Promise<T>，缺省unknown；typed方法/路径/必填body/path/query检查，不能手写DTO覆盖；multipart仅适用相应operation |
| T02 | HTTP核心单元         | 参数白名单、非法setter原子性、Node未配置地址；正常URL拼接、编码路径、绝对覆盖、端口及/api-other边界                        |
| T03 | HTTP核心单元         | Token初始化容错、即时setter、范围变化清空、不复用远程Token、显式Authorization与自动认证的资格区别                          |
| T04 | 并发fixture          | 旧Token/旧范围迟到401不影响新会话；当前版本并发401仅一次清理/提示/回调；显式新Token重新使能                                |
| T05 | 错误与通知           | 网络、取消、timeout、HTTP、无效JSON、二进制错误体、Retry-After解析；alert请求优先、host缺失和回调失败不覆盖原错误          |
| T06 | 真实HTTP与browser    | 可信origin下302/307向/api外与其他origin均不转发Token；接收fixture证实零泄漏，不以mock替代重定向证明                        |
| T07 | Contract与实际路由   | 成功/错误/文件/未声明路径/预检的requestId头；入站伪造ID不被采纳；error正文与日志一致；原始handler和operation双向覆盖       |
| T08 | CORS真实HTTP/browser | 白名单允许与拒绝、Authorization预检、方法/header拒绝、默认禁用、Vary合并、暴露头；实际业务仍需认证                         |
| T09 | Web交互回归          | 登录/SSO/邀请/退出/资料/头像/申请/审核保留字段及持续错误、loading、异步版本保护和Token存储同步                             |
| T10 | storage真实fixture   | getter逐阶段、并发Token不串用、COS不带本站认证、阶段超时/取消与StorageSdkError分类、失败停止后续阶段                       |
| T11 | 外部产物消费         | 使用实际dist的browser/Node/HTTP入口；Node工程无React/ExUI也可运行；HTTP无COS；类型无源码别名或私有包名                     |
| T12 | 全量集成             | api:lint/generate、typecheck、Vitest、build及独立产物验收，生成结果无意外body漂移                                          |

拟新增测试按模块放入 `tests/sdk/`、`tests/api-client/`、`tests/contract/`，Web交互测试沿用相邻test文件。类型负例使用实际tsc编译与预期错误断言，不能仅用Vitest跑未类型检查的代码。

Node HTTP测试使用回环临时端口并关闭fixture；协议tests可直接使用原生Node HTTP获得status/header。测试里的原生HTTP只用于独立协议验证，不为产品创建第二请求入口。全局fetch mock不足以覆盖Node Axios HTTP adapter。

browser实测使用真实ExMessageContext、允许的本地独立origin、API fixture，验证显示和CORS；需要账户/数据库场景仍使用独立Testcontainers。选定Axios版本的redirect和FormData测试是阻断项，不以官方文档或单元stub代替。

执行命令：pnpm api:lint → pnpm api:generate → pnpm typecheck → pnpm test → pnpm build。外部SDK消费者用构建产物另外验证。每项报告PASS/FAIL/NOT_EXECUTED；Docker不可用不回退本机exre，不把build/typecheck当browser或Node运行验收。

## 13. 兼容、回滚与风险

HTTP body/状态不变，新增header属于加法。Client源码接口的data/error/response结果改为body/rejection，是明确的客户端破坏性变化，所有仓库调用和测试须共同落地；不自行给HTTP API发明版本层。SDK此前未在本范围发布，新发布仍需单独授权。

出现类型回归、Token泄漏、CORS误放行、失效循环、multipart变化或StorageSdkError漂移时停止验收。应用回滚须同时恢复Client、SDK、Web调用与对应依赖/测试，不能只换请求引擎留下新结果协议。Server头与CORS可以一并回退，CORS通过移除配置即时禁用。localStorage键和数据库结构不变，因此无数据恢复或回填；不删除已持久化Token或上传文件。

| 风险                                  | 对策与检测                                                  |
| ------------------------------------- | ----------------------------------------------------------- |
| 发布版Axios与当前源码适配不同         | 实施入口先验证发布产物，T06/T10/T11失败即不接受             |
| 手写泛型误用为运行时验证              | README和类型用例明确unknown默认及本站typed入口，T01覆盖     |
| 旧请求清理新Token或会话跳转循环       | 版本快照与失效锁，T04和SSO交互回归                          |
| SDK打包第二份ExUI或Node间接加载UI     | external/optional peer/条件入口和独立consumer，T11覆盖      |
| multipart或测试因结果协议迁移失去覆盖 | T07/T09/T10保留真实状态、header、字节、文件名和资源释放断言 |
| CORShook误变为业务旁路                | 仅根预检hook、严格范围与serviceHandlers双向覆盖，T08覆盖    |
| 日志/公开错误泄露认证或云票据         | 安全字段白名单、原有sanitizer和异常日志回归                 |

## 14. 自审、未决项与交接

已依据技术设计质量清单核对：设计来源保持不变；依赖无环；输入、成功正文、错误、并发、环境和CORS契约明确；旧结果协议和multipart测试迁移有接收方；存储兼容例外和浏览器peer变化已明示；验收与回滚覆盖主要风险。

没有需要再次交给用户决定的架构问题。Axios具体发布版本、受控CORS本地测试origin及外部产物fixture路径是实施时依据实际环境选择并记录的值；不得为便于测试放宽来源或跳过关键行为。实施角色负责版本/fixture选择，测试角色负责真实验收；不预先指定人员。

源码与文档核对已执行；接口尚未实现，类型、单元、Contract、真实HTTP、browser、Node产物检查均为NOT_EXECUTED。RFC细化不表示代码、运行时或生产验收通过。后续实施需要独立任务授权，本次设计交接到此结束。
