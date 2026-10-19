# 通用内容存储与 SDK 设计

状态：设计待最终审阅；各节方向已在对话中确认，本文补齐可执行边界。尚未进入 RFC 或实现。

日期：2026-09-29

模块根目录：`.notes/archive/content-storage/`

## 1. 目标与已确认范围

提供统一的“key + 内容 → URL”能力，用于未来的头像、附件及其他内容上传。

- 服务端实现放在 `apps/server/src/modules/storage/`。
- 新建 `packages/sdk/`，为浏览器与 Node.js 提供通用功能 SDK，本期只有 storage 功能。
- 默认支持 FileAdapter，并实际实现可配置启用的 CosAdapter。
- 默认 Adapter 由环境变量决定，调用时可用 `options.medium = 'file' | 'cos'` 覆盖。
- 同一 Adapter 内相同 key 覆盖原内容，不维护版本。不同 Adapter 的同名 key 是不同对象。
- 通用存储不写数据库，不建立文件表，不返回或保存 `file:`、`cos:` 引用；公开上传方法只返回 URL 字符串。
- HTTP 上传、上传准备和完成确认要求现有 Bearer 登录认证；内部代码直接调用服务方法不需要 Bearer。
- 内容不增加读取权限：本地 URL 公开读取，COS URL 持有者在签名有效期内可读取。
- COS 下载 URL 签名有效期为签发起一年，按 365 天计算。
- 默认最大文件大小 20 MiB，即 20,971,520 字节，可通过环境变量调整；不做分块上传。
- 接受 Blob、File、Uint8Array；Node.js Buffer 作为 Uint8Array 支持。
- 本期不迁移现有头像或申请附件，不改变它们的表结构、业务规则和接口。

## 2. 当前仓库依据

- `api/openapi.yaml` 是唯一 HTTP Contract，新增 operation 通过 `apps/server/src/app.ts` 的 serviceHandlers 和 Glue 注册。
- `apps/server/src/app.ts` 已提供 Bearer security handler，并使用 `@fastify/multipart`。全局 bodyLimit 当前为 4 MiB，新上传入口需要独立的传输限制，不能全局放宽所有接口。
- `packages/api-client/src/client.ts` 基于生成的 paths 类型创建客户端。SDK 对本站的请求复用该包，不复制 DTO 或自行使用 fetch 定义本站接口。
- `apps/server/src/profile/service.ts` 当前负责头像转换、本地写入和业务引用；通用存储不接管该业务。
- `.ai/databases/data-model.md` 规定申请附件字节在 PostgreSQL、头像字节在本地；本设计不修改这些规则。
- 仓库根目录当前没有 TESTING.md；后续实现遵循现有 Vitest、Contract Test 和隔离 PostgreSQL 测试惯例。

## 3. 方案选择与模块边界

采用“统一 StorageService + 存储 Adapter + SDK 上传协调”的方案。

Adapter 各自暴露完整 API 会重复认证与 key 校验；所有内容都经过服务器又无法满足 COS 客户端直传，因此不采用这两种方案。

| 单元                       | 职责                                                      | 依赖边界                                     |
| -------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| StorageService             | 校验 key、内容大小，解析 medium，调用 Adapter 并返回 URL  | 不依赖 HTTP、登录会话或数据库                |
| FileAdapter                | 写入本地文件，替换已有内容，提供公开读取所需的文件访问    | 仅限自己的 uploads 根目录                    |
| CosAdapter                 | 服务端上传、读取对象元数据、生成下载签名                  | COS 配置与服务端 COS SDK                     |
| COS 直传协调服务           | 获取限定权限的 STS 凭证，签发和核验上传凭据，完成确认     | COS 能力、凭据签名器；用户身份由 HTTP 层传入 |
| HTTP handlers 与 transport | Bearer 认证、multipart 解析、Contract 输入输出、错误转换  | 调用模块服务，不新增业务数据持久化           |
| packages/sdk               | 接受二进制内容、执行准备、服务器上传或 COS 直传、完成确认 | 本站 api-client；按环境加载 COS 传输实现     |

Adapter 的基础能力包括写入和生成访问地址。公开本地读取、COS 元数据查询和直传凭证属于对应 Adapter 的专有能力，不要求所有未来 Adapter 实现虚假的 COS 方法。

未来新增平台需注册对应 Adapter；若支持客户端直传，还需增加 SDK 的传输实现及对应 Contract 分支。仅新增服务器 Adapter 不自动获得客户端直传能力。

## 4. 调用接口

服务端内部使用异步 `storage.upload(key, data, options?) → Promise<string>`。

SDK 使用 `sdk.storage.upload(key, data, options?) → Promise<string>`。options 本期包含可选 medium 和 contentType；contentType 是内容声明，不代表服务端验证过文件格式。File/Blob 可提供 type，其他情况默认 application/octet-stream。

SDK 初始化接受 API baseUrl 和异步 getAccessToken 回调，允许调用方提供最新的现有 Bearer token。SDK 不自行登录、不持久化 token，也不依赖 React 或页面状态。

本期不提供文件路径、URL 下载转存或任意流输入，不接受 JSON/string 作为隐式文件内容。零字节文件允许上传，所有输入按实际字节数计算大小。内部调用支持相同的二进制输入类型。

HTTP 上传与完成确认返回 JSON `{ url: string }`；SDK 解包为字符串。准备接口返回执行流程所需的内部数据，不改变公开 upload 方法的返回值。

## 5. key 与覆盖语义

key 是相对存储路径，例如 `avatars/user-123.webp`，不是操作系统绝对路径或 URL。COS 对象 key 与经过校验的输入 key 相同；本地对象保存在 `apps/server/data/uploads/<key>`。

为保证 Windows 与其他系统间含义一致，首版采用可移植 key 规则：

- 总长度不超过 240 个 ASCII 字符，使用 `/` 分隔路径段。
- 每段由小写字母、数字、点、下划线、连字符组成；首字符为字母或数字，末尾不得为点。
- 拒绝空段、`.`、`..`、反斜杠、盘符、前导或结尾斜杠、控制字符、百分号编码路径与 Windows 保留设备名。
- 不自动小写、不自动清洗非法 key；非法输入明确失败。调用方可使用小写 UUID 等方式生成兼容 key。
- HTTP 解码只由框架执行一次；模块不对 key 二次 URL 解码。
- FileAdapter 还需核对解析后的路径位于 uploads 根目录内，拒绝经过符号链接或 junction 的路径，避免越界。
- 若目录与文件发生前缀冲突，例如已有文件 `a` 后上传 `a/b`，本地明确返回冲突，不删除已有文件或目录。

这组精确字符规则是本文提出的首版落地选择，属于最终文档审阅内容。

不维护对象所有者或用户私有命名空间。持有有效 Bearer 的调用方可以覆盖相同 key；上传凭据绑定用户只用于校验本次直传上下文，不代表对象归属权限。

同 key 并发不保证调用顺序，最终对象以实际存储完成的覆盖结果为准。URL 标识可变 key，不承诺绑定某次上传的字节快照。此前生成的有效 URL 会访问该 key 当前内容，浏览器或 CDN 缓存可能暂时显示旧内容。

## 6. HTTP Contract 与数据流

以下为待写入 `api/openapi.yaml` 的设计接口，当前并不存在。路径不包含 Glue 自动添加的 `/api`。

| 方法与路径                     | operationId           | 认证   | 内容                                                                          |
| ------------------------------ | --------------------- | ------ | ----------------------------------------------------------------------------- |
| POST /storage/uploads/prepare  | prepareStorageUpload  | Bearer | 解析 medium、校验 key 和申报大小，返回 file 上传计划或 COS 临时凭证与上传凭据 |
| POST /storage/uploads          | uploadStorageContent  | Bearer | multipart 接收 key、data、可选 medium/contentType，服务端上传并返回 URL       |
| POST /storage/uploads/complete | completeStorageUpload | Bearer | 接收 COS key 与上传凭据，核实对象并返回 URL                                   |
| GET /storage/files             | getStoredFile         | 公开   | query 参数 key，读取本地 uploads 内的对象                                     |

上传准备同时承担“获取 COS 临时密钥”的 API 职责，不再增加第二个语义重复的凭证接口或配置查询接口。

### 6.1 SDK 上传准备

SDK 先获取内容大小，携带 key、size、contentType、可选 medium 调用 prepare。服务端以本次请求的配置选择 Adapter。

file 分支返回 medium 与 maxBytes；cos 分支额外返回 bucket、region、key、临时 SecretId/SecretKey/SecurityToken、凭证起止时间及签名上传凭据。响应采用以 medium 区分的封闭 schema。

SDK 将解析后的 medium 固定用于本次后续请求，避免默认配置改变后切换存储介质。客户端不能通过准备响应选择任意本站请求目标；本站请求仍由 api-client 使用配置的 baseUrl。

### 6.2 本地上传与服务端代传

SDK 的 file 分支调用 multipart 上传接口；直接调用 HTTP API 的其他消费者也可以指定 cos，由服务器代传 COS。

multipart 恰好包含一个 data 文件 part 和限定的文本字段；不依赖字段到达顺序。文件字节大小上限独立于有限的 multipart 元数据开销，缺失或伪造 Content-Length 不能绕过实际字节计数。

认证须在消费大文件内容前完成；沿现有 Glue 注册机制在该 operation 的 transport 生命周期接入，并复用认证能力。不能在挂载前无条件缓冲完整 multipart，再进行登录校验。

FileAdapter 在同一文件系统的私有临时区写完内容后替换目标；临时文件不放在公开读取根目录，避免不完整内容被读取。写入失败清理本次临时文件，保留已有完整目标，不先删除旧文件。Windows 实际替换行为需专项测试；替换失败返回错误。

### 6.3 COS 直传

prepare 生成短期 STS 凭证，仅授权配置 bucket 内本次 key 的 PutObject 写入操作，不授权列举、下载、删除、ACL 修改或分块上传。STS 与上传凭据有效期固定为 30 分钟，签发时间以服务器为准；单次对象上传不代表凭证只能使用一次。

SDK 在浏览器和 Node.js 中分别使用对应的 COS SDK，以 PutObject 方式一次上传；不得调用会自动切入分块上传的高级接口。

上传凭据由服务器用独立 HMAC 密钥签名，绑定版本、用户 ID、bucket、region、key、申报大小、内容类型和过期时间。凭据不落库，不包含长期云密钥；客户端不可修改其绑定字段。

完成确认再次验证现有 Bearer、凭据签名、用户及 key 一致性、过期时间和当前 COS 配置。服务器通过 HEAD 检查对象存在，实际大小与申报大小相同且未超过当前限制，再签发 URL。

HEAD 检查不证明字节摘要或上传者身份，也不消除同 key 并发覆盖；这是已选可覆盖、无数据库设计的边界。SDK 不以客户端“上传成功”声明代替服务器确认。

无数据库意味着凭据在有效期内可重放，临时写权限在凭证到期前也仍可使用。完成确认可重复获得 URL，不承诺一次性消费或上传后锁定对象。

### 6.4 URL 与读取

本地 URL 由配置的公开 API base URL、`/storage/files` 和编码后的 key query 生成，不信任请求 Host 推导外部地址。该 GET 同样在 Contract 登记，不通过静态文件插件暴露整个 data 目录。

本地读取不依赖额外元数据文件：返回 application/octet-stream、Content-Disposition: attachment 和 X-Content-Type-Options: nosniff；本期不保证浏览器内联预览。COS 写入也使用 attachment disposition 与声明的 contentType，避免把通用上传默认当作可执行网页。头像显示迁移需后续独立设计。

本地响应使用 Cache-Control: no-store；COS 上传同样设置 no-store，但外部缓存行为不作强一致保证。

COS 使用服务器持有的最小权限长期子账号密钥生成 31,536,000 秒下载签名。客户端 STS 凭证仅用于上传，不用于签发一年 URL。对象删除、密钥失效或云端权限变更仍可使 URL 提前失效。

本期不提供独立的 URL 续签、删除、列举、自动清理或文件管理 API。保存 COS URL 的业务需接受一年后链接过期；后续如需长期引用，应独立设计续签能力。

## 7. 环境变量

| 变量                        | 默认或要求                                        | 用途                                                       |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| STORAGE_DEFAULT_ADAPTER     | file                                              | 缺省调用使用 file 或 cos                                   |
| STORAGE_MAX_BYTES           | 20971520                                          | 正整数，三条上传路径共用的单文件上限                       |
| STORAGE_PUBLIC_API_BASE_URL | http://127.0.0.1:8080/api                         | 生成本地公开 URL；仅接受无凭据、query、hash 的 HTTP(S) URL |
| STORAGE_UPLOAD_HMAC_KEY     | 启用 COS 时必填，独立随机 32 字节密钥的十六进制值 | 无状态上传凭据签名                                         |
| TENCENT_COS_SECRET_ID       | 启用 COS 时必填                                   | 服务端长期子账号密钥 ID                                    |
| TENCENT_COS_SECRET_KEY      | 启用 COS 时必填                                   | 服务端长期子账号密钥                                       |
| TENCENT_COS_REGION          | 启用 COS 时必填                                   | 唯一配置区域                                               |
| TENCENT_COS_BUCKET          | 启用 COS 时必填                                   | 唯一配置 bucket，包含 APPID 后缀                           |

配置在启动时解析为不可变对象。完全没有 COS 配置时仅 file 可用；部分填写 COS 配置、未知默认 Adapter、非法大小或选择 cos 但未完整配置时启动失败。默认 file 且未配置 COS 时，单次请求显式选择 cos 返回 Adapter 不可用，不自动回退。

本地固定根目录为 `apps/server/data/uploads/`，临时目录为 `apps/server/data/upload-tmp/`，均不纳入版本控制。不会复用头像目录，也不会修改数据库 reset 的目录清理职责。

COS 浏览器直传需要 bucket 允许预期 Web origin 的 PUT 和必要签名请求头。CORS 是联调所需的外部配置，本实现不自动修改云端 bucket 策略。此功能仍遵循仓库当前不部署公网的边界。

## 8. 错误、重试与残留

| 情况                                      | HTTP 结果                 |
| ----------------------------------------- | ------------------------- |
| 非法 key、字段、medium 或上传凭据         | 400，固定安全错误码与文案 |
| Bearer 缺失、无效或过期                   | 401，沿用现有认证错误     |
| 上传凭据不属于当前用户                    | 403                       |
| 本地对象或待确认 COS 对象不存在           | 404                       |
| 本地文件/目录前缀冲突，完成确认大小不匹配 | 409                       |
| 实际内容超过上限                          | 413                       |
| 不支持的 HTTP 请求 Content-Type           | 415                       |
| 云端上传、STS 或 HEAD 依赖失败            | 502                       |
| 请求的 Adapter 未启用                     | 503                       |
| 本地 I/O 或未知内部异常                   | 500                       |

错误统一经 `apps/server/src/errors.ts` 的 envelope 输出。SDK 保留安全 code、status 和 requestId；COS SDK 原始异常不直接作为对用户的展示文案。

不记录或回显长期密钥、Bearer、临时密钥、上传凭据、完整签名 URL 或云 SDK 原始异常。准备和完成响应不缓存。

SDK 不自动重传文件，不无限重试。直传成功但确认失败时 upload 方法失败，调用方可重新调用 upload；这可能再次覆盖同一 key。有效凭据下的完成确认自身允许重复。

COS 直传上限由 SDK 预检、准备时申报校验、完成时实际大小复核共同实施；本期不声称 STS 的 PutObject 权限能在 COS 接收字节前强制执行大小上限。绕过 SDK 的客户端可能写入超限对象，完成确认拒绝返回 URL。

COS 写入后确认失败不删除对象，避免删除同 key 的其他并发上传结果；可能留下对象或已覆盖内容。无数据库设计不提供事务回滚、孤立对象跟踪或自动清理。

## 9. SDK 构建与扩展

SDK 包暂用 `@workspace/sdk`，通过 sdk.storage 组织功能，不建立空的其他业务模块。首版支持仓库当前 Node.js 基线（>=22.12.0）以及具备 Blob、File、FormData 的现代浏览器。

提供浏览器与 Node.js 对应入口或条件导出，共享协调逻辑，隔离 COS 环境实现。浏览器 bundle 不包含 node:fs、服务端 COS SDK、长期密钥配置或任何服务端模块。

SDK 的所有本站 HTTP 类型来自 `@workspace/api-client`。面向其他应用提供可构建的 JS 与类型产物，并验证打包后在仓库外消费；不以仅引用 workspace TypeScript 源文件作为交付完成。api-client 也需要有与外部消费兼容的产物或被正确打包进入 SDK，RFC 中确定具体构建接线。

本期不发布 npm、不新增框架依赖，也不改动现有页面的上传逻辑。

## 10. 验收标准

| 层级           | 必须验证                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| 模块           | 默认与显式 medium、无数据库依赖、内部调用免认证、二进制输入一致性、大小边界、非法 key 拦截                          |
| FileAdapter    | 新建、嵌套路径、同 key 覆盖、写入失败保留旧内容、公开读取、临时文件不可读、Windows 路径及符号链接边界               |
| HTTP Contract  | 四个 operation 注册与 Contract 双向一致，JSON handler 原始返回值和 HTTP 响应均校验，二进制 GET 验证响应头与真实字节 |
| 上传 transport | Bearer 拦截早于内容消费、multipart 单文件约束、实际字节计数、20 MiB 边界、断开清理、既有申请上传无回归              |
| COS 模拟       | STS 权限精确 key，凭据篡改/过期/串用户失败，HEAD 不存在/大小不符/超限失败，签名一年，云错误安全转换                 |
| SDK            | 浏览器与 Node.js 的 file/cos 分支、返回字符串、动态 token、medium 固定、错误传播、没有自动分块或重复上传            |
| 产物           | Node.js 外部应用消费构建产物；浏览器构建无 Node.js 模块和服务端密钥；类型可用                                       |
| 真实 COS       | 浏览器 CORS 与 STS 直传、Node.js 直传、服务器代传、完成确认、覆盖后下载内容、一年签名参数及当前可访问性             |

实现阶段按 Contract-first 顺序执行 `pnpm api:lint`、`pnpm api:generate`，再执行 `pnpm typecheck`、`pnpm test`、`pnpm build`，补充 SDK 构建及消费验收。数据库回归测试仍使用现有隔离容器，不连接本机数据库。

真实 COS 验证需要可用的受限子账号、bucket 与浏览器 CORS 配置。缺少这些条件时标记 NOT_EXECUTED，模拟测试不能代替真实验收。一年期限通过签名参数和当前访问验证，不声称实际等待一年验证过。

## 11. 非目标与后续工作

- 头像和申请附件接入、旧数据迁移、图片转换。
- 分块、断点续传、任意流输入、大文件调度。
- 对象读取权限、用户对象归属、版本控制、一次性上传凭据。
- 文件管理界面、删除/清理任务、URL 续签 API。
- 多 bucket 路由、CDN 鉴权、自定义 COS 域名、其他平台 Adapter 的实际实现。
- 数据库表或 migration、现有目录重构、公网部署、npm 发布。

## 12. 自审与交接

已按确认顺序核对：只返回 URL、不落库；同 key 覆盖；env 默认 Adapter；HTTP Bearer 与内部免认证；SDK COS 直传；20 MiB；无分块；浏览器与 Node.js；不迁移现有业务。

本文明确记录的落地选择包括 key 字符规则、四个 HTTP operation、零字节支持、公开读取的下载行为、30 分钟凭据、环境变量和错误分类，待用户统一审阅。全文不代表代码已经实现或测试已经通过。

最终批准后，调用 technical-design-doc-creator，以本文为来源，在 `.notes/archive/content-storage/rfcs/` 编写一个实现就绪 RFC，保留本文。RFC 需细化 Adapter 签名、multipart 与 Glue 生命周期、SDK 构建接线和测试落点。此轮设计不创建提交，不开始实现；设计结论是否提炼进 `.ai/` 另行征得用户同意。

## 外部依据

- [腾讯云：使用预签名 URL 访问 COS](https://cloud.tencent.com/document/product/436/68284)：长期密钥可指定签名时长；临时密钥签名受凭证自身有效期限制，因此一年下载签名与客户端临时上传凭证分开。
