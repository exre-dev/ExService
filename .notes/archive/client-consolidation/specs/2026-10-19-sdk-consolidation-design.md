# SDK 客户端收敛设计

- 日期：2026-10-19
- 状态：用户已确认目标包、单例导出与对象调用；完整设计待审阅。
- 模块根目录：`.notes/client-consolidation/`
- 后续 RFC 目录：`.notes/client-consolidation/rfcs/`
- 本文定义目标行为，不表示已经实现、测试通过、发布或部署。

## 1. 目标与确认范围

将 `packages/api-client/` 并入 `packages/sdk/`，统一使用 `@workspace/sdk`。保留可供其他工程独立消费的 Browser、Node ESM 产物，`packages/common/` 继续独立维护共享纯逻辑。

用户已明确：

1. 合并方向是 api-client 进入 SDK，取代此前保留 api-client 包的讨论方案。
2. 消费方直接导入 `storage`、`instance` 和配置方法，不创建 SDK 或 HTTP 客户端实例。
3. `ExAxios` 改名为 `instance`，调用形式是 `instance({ ... })`。
4. 提供 `setBaseUrl`、`setAccessToken`，配置同时作用于 `instance` 和 `storage`。浏览器通常自动使用默认配置，Node 通常显式设置。
5. Browser、Node 访问本站服务统一使用 SDK；其他业务站点可以自行选择 fetch 或其他请求工具。
6. 将这条请求规范同步到 `AGENTS.md`。

本设计同时给出实现上述要求必需的接口细节：Contract 类型推导、共享配置变化、浏览器会话接线和构建迁移。它们由本次完整设计审阅一并确认。

## 2. 现有实现与调整理由

| 当前事实                                                           | 来源                                                                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Client 提供生成类型及 GET、POST 等类型化调用，必须注入 transport   | `packages/api-client/src/client.ts`、`packages/api-client/src/transport.ts`                                      |
| SDK 提供 Axios 请求策略，转导出 Client，并单独维护上传流程         | `packages/sdk/src/http/`、`packages/sdk/src/shared.ts`                                                           |
| Web 创建 HTTP 实例，再组合 Client，认证适配同步内存 token          | `apps/web/src/api/client.ts`、`apps/web/src/auth/storage.ts`                                                     |
| Server 只通过 Client 的类型入口消费 DTO 和 operations              | `apps/server/src/http/handler-types.ts`、`apps/server/src/modules/storage/api/transport.ts`                      |
| SDK 使用独立 Browser、Node 产物和声明合并，根 typecheck 先构建 SDK | `packages/sdk/package.json`、`packages/sdk/vite.config.ts`、`packages/sdk/rollup.config.dts.mjs`、`package.json` |
| 上传的凭据来源目前与 HTTP 实例分开配置                             | `packages/sdk/src/shared.ts`                                                                                     |

现有功能并非两份相同实现，主要问题是调用者需要理解多个工厂、两个包和两种凭据配置方式。此次将分层保留在一个包内部，外部只暴露一个本站请求入口。

此前比较过保留 api-client、保留 SDK、新建 client 包三种方向。用户选定保留 SDK；不再新增第三个客户端包，也不为旧包保留转发兼容层。

## 3. 包结构与产物边界

目标内部职责如下，实际文件划分由 RFC 固化：

| 模块                          | 职责                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `packages/sdk/src/generated/` | 唯一一份从 HTTP Contract 生成的客户端类型。                                  |
| SDK 请求类型适配              | 从生成类型推导对象配置、必填字段与成功返回类型，序列化 path、query 和 data。 |
| SDK HTTP 核心                 | 唯一 Axios 引擎、期限、取消、错误、安全请求策略和会话版本检查。              |
| SDK 配置与环境适配            | 单例地址、凭据来源、Browser 会话及通知、Node 环境适配。                      |
| SDK storage                   | 归一化上传输入、申请上传、file 或 COS 上传、确认并返回 URL。                 |

公开入口只保留：

- `@workspace/sdk`：按 browser、node 条件解析对应运行产物；default 与现有 SDK 一致选择 browser。公开函数签名在两种环境一致。
- `@workspace/sdk/types`：仅提供生成的 `paths`、`operations`、`components` 类型，供 Server NodeNext 编译使用，没有运行时入口。

运行产物与声明从 `dist/` 消费。类型入口不要求引入 HTTP、DOM、Axios、COS、ExUI 或 React 的声明；不得因 Server 导入 DTO 而加载运行代码。构建产物不残留私有 workspace 依赖、仓库源码别名或本机路径。

移除旧的 `@workspace/api-client` 包，以及 SDK 的 browser、node、http 等重复公开子入口。内部可保留普通 factory 便于依赖注入和单元测试；它们不进入 `exports`，消费方不能绕过公开入口创建独立客户端。

Browser 根入口沿用静态 ExUI 通知适配。独立 Browser 消费方必须安装兼容的 ExUI 及其 peer，并在需要显示通知时挂载单一 ExMessageContext；缺少 ExUI 时导入失败，不提供另一套通知 fallback。optional peer 元数据用于允许仅消费 Node 的工程不安装 ExUI，不表示 Browser 无需该依赖。

HTTP 核心和 Node 产物不依赖 ExUI、React 或 DOM。仅导入、调用 `instance` 时不加载 COS；storage 首次需要 COS 时再加载环境对应的传输实现。此处限制的是运行加载，不承诺安装时删除 COS 依赖。

同一运行环境的根导入共享同一份配置、错误类和实例。分别构建 Browser 与 Node 不代表两套可由消费方任意混用的配置。

## 4. 目标公开用法

下列是目标用法，当前源码尚未提供这些接口。

### 4.1 浏览器

```ts
import { instance, storage } from '@workspace/sdk'

const health = await instance({ url: '/health' })

const notifications = await instance({
  url: '/notifications',
  method: 'GET',
  params: { view: 'unread', limit: 20 },
  alert: false,
})

// file 是调用方取得的 File；返回 URL 字符串。
const url = await storage.upload('demo/example.txt', file)
```

浏览器默认地址为当前 origin 的 `/api`。本站应用的普通调用不需要初始化 SDK、传 token getter 或重复拼接 Authorization。

### 4.2 Node

```ts
import { instance, storage, setBaseUrl, setAccessToken } from '@workspace/sdk'

setBaseUrl('http://127.0.0.1:8080/api')
setAccessToken(accessToken)

const health = await instance({ url: '/health', method: 'GET' })
const url = await storage.upload('demo/example.txt', bytes)

setAccessToken(null)
```

Node 导入模块时不发请求，也不要求已经设置地址；第一次请求前必须设置绝对 HTTP(S) API 根地址。公开 operation 可以在没有 token 时调用，认证是否必需仍由 Contract 和 Server 决定。一个模块单例对应一个当前站点及凭据上下文，不新增多账号并发客户端或请求级配置工厂。

### 4.3 路径参数和请求正文

```ts
const notification = await instance({
  url: '/notifications/{notificationId}',
  method: 'GET',
  pathParams: { notificationId },
})

const uploadResult = await instance({
  url: '/storage/uploads',
  method: 'POST',
  data: formData,
  alert: false,
  timeout: 120_000,
})
```

`notificationId`、`file`、`bytes`、`accessToken`、`formData` 均表示调用方已有的输入；示例不提供业务账号、真实凭据或外部服务信息。

## 5. instance 的对象契约

| 字段                | 约定                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `url`               | Contract 中的路径模板，不包含 `/api` 前缀；类型层拒绝未声明路径。                                         |
| `method`            | 默认 GET；可用方法与 url 从 Contract 联合推导。接受对应方法的全大写、全小写写法，发送前统一大写。         |
| `pathParams`        | 从 operation 的 path 参数推导；存在必填路径参数时必填，逐个编码后替换模板。                               |
| `params`            | 从 operation 的 query 参数推导；保持 Axios 风格，不再嵌套 path/query 两层。必填 query 使该字段必填。      |
| `data`              | 从 operation 的请求正文推导。JSON 使用 Contract 类型，multipart 使用 FormData，必填请求正文使该字段必填。 |
| `headers`           | 保留受控请求头。显式 Authorization 用于现有旧会话撤销等流程；失败不能清理另一份当前凭据。                 |
| `timeout`、`signal` | 沿用请求期限和取消语义。                                                                                  |
| `responseType`      | 保留 json、text、blob、arraybuffer；返回类型随显式模式变化。                                              |
| `alert`             | 默认 true。false 只关闭本次临时通知，不吞错误，也不关闭会话失效处理。                                     |

成功结果直接是正文，不返回 Axios response 或 data/error/response 三元对象。成功正文从对应 operation 的 2xx 响应推导；不提供由调用方任意指定成功 DTO 的泛型逃生入口。Contract 类型约束是编译时保证，不新增客户端运行时业务 schema validator。

保留对当前 Contract 所用路径和查询序列化方式的验证；查询数组使用重复键，undefined 被省略。JSON 与 FormData 保持现有发送语义，multipart boundary 由运行时生成。

公开 instance 不接受第三方完整 URL 或任意 Axios 底层配置。不开放 adapter、socketPath、transport、Host、成功状态判定或响应变换；运行时仍检查参数与最终目标不越出配置 API 根目录。未声明 operation 的类型错误不能用手写 DTO 绕过。

只提供可调用的 `instance({...})`。不新增 `instance.GET`、`instance.get` 等第二组调用接口，不在 instance 上重复挂载配置 setter。

## 6. 共享配置与请求快照

### 6.1 setBaseUrl

`setBaseUrl(url: string): void` 设置唯一的本站 API 根地址，也同步改变本站认证范围。浏览器可以使用相对地址，Node 只接受绝对 HTTP(S) 地址；拒绝 URL 用户信息、query、fragment、非 HTTP(S) 协议和会导致目录范围歧义的路径。

不再区分普通请求地址与 websiteBaseUrl，也没有 `{ website: true }` 选项。第三方请求由 SDK 外部工具负责。地址已包含 `/api` 等服务实际前缀，SDK 不猜测或补写服务前缀。

规范化地址不变时不推进配置版本；实际地址变化时清空旧的显式内存 token，推进配置及凭据版本。调用方按先 setBaseUrl、后 setAccessToken 的顺序为新站点配置凭据。旧 token 不随地址变化转移，不删除原站点持久会话。

浏览器只有在目标等于当前页面默认 API 根时才自动接入当前页面的持久 token。指向其他 API 根时必须显式提供对应 token，不借用当前页面凭据。

### 6.2 setAccessToken

`setAccessToken(token: string | null): void` 设置或清空共享内存凭据。拒绝空字符串与控制字符，非法输入不改变原状态。重复设置相同的当前有效凭据不推进凭据版本；判断当前值时包含已经观察到的持久会话，不能只比较尚未同步的内存缓存。

Node 的凭据只来自这个 setter，不持久化、不刷新。浏览器的显式调用也只改变内存，不代替应用登录或向 localStorage 写凭据。浏览器在默认站点时，显式内存凭据覆盖当前观察到的持久值；只有持久值真正改变，才恢复按新持久值同步。这样退出时即使持久删除失败，显式清空也不会在下一次请求被旧持久值恢复。

普通浏览器调用无需执行 setter。SDK 在发送前同步现有 `exwebsite.auth.token`，登录、登出与跨标签页变化会影响随后请求。自动来源读取失败时不自动发送凭据；显式设置的内存凭据仍只作用于已配置的目标，明确清空不会因读取失败被撤销。应用现有认证状态同步和请求 generation 检查继续保留。

### 6.3 正在进行的请求

每个请求发送前捕获最终地址、实际 Authorization、配置版本和凭据版本。setter 只影响后续请求，不把已发送的请求改投其他地址。旧请求的迟到失败不得清空新 token、改变新会话 UI 或执行新会话的登录导航。

storage 是多阶段操作：开始时先解析当前有效配置与凭据，再捕获上下文版本。prepare、file/COS 写入、complete 每个新阶段前，都先重新读取适用的浏览器持久 token、按来源优先级计算有效凭据并更新版本，再与上传开始的上下文比较。不能只比较 setter 最后维护的 revision；跨标签页或同标签页直接写入存储、尚未触发订阅的变化也必须被发现。

阶段复核通过后的地址、认证头与期望版本绑定为该次发送快照。内部发送处若再次发现版本变化，在发送前拒绝，不允许使用旧票据配上新 token。该绑定留在共享请求管线内部，不增加公开请求级凭据或配置字段。

上下文发生实际变化时停止启动后续阶段，并抛出 `StorageSdkError`，新增稳定 code 为 `CONFIG_CHANGED`。已发送阶段不承诺可以撤销；不自动删除已经写入的对象、不重试、不将旧票据提交到新地址。相同配置值的重复 setter 不打断上传。

COS 运行库首次加载也属于异步阶段；加载完成后先刷新有效凭据、复核上下文才开始云写入。上传成功最终返回前也执行同样的刷新与比较，覆盖 file 请求或 complete 请求期间发生的持久 token 变化，避免将前一会话的迟到结果用于后一会话。

## 7. 浏览器会话、错误与通知

保留 `ExAxiosError`、`StorageSdkError` 及现有安全字段，移除的是 ExAxios 实例名，不另建平行错误体系。HTTP 错误继续携带 kind、code、可用的 status、requestId、retryAfterSeconds；storage 继续映射为已有错误 code，另增加上一节的 CONFIG_CHANGED。

只有当前本站请求的 `401 + SESSION_INVALID` 可以使对应会话失效。处理前先刷新当前有效凭据并比较请求快照，来源清理规则如下：

- 自动持久来源：只删除仍等于失败请求 token 的持久值，再清空对应内存会话；持久值已经变化时同步新值，旧请求不触发失效 handler 或导航。
- 显式内存来源：只清空仍匹配失败请求的显式内存 token，不删除另一份持久 token。保留对未变化持久值的空值覆盖，不悄悄回退到旧持久 token；只有后续持久值真正变化或再次显式设置才改变有效凭据。满足当前版本检查时，和自动来源一样执行一次失效 handler 或默认导航。
- 请求级显式 Authorization 与当前有效凭据不匹配：仅返回该请求错误，不清理当前内存或持久会话，也不执行会话 handler。

并发失败按会话版本至多处理一次。其他 401、网络失败、取消和超时不删除登录凭据。SDK 内部因失效执行清空后，对应上传保留原始 UNAUTHORIZED 错误，不以随后发生的版本变化覆盖它。

新增一个命名导出的应用集成方法：`setSessionExpiredHandler(handler: ((context) => void | Promise<void>) | null): void`。context 只包含既有安全错误与计算出的 loginUrl。它替代原 HTTP 工厂中的 onSessionExpired 配置，是单例应用接线，不创建实例。

- Browser 未设置 handler 时沿用默认登录导航；设置后由 handler 接管。handler 抛错或 rejection 不覆盖请求原错误，也不再执行另一遍默认导航。
- Web 根接线安装现有处理逻辑：同步认证显示，保留支持中心、身份挑战页和带 ssoRequestId 的登录页对失效状态的处理，避免跳转丢失上下文。清理该接线时恢复默认 handler。
- Node 默认只抛错；显式安装 handler 时可以观察失效，但不会获得浏览器存储或导航行为。

浏览器登录写入、退出清理、跨标签页订阅仍由现有认证适配负责。移除针对旧 HTTP 工厂的绑定；异常退出路径可使用 setAccessToken(null) 保证内存清空。正常登录与持久 token 真正变化后继续自动同步，业务请求处无需 setter。

浏览器通知继续使用消费方提供的 ExMessage 与一个根宿主，不导入全局样式、不另建通知系统。表单和持续错误保留现有 alert:false 及页面内展示方式。

## 8. storage 共享行为

`storage.upload(key, data, options?): Promise<string>` 保留现有 key、二进制输入、medium 和 contentType 语义。取消 getAccessToken 参数，地址和认证均取自共享配置。缺少 token 时继续抛 StorageSdkError UNAUTHORIZED，不发送上传请求。

prepare、本站 file 上传和 complete 都经同一 instance 请求管线。COS PutObject 使用环境对应的云 SDK，不是本站 API 请求，不附带本站 Bearer token；每次上传独立持有凭据与上传票据。

保留 120 秒阶段期限、不自动重试、单次 PutObject、服务端介质决定、大小预检、URL 返回值与原错误脱敏。file 或 COS 阶段失败不继续 complete。

storage 的本站阶段使用 alert:false，防止每个阶段重复弹消息。会话失效仍按共享 instance 的规则处理；这与此前 storage 专用实例禁用交互式失效处理不同，是本次统一会话配置的明确行为变化。上传异常仍映射成 StorageSdkError，由调用者处理整体上传结果。

## 9. Contract、消费方与构建迁移

### 9.1 生成与类型

- HTTP 源仍是 `api/openapi.yaml`、`api/paths/`、`api/schemas/`，不修改 HTTP endpoint 或服务端响应形状。
- `scripts/api/generate.mjs` 将类型输出迁移到 `packages/sdk/src/generated/schema.d.ts`；`api/generated/openapi.json` 位置不变。迁移生成物由生成命令完成，禁止手工复制维护 DTO。
- `@workspace/sdk/types` 从产物提供原始生成类型，Server 的所有 type-only import 迁移到该入口。
- api:generate、api:check、类型夹具、Server NodeNext 夹具共同覆盖新位置，生成类型仍纳入版本控制。

### 9.2 应用与测试

- Web 的 GET/POST 等调用迁移成 instance 的对象配置，body 改为 data，params.path/query 分别改为 pathParams/params。
- `apps/web/src/api/client.ts` 只承担主站会话集成，不再创建客户端、注入 transport 或提供第二份请求接口。VITE_API_BASE_URL 若仍被现有运行入口显式提供，只在这一接线点调用共享 setBaseUrl；普通业务代码直接消费 SDK。
- 保留登录、SSO、邀请、资料、通知、反馈、multipart、显式旧 token 撤销和异步代次保护，不通过删测试或重建 DTO 完成迁移。
- 单元测试可以通过包内普通工厂隔离环境和传输。应用测试 mock 统一公开 SDK；独立消费验收必须使用真实 dist，不能只靠源码 alias。
- 移除 `packages/api-client/`、旧依赖、旧运行子入口和仅服务旧 Client 包的源码别名。生产代码、活动测试与运行入口不再引用旧包；历史归档按原上下文保留。

### 9.3 构建和日常入口

SDK 继续构建一次 Browser/Node 产物及公开声明，不再内联另一个 workspace Client 包。Axios 与 COS 继续按环境保留所需外部依赖；Browser 的 ExUI 使用消费方同一份 peer 实例。

干净检出在安装依赖后，dev、typecheck、test、build 必须先生成 Contract、再构建 SDK、最后运行所属检查或应用，不能依赖上次构建留下的 dist。SDK 自身的源码类型检查不能被要求先读取自己的 dist。生产 start 只读取准备好的产物，不生成 Contract 或构建 SDK。

测试每轮允许执行必要的 SDK 库构建，但不执行 Web/Server 应用 Build 或真实开发生命周期；相应更新当前测试入口的说明与断言。测试 watch 每轮先生成 Contract 和 SDK，再运行用例。dev 对 SDK 源码或 Contract 变化触发串行重建，准备完成后才让应用消费新产物；失败保留诊断并阻止该轮使用陈旧产物。重建归入现有 runtime 的归属和停止机制，不留下独立后台进程；生成类型、dist 和构建临时文件不再触发下一轮重建。具体协调接线由 RFC 固化。

同步 runtime 的构建顺序、watch 范围、ExUI artifact 检查、Vitest alias 与 COS mock 解析位置，以及 lockfile 的 workspace 结构。常规运行不安装依赖、不改写 lockfile、不修改持久配置或数据库。

独立产物验收可以使用本地打包文件与临时消费工程；不执行 registry 发布、推送或公网部署。

## 10. AGENTS.md 与文档变更

实施时同步更新 AGENTS.md 的包职责、Web 请求约定、生成类型路径与 Contract-first Client 接入说明。规范核心表述为：

> Browser 与 Node 消费本站 HTTP 服务时，统一从 @workspace/sdk 导入 instance 并按对象配置调用，保留 OpenAPI 对方法、路径、输入和响应的类型约束；文件上传使用 SDK 的 storage，其本站请求经过同一 instance 管线。访问第三方业务服务可自行选择 fetch 或其他请求库，本站凭据不进入第三方请求。

Node 初始化和浏览器默认行为写入 SDK README；不把独立 HTTP 测试夹具、协议级断言、Server 自身向第三方服务的出站请求误判为本站业务绕行。

源码与配套文档同步迁移后再更新相应 `.ai/` 当前事实，包括包布局、Contract 生成路径、运行/测试前置条件、会话生命周期和存储陷阱。设计阶段不把尚未实现的 API 写成当前行为；将本设计稳定结论提炼到 `.ai/` 仍遵循项目的用户确认规则。历史 RFC/spec 不批量替换名称。

## 11. 验收条件

| 层次       | 必须证明的结果                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 类型       | 正确的路径、method、必填 path/query/data 和返回值可推导；错误 method、未知路径、缺参、JSON/FormData 混用及手写返回 DTO 逃生被拒绝。                                                                                                                         |
| 单例       | instance、storage、setter 只有一份状态；相同配置不打断上传，非法 setter 原子拒绝。旧工厂、旧方法、旧包和重复子入口不可通过公开 exports 消费。                                                                                                               |
| HTTP       | 真实回环服务验证 URL/path/query、JSON、FormData、二进制、期限、取消、请求 ID 和错误分类；第三方 URL、范围逃逸与认证重定向被拒绝。                                                                                                                           |
| 会话       | 浏览器无需业务初始化即可使用 token；登录后新 token、跨标签页变化、退出和存储异常正确处理；旧 token/旧地址迟到 401 不影响新会话；显式与持久 token 不同时只失效对应来源，不回落旧 token。alert:false 不关闭失效处理。                                         |
| 上传       | file/COS 原有成功失败路径保留；COS 不收到本站 token；阶段之间更换地址或 token 停止后续操作并返回 CONFIG_CHANGED；COS 写入、file 请求或 complete 请求期间直接修改持久 token，即使没有 storage 事件，也在下一阶段或最终返回前被发现；不自动重试或清理云对象。 |
| Web        | 原页面调用迁移后，登录、SSO、邀请、资料、通知与反馈交互保持；会话 handler 不丢挑战/支持中心上下文，通知不重复。                                                                                                                                             |
| 产物       | 实际 dist 在临时 Node 工程中无需 React/ExUI 可以运行；Browser 使用明确安装的 ExUI peer 和宿主；浏览器产物不加载 Node COS，instance 不触发 COS 加载；Server NodeNext 仅消费类型。                                                                            |
| 干净检出   | 不依赖现存 dist 即可完成入口准备；源码变更后使用新 SDK 产物，生成/watch 不形成反馈环。                                                                                                                                                                      |
| 仓库与文档 | api:check 使用新生成路径，活动引用与依赖无旧包，AGENTS.md 与 README 符合新请求约定。                                                                                                                                                                        |

实施验证按既有工作流运行 api:lint、api:generate、api:check、typecheck、test、build；具体命令与独立 Browser/Node 产物夹具由 RFC 细化。真实浏览器、独立 Node 消费、自动测试、构建分别报告，任何一项不能替代另一项；Docker 不可用时不回退开发数据库。

## 12. 范围限制、风险与后续交接

不改 HTTP operation、数据库模型、服务端认证协议或存储后端；不增加刷新 token、自动重试、多客户端、第三方代理或发布流程。AGENTS.md 的调整只针对新的客户端消费规范，不扩大部署权限。

这是 SDK 公开调用方式的破坏性调整。仓库所有调用、测试、生成路径与声明必须一致迁移，不保留旧函数别名或旧包兼容壳。若有未登记的外部消费者，需按新导入方式迁移；本仓库证据不能证明这些工程已经兼容。

主要风险是共享状态下的异步会话串用、Contract 类型在对象调用中丢失、Node 误加载浏览器依赖、应用会话接线遗漏，以及干净检出的产物前置依赖。第 11 节分别给出行为验收条件。

完整 spec 经用户审阅后，交接至 technical-design-doc-creator，在 `.notes/client-consolidation/rfcs/` 生成一个实施 RFC。RFC 固化类型签名、配置状态机、重建接线和测试矩阵；不改写本 spec，也不开始实现。设计文档不自动提交，后续实施、提交、发布各按用户授权执行。
