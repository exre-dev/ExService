# Docs Server v1.2：Contract 附录

日期：2026-10-16。状态：**DESIGN_REVIEW_REQUIRED**。与 `.notes/docs-service/specs/2026-10-16-docs-server-v1.2-design.md` 及内容附录组成同一候选；本文件是待实现的 Contract 设计，不是已经登记的 API。

## 1. 通用规则

表中的路径均为 Contract 内路径，实际加现有 `/api` 前缀。全部 operation 使用 tag `docs`；公开操作显式 `security: []`，登录操作显式 `bearerAuth: []`。不引用 admin、作者或空间成员权限。全部成功与失败响应 `Cache-Control: no-store`，使用既有 `X-Request-Id`、`ErrorEnvelope`。Docs 对外不支持 HEAD，同路径 HEAD 统一 404；Fastify 仍可能自动注册 HEAD 路由，不能把协议限制描述为阻止了隐式注册。不增加 HEAD operation 或其他 Contract 外业务别名。

本清单实际有 **12 个 GET operation**（核心 6、B 类 6）。Docs `onRoute` 仅对这些 operationId 对应的 `method === 'HEAD'` 分支追加提前返回既有统一 404 的 `onRequest`，随后结束本次 Docs hook 安装；普通 GET 的认证及预检只安装到 GET 分支。注册顺序、继承 hook 与全部路径的验收见第 5 节。保留全局 `exposeHeadRoutes`、30 个正式 operation 和函数式 `serviceHandlers` 约定。operation 覆盖检查不能代替对自动 HEAD 的行为验证。

所有 JSON 对象封闭，`additionalProperties: false`；所有非空和可空字段显式定义，不通过 `allOf` 扩展封闭对象。下文 `?` 仅表示可省略，`|null` 表示必须出现但可为 null；其他字段均必填。每种具体 schema 在 `api/schemas/docs.yaml` 展开为正式命名 schema，供入口引用。仍使用 Draft-07 兼容的 `type/const/enum/oneOf/$ref/items/required`，不引入 `unevaluatedProperties` 或动态引用。

| 名称                     | 定义                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `Id`                     | UUID 字符串；请求统一为小写规范形式，非 UUID 为 400。稳定 ID，不使用标题 slug。                        |
| `Version`                | 整数 `1..9007199254740991`。不接受字符串或小数。                                                       |
| `Timestamp`              | 复用现有 `SafeTimestamp`，Unix 毫秒安全整数。                                                          |
| `Title`                  | 字符串，去除首尾空白后 1–200 字符；拒绝全空白。                                                        |
| `SpaceName/TemplateName` | 字符串，去除首尾空白后 1–100 字符。                                                                    |
| `Description`            | 字符串，0–2,000 字符，保留正文空白。                                                                   |
| `Cursor`                 | 不透明字符串，1–1,024 字符；不能当作权限证明。                                                         |
| `PageQuery`              | `limit?` 默认 100、范围 1–200；`cursor?`。仅 query 使用既有 Contract 类型归一化；重复 query 键被拒绝。 |
| `Content`                | 内容附录定义的 `DocsTiptapDocument`，完整预设；`contentSchemaVersion` 仅为整数常量 1。                 |

字符串拒绝 NUL 和未配对 UTF-16 surrogate，不作静默替换。标题等少量元数据可规范化 trim；正文不 trim。额外字段和错误类型返回 400。请求字段不允许写入 `id/version/position/deletedAt/createdBy` 等 Server 字段。

## 2. 返回 schema

| Schema                      | 字段                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocsSpace`                 | `id, name, description, version, treeVersion, createdAt, updatedAt`。                                                                                                                                                                                         |
| `DocsSpacePage`             | `items: DocsSpace[0..200], nextCursor: Cursor\|null`；按 `(createdAt,id)` 升序。                                                                                                                                                                              |
| `DocsTreeNode`              | `id, spaceId, parentId: Id\|null, title, position: integer>=0, version, hasChildren: boolean`。树 operation 只返回活动节点；相同字段形状可用于专门回收详情。                                                                                                  |
| `DocsTreePage`              | `items: DocsTreeNode[0..200], treeVersion, nextCursor: Cursor\|null`。                                                                                                                                                                                        |
| `DocsDocument`              | `DocsTreeNode` 的全部显式属性，另有 `contentSchemaVersion: 1, content: Content, createdAt, updatedAt`。不含文本投影、账号资料或删除字段。                                                                                                                     |
| `DocsDocumentResult`        | `document: DocsDocument, treeVersion`。                                                                                                                                                                                                                       |
| `DocsSpaceVersion`          | `spaceId, treeVersion`。                                                                                                                                                                                                                                      |
| `DocsMoveResult`            | `documentId, version, source: DocsSpaceVersion, target: DocsSpaceVersion, affectedCount: integer[1..20000]`。同空间时 source/target 相同；计数为本次文档字段实际更新的去重行数，成功 no-op 至少更新根。跨空间包含两侧同级重排，可能超过单空间 10,000 篇预算。 |
| `DocsTrashResult`           | `documentId, version, spaceId, treeVersion, deletionBatchId, trashedCount: integer[1..10000]`；计数仅本次新回收成员，不包含旧批次。                                                                                                                           |
| `DocsTrashGroup`            | `documentId, spaceId, parentId: Id\|null, title, version, deletionBatchId, deletedAt, documentCount: integer[1..10000]`；只有当前批次根，计数仅同批。                                                                                                         |
| `DocsTrashPage`             | `items: DocsTrashGroup[0..200], treeVersion, nextCursor: Cursor\|null`；按 `(deletedAt,id)` 降序，游标绑定树版本。                                                                                                                                            |
| `DocsTrashedDocumentResult` | `document: DocsDocument, treeVersion, deletion: {batchId, rootId, deletedAt}`。此处 `document` 复用正文/身份字段，`hasChildren` 仍只计活动直接子节点；删除归属单独在 deletion 中，不能经公开 operation 返回。                                                 |
| `DocsRestoreResult`         | `documentId, version, spaceId, treeVersion, restoredCount: integer[1..10000], retainedTrashedCount: integer[0..10000], placement: original-parent\|space-root`。retained 只计恢复后仍位于该根物理子树中的其他回收批次成员，不计已经独立恢复并脱离的节点。     |

`DocsDocument` 的 `hasChildren` 对已回收行通常为 false；其存在不授予读取子树的能力。所有对象在 HTTP 和 handler 序列化前都要符合相同 schema，不通过 serializer 裁剪来获得“符合”。

## 3. 空间 operation

| operationId       | 方法与路径                           | 认证 | 请求                                     | 核心成功响应        |
| ----------------- | ------------------------------------ | ---- | ---------------------------------------- | ------------------- |
| `listDocsSpaces`  | `GET /docs/spaces`                   | 公开 | `PageQuery`                              | 200 `DocsSpacePage` |
| `createDocsSpace` | `POST /docs/spaces`                  | 登录 | `{name, description}`                    | 201 `DocsSpace`     |
| `getDocsSpace`    | `GET /docs/spaces/{spaceId}`         | 公开 | path `spaceId`                           | 200 `DocsSpace`     |
| `updateDocsSpace` | `PATCH /docs/spaces/{spaceId}`       | 登录 | `{expectedVersion, name, description}`   | 200 `DocsSpace`     |
| `deleteDocsSpace` | `POST /docs/spaces/{spaceId}/delete` | 登录 | `{expectedVersion, expectedTreeVersion}` | 204，无 body        |

空间更新明确同时提交名字和描述，避免可省略字段与清空语义混淆。删除要求真正空空间；回收文档和模板均算引用。采用 POST 命令让版本字段处于受验证的 JSON body，避免依赖 DELETE body 的工具兼容性。

`deleteDocsSpace` 的 description 明确：当前没有任何文档行及模板行才可删除，并不要求“从未写入”。活动根及其完整物理后代迁出会减少源空间数量；清空后可删除源空间。独立回收根不能直移，纯回收空间仍非空；恢复会重新公开内容，本期无无公开影响的回收清理 API。

## 4. 文档、树和回收 operation

| operationId              | 方法与路径                                        | 认证 | 请求                                                            | 核心成功响应                    |
| ------------------------ | ------------------------------------------------- | ---- | --------------------------------------------------------------- | ------------------------------- |
| `getDocsTree`            | `GET /docs/spaces/{spaceId}/tree`                 | 公开 | `PageQuery` 加 `parentId?: Id`；省略表示根层，不能传字符串 null | 200 `DocsTreePage`              |
| `createDocsDocument`     | `POST /docs/spaces/{spaceId}/documents`           | 登录 | `DocsCreateDocumentRequest`                                     | 201 `DocsDocumentResult`        |
| `getDocsDocument`        | `GET /docs/documents/{documentId}`                | 公开 | path `documentId`                                               | 200 `DocsDocumentResult`        |
| `updateDocsDocument`     | `PUT /docs/documents/{documentId}`                | 登录 | `DocsSaveDocumentRequest`                                       | 200 `DocsDocumentResult`        |
| `moveDocsDocument`       | `POST /docs/documents/{documentId}/move`          | 登录 | `DocsMoveDocumentRequest`                                       | 200 `DocsMoveResult`            |
| `trashDocsDocument`      | `POST /docs/documents/{documentId}/trash`         | 登录 | `DocsTrashDocumentRequest`                                      | 200 `DocsTrashResult`           |
| `listDocsTrash`          | `GET /docs/spaces/{spaceId}/trash`                | 登录 | `PageQuery`                                                     | 200 `DocsTrashPage`             |
| `getDocsTrashedDocument` | `GET /docs/trash/documents/{documentId}`          | 登录 | path `documentId`，必须当前已回收                               | 200 `DocsTrashedDocumentResult` |
| `restoreDocsDocument`    | `POST /docs/trash/documents/{documentId}/restore` | 登录 | `DocsRestoreDocumentRequest`；path 必须为当前批次根             | 200 `DocsRestoreResult`         |

核心共 **14 个 operation**。同级重排使用 `moveDocsDocument`，无需另建整棵树替换或 arbitrary position operation。文档树和回收站读取均在一次只读一致快照中形成结果与树版本。

### 写入请求

| Schema                       | 字段和语义                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DocsCreateDocumentRequest`  | `{expectedTreeVersion, parentId: Id\|null, beforeDocumentId: Id\|null, title: Title, contentSchemaVersion: 1, content: Content}`。父、锚点属于 path 空间且活动。正文必填，空正文用空 doc 或 paragraph 表达。 |
| `DocsSaveDocumentRequest`    | `{expectedSpaceId, expectedVersion, title: Title, contentSchemaVersion: 1, content: Content}`。完整替换标题/正文；不允许改父、空间或顺序。                                                                   |
| `DocsMoveDocumentRequest`    | `{sourceSpaceId, targetSpaceId, expectedVersion, expectedSourceTreeVersion, expectedTargetTreeVersion, parentId: Id\|null, beforeDocumentId: Id\|null}`。两个空间可相同；父/锚点属于目标空间。               |
| `DocsTrashDocumentRequest`   | `{expectedSpaceId, expectedVersion, expectedTreeVersion}`。只接受活动根。                                                                                                                                    |
| `DocsRestoreDocumentRequest` | `{expectedSpaceId, expectedVersion, expectedTreeVersion, deletionBatchId}`。恢复当前整批；无 targetSpaceId、parentId、children 或 includePrevious 字段。                                                     |

返回的正文为规范化后的完整快照，调用方必须使用它及新版本更新本地状态。空 doc 规范化、默认属性等具体规则见内容附录；未知内容不裁剪后成功。

管理写入的状态规则：保存、移动、回收遇到已回收根时返回 409 `DOCS_ALREADY_TRASHED`；恢复遇到已恢复的活动根时返回 409 `DOCS_VERSION_CONFLICT`。目标空间不存在为 404；创建/移动指定的父或锚点不存在、不活动、错空间、错同级或位于移动子树内时返回 409 `DOCS_INVALID_MOVE`。这些管理失败不改变公开详情对回收 ID 的 404 行为。

配额为每空间当前 10,000 篇物理行，包含回收。满额时创建/跨空间移入返回 413；读取、合法编辑、回收、恢复、同空间重排/换父及满足目标约束的移出仍可执行。迁出后按完整物理子树行数释放源配额；空间删除仍只在真正空时成功。不新增 purge、配额绕过或手工 SQL 清理路径。

### 分页失败

结构合法但游标空间/父层与查询不符为 400 `BAD_REQUEST`；游标所绑定的树版本与当前不同为 409 `DOCS_TREE_CHANGED`。父节点在当前空间不存在或已回收为 404；父 ID 实际属于其他空间也合并为 404。一个空但存在的层返回 200 空 items，不用空结果掩盖父不可用。

## 5. HTTP 接入与预算登记

所有 30 个 operation 都有 `x-fastify-config.docs`，采用以下四种**封闭形状**；只允许列出的键。它是注册配置，不是用户请求字段，不扩充全局 Schema compiler。

| kind              | 精确形状                              | 对应 operation                                                                           |
| ----------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `read`            | `{kind: read}`                        | 全部 12 个 GET，无 wireBytes。                                                           |
| `content`         | `{kind: content, wireBytes: 9437184}` | `createDocsDocument`、`updateDocsDocument`、`createDocsTemplate`、`updateDocsTemplate`。 |
| `command`         | `{kind: command, wireBytes: 65536}`   | 其余 13 个 JSON POST/PATCH/PUT 命令，包含 AI、模板应用、评论。                           |
| `reserved-upload` | `{kind: reserved-upload}`             | 仅 `uploadDocsAttachment`，无 wireBytes；当前不消费 multipart。                          |

数值均为正安全整数；kind 缺失/未知、额外键、错误值、正式 operation 的 method/body media 与类别不匹配都在注册时固定错误拒绝 boot。自动 HEAD 依下文先分流，只复核对应 GET 的只读配置，不把它作为第 31 个 operation 或正式 read 方法错配。按本模块显式 operationId 清单分类，不复制 endpoint 表；其他模块无 docs 配置不受影响。还要验证本模块每个正式 operation 恰有一个匹配类别，不能把无配置的 Docs 路由静默降为全局默认。

`x-fastify-config` 只会成为 Fastify 自定义 config；hook 必须将 content/command 的 `wireBytes` 显式赋给 **`route.bodyLimit`**，不能误以为 config 自动改变默认 JSON parser。该行为有[Fastify 5.12.5 路由文档](https://github.com/fastify/fastify/blob/v5.12.5/docs/Reference/Routes.md)和本地锁定 `fastify-openapi-glue@4.11.4` 的 `apps/server/node_modules/fastify-openapi-glue/index.js` 组装依据。读取与预留上传没有 bodyLimit 覆盖；GET 与自动 HEAD 分支分别接线，不通过修改 `exposeHeadRoute` 关闭路由生成。

| operation 类别                         | wire/请求限制                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| 核心创建/保存正文、B 创建/更新模板     | JSON bodyLimit `9,437,184`（9 MiB）；内容 profile 另限 8 MiB。                     |
| 其他 JSON 命令，包括 AI 指令和模板应用 | JSON bodyLimit `65,536`（64 KiB）；AI 不接受调用方提交整篇待保存正文。             |
| 读取                                   | 不接受请求 body，封闭 query，沿用明确的 query 字段/分页限制。                      |
| B 上传附件                             | 认证后在 onRequest 明确 501，不消费上传内容；未来 multipart 上限不在本期冒称有效。 |

只接受 `Content-Encoding` 缺省或 identity，其他编码在正式 JSON operation 的 onRequest 抛固定 415 DocsError。所有受保护的**正式 Docs operation**在各自分支的 onRequest 前置认证并设置 no-store；preValidation 在默认递归 AJV 前作已解析内容的有界预检，handler 前 Glue 仍复核 Bearer。HEAD 按下述独立分支提前终结。保留既有 hook，不能覆盖 Glue 的 `preHandler`。全局普通 API 的 4 MiB 不扩大。

### HEAD 分支、继承 hook 与安装顺序

本策略针对锁定的 Fastify **5.12.5**、Glue **4.11.4**。本地 `apps/server/node_modules/fastify/lib/route.js:223/245/295/453` 依次是 HEAD 开关求值、原始选项浅拷贝、onRoute 回调和自动注册；`onRoute` 修改 GET 的 `exposeHeadRoute` 已晚于开关求值，v1.1 的机制撤回。自动 HEAD 再次进入 onRoute，并保留 GET 的 schema.operationId、config 与 Glue preHandler；因此能按 operationId 与实际 method 分流。上游依据固定为 [Fastify v5.12.5 路由源码](https://github.com/fastify/fastify/blob/v5.12.5/lib/route.js)，精确本地位置以本段及主设计第 14 节记录为准。

1. HTTP foundation 先在应用作用域安装 `registerHttpFoundation` 与 `registerErrorHandlers`。前者的 inherited onRequest 设置请求 ID/CORS；HEAD 不属于其 OPTIONS 提前终结条件。API 作用域再安装现有请求归一化、各模块 API 插件及 Docs 的按 operation 筛选 onRoute，最后注册一次 Glue。Docs transport 在 foundation 已就绪后捕获统一错误出口（见下节）。
2. Docs onRoute 先读取 schema.operationId；不在本模块清单则立即返回。对下表 12 个 GET 标识，校验其只读 docs config 后，**先判断实际 method 是否 HEAD**。HEAD 分支只组合追加一个 onRequest，并立即结束 Docs 安装；不安装普通 GET 的认证、编码检查、内容/参数预检、计时或业务 hook。GET 分支继续原有正式 operation 接线；其他命令沿用 content/command/reserved-upload 接线。自动 HEAD 不计入 30 个正式 operation 或 12/4/13/1 的配置计数。
3. HEAD 拦截器是返回 `reply.callNotFound()` 的 async onRequest。它复用 `apps/server/src/errors.ts` 已安装的 setNotFoundHandler，生成固定 `NOT_FOUND` / `NOT_FOUND_MESSAGE` 与当前 `request.id`，设置 `Cache-Control: no-store`，保留 foundation 的 `X-Request-Id`、CORS/Vary。它不抛 `DocsError`，不用 `DOCS_NOT_FOUND`，不进入 Docs/DB/存储服务；自动 HEAD 上仍存在的 Glue preHandler 不会执行。`return` 该 reply 让 Fastify 终结后续请求阶段，不继续调用 done 或 handler。
4. **追加不等于抢在 inherited hook 前面执行。** Fastify 在 preReady 以 inherited hooks 在前、route hooks 在后组合；当前 foundation onRequest 不认证、不访问 Docs/数据库，API 请求归一化位于 preValidation。Docs 的认证/预检必须保持上一步的分支内 route hook，禁止在 API/Docs 作用域新增无 method 区分的 inherited 认证 hook。已有安全 route onRequest 保序保留，再追加 HEAD 拦截；不得先给所有 Docs 分支追加 GET 认证再追加 404。将来若增加 earlier hook，它也必须在 HEAD 路径无认证/业务动作，并重新验证本矩阵。
5. hook 组合采用 **Docs 内部最小辅助函数**，放在 `apps/server/src/domains/docs/api/transport.ts` 内：未定义时形成单元素数组，函数时形成 `[existing, added]`，数组时形成 `[...existing, added]`。创建新数组，不 push 共享数组，不修改共享 schema/config；保留回调或 async 函数原约定。只覆盖本模块用到的 onRequest/preValidation 组合，不抽象通用框架，不 import `apps/server/src/http/shared/multipart-upload-lifecycle.ts` 的私有 appendHook，不修改共享模块。

HEAD 的线上响应**无 body**，不能在调用方要求解析 JSON；统一 envelope 是 404 出口构造的内部结果，按 HEAD 语义由响应层省略。验收在 HTTP 层断言状态/header/零 body，在出口观察点另外断言固定 code/message/requestId，且不发第二次响应。未知路径仍走既有 404；非 Docs 路由完全不被该白名单拦截。

下表是全部 12 条路径的正式验收矩阵。状态顺序均为**匿名 / 有效 Bearer / 无效 Bearer**；GET 输入为合法请求，B 类只验证预留 501，不表示业务已实现。所有 HEAD 都要证明认证调用、内容预检和业务 handler 次数为零，基础请求 ID/CORS hook 可以正常执行。

| operationId              | GET 路径                                   | 类别/认证 | HEAD 状态   | 同路径 GET 状态 |
| ------------------------ | ------------------------------------------ | --------- | ----------- | --------------- |
| `listDocsSpaces`         | `/docs/spaces`                             | 核心/公开 | 404/404/404 | 200/200/200     |
| `getDocsSpace`           | `/docs/spaces/{spaceId}`                   | 核心/公开 | 404/404/404 | 200/200/200     |
| `getDocsTree`            | `/docs/spaces/{spaceId}/tree`              | 核心/公开 | 404/404/404 | 200/200/200     |
| `getDocsDocument`        | `/docs/documents/{documentId}`             | 核心/公开 | 404/404/404 | 200/200/200     |
| `listDocsTrash`          | `/docs/spaces/{spaceId}/trash`             | 核心/登录 | 404/404/404 | 401/200/401     |
| `getDocsTrashedDocument` | `/docs/trash/documents/{documentId}`       | 核心/登录 | 404/404/404 | 401/200/401     |
| `searchDocsDocuments`    | `/docs/search`                             | B/公开    | 404/404/404 | 501/501/501     |
| `listDocsTemplates`      | `/docs/spaces/{spaceId}/templates`         | B/登录    | 404/404/404 | 401/501/401     |
| `getDocsTemplate`        | `/docs/templates/{templateId}`             | B/登录    | 404/404/404 | 401/501/401     |
| `listDocsAttachments`    | `/docs/documents/{documentId}/attachments` | B/公开    | 404/404/404 | 501/501/501     |
| `getDocsAttachment`      | `/docs/attachments/{attachmentId}`         | B/公开    | 404/404/404 | 501/501/501     |
| `listDocsComments`       | `/docs/documents/{documentId}/comments`    | B/公开    | 404/404/404 | 501/501/501     |

还需用坏 UUID/额外 query/非 identity 编码的代表 HEAD 验证短路不受 GET 校验影响；逐项回归同路径 GET 的认证、no-store、读取/501 语义；content/command 的 bodyLimit、编码拒绝及错误重映射沿用原门禁，不能因新增 HEAD 分支改变。非 Docs 代表覆盖公开 GET/HEAD 200、受保护 GET/HEAD 匿名和无效 Bearer 401、有效 Bearer 200。当前平台探针只提供组合可行性证据（主设计第 14 节），真实 Docs HTTP、原始 handler 和 DB/存储零调用断言仍为实施门禁。

### 解析期错误的实际观察位置

在安装 Docs transport 时，捕获 HTTP foundation 已安装的 `app.errorHandler` 为统一出口。此捕获**依赖 foundation 先注册**，由 API 插件的 `dependencies: ['http-foundation']` 和装配顺序保证，不在 foundation 之前捕获默认 handler。保留 v1.1 已独立核验的委托方案，不改为抛出重映射异常的另一套链路。Docs `onRoute` 为本模块正式 operation 分支设置 errorHandler 包装：仅把原生 `FST_ERR_CTP_BODY_TOO_LARGE` 映射为 413 `DOCS_LIMIT_EXCEEDED`，把原生 `FST_ERR_CTP_INVALID_MEDIA_TYPE` 映射为 415 `DOCS_UNSUPPORTED_MEDIA_TYPE`，再委托捕获的统一出口处理响应、日志及 header。HEAD 在更早分支通过既有 404 出口终结，不安装此包装。已经分类的 DocsError、AuthError 和其他业务错误原样交出，不按任意裸 statusCode 改码。其他未知解析失败也走原出口，不回显其 message。

Fastify 的 route context 在 parser 前已有路由 errorHandler，parser 以 `reply.send(error)` 进入该链。`preValidation` 无法观察先前解析错误；`onError` 仅可观察，不能依靠它替换异常。包装不调用当前 `request.server.errorHandler` 来递归进入自身、不注册第二份全局 handler、不调用两次 `resolveErrorResponse`，不重复日志或发送。该设计以当前本地 Fastify `lib/route.js` 的 context.errorHandler、`lib/content-type-parser.js` 的 parser 失败路径及 `lib/error-handler.js` 为源码依据，仍待真实 socket 反例验证。

现有 `scripts/runtime/nginx.mjs` 从统一生成 Contract 读取 join wire 与 storage overhead，再与运行时 storage 文件上限相加，取最大值作为代理上限；64 MiB 是当前默认夹具的派生结果，并非独立固定常量。实施把同一生成 Contract 中 docs kind 为 content/command 的 wireBytes 最大值纳入 `max(joinWire,storageWire,docsWire)`；read/reserved-upload 不参与，缺失/非法 Docs 配置拒绝渲染，不复制 9 MiB 到另一配置来源。覆盖分别由 join/storage/docs 占最大值及非法值的纯渲染回归，不增加第二个代理，不启动/重载本机服务。真实 chunked 超限与未声明 Content-Length 的行为仍须 socket 测试证明。

## 6. 错误与状态

所有核心 operation 显式登记适用的 400/401/404/409/413/415/503，另有既有 `default ErrorResponse`；没有 Bearer 的公开读取不要求 401。503 带 `Retry-After: 1`。统一 envelope 只有 `error: {code, message, requestId}`；不能附带冲突正文、SQL、堆栈或任意 details。

实现新增 `DocsErrorCode` 并以 type import 并入 `apps/server/src/errors.ts` 的 `ErrorCode` 联合。表中 14 个 `DOCS_*` 取值全部进入该联合，不能依赖目前不包含 Docs 的封闭类型。`DOCS_BUSY` 的 `retryAfterSeconds=1` 由错误对象提供，统一出口只据该字段生成 header。

| HTTP | code                           | 固定 publicMessage / 适用情况                                                                                                |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 400  | `BAD_REQUEST`                  | 既有 Contract 校验出口；额外字段、错误类型、坏游标、错误参数。                                                               |
| 400  | `DOCS_INVALID_CONTENT`         | `The document content is invalid.`；不合法语法、属性、表格或 Unicode。                                                       |
| 400  | `DOCS_UNSUPPORTED_CONTENT`     | `The document contains unsupported content.`；未知节点、Mark、正文属性或不支持的内容版本。                                   |
| 400  | `DOCS_UNSAFE_CONTENT`          | `The document contains an unsafe value.`；执行性协议、危险 URL、样式等。                                                     |
| 401  | 既有认证错误码                 | 复用既有固定认证文案，不另签发 Docs token。                                                                                  |
| 404  | `DOCS_NOT_FOUND`               | `The requested Docs resource was not found.`；公开回收内容与未知 ID 合并；回收详情读到活动文档也用此码。                     |
| 409  | `DOCS_VERSION_CONFLICT`        | `The Docs resource has changed. Read it again before retrying.`；文档/空间/批次或命令树版本不匹配，含 expectedSpaceId 变化。 |
| 409  | `DOCS_TREE_CHANGED`            | `The document tree has changed. Restart pagination.`；仅分页游标代际过期。                                                   |
| 409  | `DOCS_INVALID_MOVE`            | `The document cannot be moved to that location.`；自引用、后代目标、非目标同级锚点或锚点为自身。                             |
| 409  | `DOCS_SPACE_NOT_EMPTY`         | `The space still contains documents or templates.`                                                                           |
| 409  | `DOCS_ALREADY_TRASHED`         | `The document is already in trash.`                                                                                          |
| 409  | `DOCS_RESTORE_ROOT_REQUIRED`   | `Restore the root document of the deletion batch.`                                                                           |
| 413  | `DOCS_LIMIT_EXCEEDED`          | `The Docs request exceeds the supported limit.`；wire、内容、节点、网格、树深度或空间数量配额。                              |
| 415  | `DOCS_UNSUPPORTED_MEDIA_TYPE`  | `The Docs request media type is not supported.`                                                                              |
| 503  | `DOCS_BUSY`                    | `Docs is busy. Retry after reading the current state.`；锁/语句期限、DB 并发中止，事务回滚。                                 |
| 501  | `DOCS_FEATURE_NOT_IMPLEMENTED` | `This Docs feature is not implemented.`；仅 B 类预留。                                                                       |
| 500  | `INTERNAL_ERROR`               | 既有固定未知错误文案；损坏链、批次结构、未知数据库错误或内部故障。                                                           |

默认 AJV 可能先对 `contentSchemaVersion` 的 const 给出 400 `BAD_REQUEST`；它仍是明确拒绝。不得为了换错误码放宽 Contract。Docs 的内容预检先发现未知节点/属性时返回上表的 `DOCS_UNSUPPORTED_CONTENT`。同一命令在锁内的顺序为：存在/状态 → 位置与版本 → 目标有效性 → 配额 → 更新；验证冲突后不继续变更。

## 7. B 类 schema 与 operation 清单

下表的 2xx schema 是**正式预留成功形状**，在 Contract description 标明本期不会返回。它们与 501 一同登记，便于生成 Client 和未来接入；实现与验收仍以全部合法请求 501 为准。不得使用 deprecated、mock、空成功结果或缺失 handler 表示未实现。

### 搜索与 AI

| operationId                  | 方法与路径                                         | 认证 | 请求                                                                                      | 预留成功形状           |
| ---------------------------- | -------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- | ---------------------- |
| `searchDocsDocuments`        | `GET /docs/search`                                 | 公开 | query `{q: string[1..200], spaceId?: Id, limit?: integer[1..50] 默认20, cursor?: Cursor}` | 200 `DocsSearchPage`   |
| `suggestDocsDocumentContent` | `POST /docs/documents/{documentId}/ai-suggestions` | 登录 | `{expectedSpaceId, baseVersion: Version, instruction: string[1..2000]}`                   | 200 `DocsAiSuggestion` |

`DocsSearchHit={documentId,spaceId,title:Title,excerpt:string[0..500]}`，`DocsSearchPage={items:DocsSearchHit[0..50],nextCursor:Cursor|null}`。未来只索引/查询活动文档，不把回收内容放入 excerpt。排序及中文检索质量是后续实现的验收内容，当前游标没有可用结果。

`DocsAiSuggestion={documentId,baseVersion,contentSchemaVersion:1,proposedTitle:Title,proposedContent:Content}`。AI 读取当前文档并核对 baseVersion 后形成建议；不自动保存。未来将建议交给 `updateDocsDocument` 时，仍检查相同 baseVersion、内容 profile 和当前空间；过期建议不能覆盖新正文。本期不读取文档、调用模型或消耗凭据。

### 模板

| operationId          | 方法与路径                                         | 认证 | 请求                                                                                         | 预留成功形状             |
| -------------------- | -------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------- | ------------------------ |
| `listDocsTemplates`  | `GET /docs/spaces/{spaceId}/templates`             | 登录 | `PageQuery`                                                                                  | 200 `DocsTemplatePage`   |
| `createDocsTemplate` | `POST /docs/spaces/{spaceId}/templates`            | 登录 | `{name:TemplateName,contentSchemaVersion:1,content:Content}`                                 | 201 `DocsTemplate`       |
| `getDocsTemplate`    | `GET /docs/templates/{templateId}`                 | 登录 | path ID                                                                                      | 200 `DocsTemplate`       |
| `updateDocsTemplate` | `PUT /docs/templates/{templateId}`                 | 登录 | `{expectedSpaceId,expectedVersion,name:TemplateName,contentSchemaVersion:1,content:Content}` | 200 `DocsTemplate`       |
| `deleteDocsTemplate` | `POST /docs/templates/{templateId}/delete`         | 登录 | `{expectedSpaceId,expectedVersion}`                                                          | 204，无 body             |
| `applyDocsTemplate`  | `POST /docs/documents/{documentId}/apply-template` | 登录 | `{expectedSpaceId,expectedVersion,templateId,expectedTemplateVersion:Version}`               | 200 `DocsDocumentResult` |

`DocsTemplate={id,spaceId,name,contentSchemaVersion:1,content:Content,version,createdAt,updatedAt}`；列表使用不含 content 的 `DocsTemplateSummary`，其余字段相同；`DocsTemplatePage={items:DocsTemplateSummary[0..200],nextCursor:Cursor|null}`，按 `(createdAt,id)`。模板只属于一个空间；应用时文档与模板同空间，复制正文并保留文档标题。模板不建立应用记录；未来删除模板只删除模板行，不能连带删除已应用正文。

### 附件

| operationId            | 方法与路径                                      | 认证 | 请求                                                | 预留成功形状               |
| ---------------------- | ----------------------------------------------- | ---- | --------------------------------------------------- | -------------------------- |
| `listDocsAttachments`  | `GET /docs/documents/{documentId}/attachments`  | 公开 | `PageQuery`                                         | 200 `DocsAttachmentPage`   |
| `uploadDocsAttachment` | `POST /docs/documents/{documentId}/attachments` | 登录 | multipart `DocsAttachmentUploadRequest`             | 201 `DocsAttachment`       |
| `getDocsAttachment`    | `GET /docs/attachments/{attachmentId}`          | 公开 | path ID                                             | 200 `DocsAttachmentAccess` |
| `deleteDocsAttachment` | `POST /docs/attachments/{attachmentId}/delete`  | 登录 | `{expectedSpaceId,expectedDocumentVersion:Version}` | 204，无 body               |

`DocsAttachmentUploadRequest` 是封闭 multipart schema：恰好一个 `data` 二进制 part，必填文本字段 `fileName:string[1..255]`、`contentType:StorageContentType`、`expectedSpaceId:Id`、`expectedDocumentVersion:Version`；不允许 medium/key/url/ticket。multipart 文本版本在未来 transport 中只接受规范十进制整数后转为 Version，不允许通用 JSON coercion。filename 不决定存储路径，路径由 Server 生成。

`DocsAttachment={id,documentId,fileName,contentType,byteSize:integer[1..9007199254740991],sha256:string[64] 小写十六进制,createdAt}`；不外发 medium/key。`DocsAttachmentPage={items:DocsAttachment[0..200],nextCursor:Cursor|null}`，按 `(createdAt,id)`。`DocsAttachmentAccess={attachment:DocsAttachment,downloadUrl:string[1..2048]}`，URL 为绝对 HTTP(S)，有效期由介质决定，不承诺永久可用。

未来列表/访问先核对所属文档活动状态；附件删除是解除关联，不删除文档、不自动删除存储对象。本期没有任何上传或删除效果。Generic Storage 的 URL 不构成该请求或归属证明。

### 文档级评论

| operationId         | 方法与路径                                   | 认证 | 请求                                                      | 预留成功形状          |
| ------------------- | -------------------------------------------- | ---- | --------------------------------------------------------- | --------------------- |
| `listDocsComments`  | `GET /docs/documents/{documentId}/comments`  | 公开 | `PageQuery`                                               | 200 `DocsCommentPage` |
| `createDocsComment` | `POST /docs/documents/{documentId}/comments` | 登录 | `{expectedSpaceId,body:string[1..10000]}`                 | 201 `DocsComment`     |
| `updateDocsComment` | `PUT /docs/comments/{commentId}`             | 登录 | `{expectedSpaceId,expectedVersion,body:string[1..10000]}` | 200 `DocsComment`     |
| `deleteDocsComment` | `POST /docs/comments/{commentId}/delete`     | 登录 | `{expectedSpaceId,expectedVersion}`                       | 204，无 body          |

`DocsComment={id,documentId,body,version,createdAt,updatedAt}`；`DocsCommentPage={items:DocsComment[0..200],nextCursor:Cursor|null}`，按 `(createdAt,id)`。body 拒绝全空白，保留其他字面文本，不作为 HTML。没有 inline、selection、range、paragraphId、anchor、from/to、parentCommentId 字段；这些字段必须是反例。账号 UUID 只在数据库记录操作事实，本期不建立公开作者资料协议。

B 共 **16 个 operation**，加核心合计 **30 个 operation**。模板 6、附件 4、评论 4、搜索 1、AI 1；不因为拥有三张表而把搜索/AI 从正式清单删掉。

## 8. B 类实际运行行为

JSON 和 query operation：普通 transport/有界预检 → Contract 校验 → 必需 Bearer 校验 → 显式 handler 抛固定 `DocsError(DOCS_FEATURE_NOT_IMPLEMENTED)` → 既有统一错误出口。对受保护操作还在 onRequest 前置 Bearer，因此匿名请求优先得到 401；合法登录请求得到 501。公开 B 读取直接得到 501。无任何业务查询、DB 写入、存储或 AI 调用。

上传是明确的例外：本期不为了未实现功能建立 multipart 消费链。`uploadDocsAttachment` 的 onRequest 首先设置 `Connection: close` 与 `Cache-Control: no-store`，再进行 Bearer 校验，通过后抛相同 501，**不读取/验证 multipart payload**；认证通过的格式错误上传也可能得到 501。该限制写入 operation description。operation 仍有真实 handler，直接调用 handler 也抛同一错误，不能留下 Glue 缺失 handler 的默认 500。当前 HTTP/1 接入在固定错误响应刷出后结束连接，不能靠等待未消费的上传结束来复用 keep-alive；认证失败也按已设置的 header 提前终结。未来启用上传时再落地正文中的有限 multipart transport；本期测试证明 501 在读取请求体前发生并关闭/终结本请求，不等待用户传完大文件，不泄漏 slot 或悬挂连接。

其余 B operation 显式列 400、受保护的 401、适用的 413/415、501 和 `default ErrorResponse`；完整 JSON 正文仍受内容预算预检。语义合法且完成请求校验的请求不能返回 2xx；未实现响应无业务 DTO，只返回既有 ErrorEnvelope 和 `no-store`。501 可被启发式缓存，因此必须显式禁止存储，依据 [RFC 9110 §15.6.2](https://www.rfc-editor.org/rfc/rfc9110.html#name-501-not-implemented)。

日志取舍沿用既有统一出口：501 记录一次 error 级 `request failed`，只含固定 code/statusCode，不另记 warn、不改全站 5xx 分级，也不记录正文、AI 指令或凭据。它是本期预期保留行为；功能可用性仍必须按实际 501 报告。

验收逐一枚举全部 16 个保留 operation，不用一个通配路由替代。核对 HTTP 状态/header/envelope，原始 handler 的固定异常与安全出口，并证明没有 DB/存储/模型调用。未来将某 operation 改成可用时，单独改其实现说明、2xx 验证及功能验收，不能把本期保留验收沿用为功能通过。
