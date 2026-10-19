# 支持中心反馈表单与 ClickUp 提交 RFC

- 状态：本期普通文本实现已落地；产品设计已确认，Tiptap 接入延后；完整验收尚未完成。
- 日期：2026-10-14。
- 模块根目录：`.notes/support-center/`。
- Source of truth：`.notes/support-center/specs/2026-10-14-support-feedback-design.md`。
- 本 RFC 保留源设计及既有 `.notes/support-center/rfcs/support-center-rfc.md`，不替换历史文档。
- 2026-10-15 用户确认的规则补充：允许 ClickUp 将正文中的字面 HTTP／HTTPS URL 自动转换为可点击链接，严格条件见第 8 节；其他纯文本和格式核对要求继续适用。

## 1. 决策与当前依据

实现两个登录后可用的表单：功能和需求创建 Request，Bug 反馈创建 Bug，均进入 List `901810170816`。本期正文使用 ExUI 普通多行文本输入框占位，不引入 Tiptap。Website 先持久化表单、用户快照及附件，再由浏览器立即驱动逐步同步；每个推进请求至多执行一次外部写入，不新增后台投递队列。

### 1.1 开发优先级与分阶段边界

**先开发本 RFC 的反馈功能，不等待另一分支的 Tiptap 支持。** 当前分支不安装 `@tiptap/*`、不实现编辑器或富文本工具栏，不重复建设该分支的 Tiptap 支持。

| 阶段              | 范围与交付条件                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| 本期：优先开发    | 普通输入框、共同字段与 Bug 字段、校验、附件、持久记录、ClickUp 同步、核对／恢复；按本 RFC 的纯文本版本验收            |
| 后续：Tiptap 接入 | 另一分支支持完成并可复用后，单独更新 Spec／RFC，再替换 Request 输入控件、细化正文 Contract 与规则版本、补齐富文本验收 |

后续富文本方向继续采用 Tiptap，具体依赖版本与接入接口以支持分支成果为依据。富文本格式、工具栏、链接弹窗和编辑器桥接不属于本期范围或交付门槛。

方案设计时，`apps/web/src/pages/Support/SupportHome.tsx` 的三个反馈 Modal 正文为空，Website 尚无反馈 HTTP operation、反馈业务服务和持久表。现有共享 Client 支持 JSON、FormData、PUT、超时及 AbortSignal，可直接承载本方案，不添加第二套前端 HTTP 客户端。

已核对 Request=1005、Bug=1001、相关字段适用于两类任务。现有 StorageService 仅提供 upload 并生成公开 URL，缺少私有暂存所需的统一读取／删除接口，因此本期使用反馈域自己的 PostgreSQL bytea 暂存，复用加入申请的物理类型及通用 multipart 生命周期，不复用加入申请业务表。

本期不实现投诉和建议、反馈管理后台、历史列表、自动重投、双向同步或部署。没有在此次设计阶段创建真实 ClickUp 任务、上传附件、修改数据库或安装依赖。

## 2. 已批准的产品规则

| 项目                       | Request                                       | Bug                                                      |
| -------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| Title                      | 必填                                          | 必填                                                     |
| Category                   | 选填                                          | 不显示控件；服务端固定修复                               |
| Type、部门、额外大文件链接 | 选填                                          | 选填                                                     |
| 正文                       | 普通多行文本 Content，必填；后续再接入 Tiptap | 问题描述必填；复现步骤、预期结果、实际结果、发生频率选填 |
| 附件                       | 0–5 个，每个 1–20 MiB                         | 同左                                                     |
| 状态                       | 新增                                          | 新增                                                     |
| 用户字段                   | 服务端昵称＋本站 UUID                         | 同左                                                     |

频率值与文案固定映射为 `always=每次`、`often=经常`、`sometimes=偶尔`、`once=仅一次`。不选时为 null。Task 的 Request／Bug 类型与名为 Type 的自定义字段严格分开。

Title trim 后 1–200 个 Unicode 码点，禁止换行和控制字符。Request 的原始纯文本及安全转义后的用户 Markdown 均最多 65,536 UTF-8 字节，纯文本去除空白后必须非空；Markdown 标记按普通文字处理，不因它看起来像空格式而拒绝。Bug 每个文本项最多 16,384 UTF-8 字节，合成正文最多 65,536 字节。附提交编号后的最终正文最多 66,560 字节，超限拒绝、不截断。

额外大文件链接为 null 或一个 HTTPS URL，最多 2048 个字符，不含 URL 用户名／密码。附件总计最多 104,857,600 字节；原文件名 1–255 个 Unicode 码点，禁止控制字符，媒体类型最多 127 个 ASCII 字符。未提供或不合法的浏览器 MIME 使用 application/octet-stream。文件作为普通附件，不解压、不执行、不生成预览。

## 3. 单元与依赖边界

| 单元                                                 | 职责与公开接口                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/feedback-content/`，新增纯 TS workspace 包 | 纯文本分析与 Markdown 安全转义、Bug 编排、正文大小计算及远端正文核对；不定义 HTTP DTO、引入 React、Tiptap、访问网络或数据库 |
| `apps/web/src/pages/Support/feedback/`               | 模态表单、Zod／RHF、普通文本输入、附件选择、API 适配及进度恢复                                                              |
| `apps/server/src/modules/clickup/`                   | 普通 ClickUp 服务／传输适配器：getList、getFields、getTaskTypes、getTask、listTasks、createTask、uploadAttachment           |
| `apps/server/src/domains/support/`                   | 表单接收、归属与选项校验、持久化、认领、同步状态与维护核对                                                                  |
| `apps/server/src/domains/support/api/`               | operation 登记、HTTP handler、受控 multipart 传输 hook                                                                      |
| `api/paths/support.yaml`、`api/schemas/support.yaml` | 本 RFC 的唯一 Website HTTP Contract 定义                                                                                    |

纯内容包是本 RFC 对“前后端使用相同内容规则”的技术细化。包名使用 `@workspace/feedback-content`，导出纯文本规则版本、正文分析、安全转义及纯编排函数；前端 Zod refine 与服务端业务校验消费同一分析结果。HTTP 输入／响应类型仍只从生成的 `@workspace/api-client` 导入。

ClickUp 模块不依赖 support。`business-clickup` 暴露始终存在的 clickupServices（禁用时亦为显式 unavailable 服务）；`business-support` 依赖 `business-clickup`、`business-profile`，暴露 supportServices。各自只在自己的 fastify.d.ts 声明 decorator。API 插件 `api-support` 依赖 `business-support` 与 `api-auth`，显式检查 decorator。

`BusinessServices`、`CreateAppOptions`、`server.ts` 的装配与测试 fixtures 增加这两个具名依赖；业务入口由现有发现器加载，不增加中央业务插件清单。`http/plugin.ts` 显式安装 API 插件及按 operation 筛选的 hook；`http/service-handlers.ts` 合并 operations，继续只注册一次 Glue。

## 4. 普通文本输入与正文编排

### 4.1 本期普通输入框

Request 使用 ExUI 普通多行文本输入框，标签为「内容」，由所属 RHF 表单管理字符串值、onBlur、禁用、reset 和恢复。输入和粘贴均为纯文本，不提供富文本工具栏、链接弹窗或 Markdown 编辑／预览。Bug 保持多行文本字段和频率下拉。图片、视频和其他文件通过附件区提交。

客户端提交 `contentText`，不提交编辑器 JSON、HTML 或用户编写的 Markdown。内容包使用 CommonMark AST 解析与序列化能力（unified、remark-parse、mdast-util-to-markdown）完成安全输出及远端核对；它们服务于正文传输，不引入 Tiptap 或浏览器编辑器。

Request 将用户输入作为 AST text 编排，保留换行；Bug 同样不把用户输入重新解释为 Markdown，按固定小标题排列，空选填项略去。两者正确转义 Markdown 标记、列表起始符、代码围栏与 HTML 符号；看似标题、Markdown 链接语法或 HTML 的输入仍按文字处理，不执行 MDX／JSX、不加载 URL、不注入本站 DOM。允许 ClickUp 自动链接正文中的字面 HTTP／HTTPS URL，但不得改变 URL 文字或目标。纯空白输入无效。

服务端创建记录时生成用户 Markdown 和最终 Markdown，在末尾加入分隔线及「ExWebsite 提交编号：提交 UUID」。form_json 保存纯文本字段，读取时按原规则版本核验与恢复；重试不重新生成正文、不改变昵称快照。前端只调用共享规则检查非空与安全转义后的大小，实际 ClickUp 正文由服务端固化。

纯文本到 Markdown 的 fixtures 覆盖中文、CRLF、多行与空行、连续反斜杠、括号链接、代码围栏、HTML、只有 Markdown 标记及末尾换行；核对输出保持文字语义、未把用户文本变成格式。真实 ClickUp 的文字与换行显示仍需独立验收。

### 4.2 后续 Tiptap 接入（本期不实施）

Tiptap 支持在另一分支开发。待可复用后，再确定版本、公开接口、ExUI／Lucide 工具栏和 RHF 桥接，并补齐段落、一级至三级标题、粗体、斜体、列表、链接、引用、行内／块代码、换行和撤销／重做的格式规则。届时另行定义 Markdown 输入校验、HTTP／HTTPS 链接限制、粘贴归一化及编辑器 reset／恢复。

富文本接入前须更新本 RFC 与 Spec，评审 `contentText` 到富文本载荷的 Contract、form_version／content_rule_version 及旧提交恢复影响，再按 Contract-first 流程生成类型。已固化的纯文本提交继续使用原正文和原规则恢复／重试，不将历史纯文本自动解释为富文本 Markdown。本期不预装依赖、不预建编辑器适配层，也不把原调研版本作为安装门槛。

## 5. Website HTTP Contract

以下均为新增 Contract 路径，运行 URL 显式加 `/api` 前缀。全部使用 bearerAuth，并返回 Cache-Control: no-store；POST／PUT 成功不等于整份提交完成。

| Method／Contract path                                                         | operationId                     | 请求                             | 成功返回                                                           |
| ----------------------------------------------------------------------------- | ------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| GET `/support/feedback/options`                                               | getSupportFeedbackOptions       | 无                               | 200 FeedbackOptions                                                |
| POST `/support/feedback/submissions`                                          | prepareSupportFeedback          | FeedbackPrepare                  | 新记录 201、幂等重放 200；FeedbackSnapshot                         |
| GET `/support/feedback/submissions/{submissionId}`                            | getSupportFeedback              | UUID path                        | 200 FeedbackSnapshot                                               |
| GET `/support/feedback/submissions/lookup`                                    | lookupSupportFeedback           | submissionKey UUID query         | 200 FeedbackSnapshot；不存在或他人记录为404                        |
| PUT `/support/feedback/submissions/{submissionId}/attachments/{attachmentId}` | uploadSupportFeedbackAttachment | 两个 UUID path＋单文件 multipart | 200 FeedbackSnapshot                                               |
| POST `/support/feedback/submissions/{submissionId}/advance`                   | advanceSupportFeedback          | FeedbackAdvance                  | 完成／不写入重放 200，已处理但未完成／已在途 202；FeedbackSnapshot |

GET／HEAD 均只读；HEAD 不得执行接收确认、认领、过期清理或外部写入。PUT 的不变附件 ID与摘要使重放幂等；advance 的 expectedRevision 防止丢失响应后把重放误作下一次外部写入。

### 5.1 请求结构

所有对象 additionalProperties=false；schema 限于 Draft-07 子集，使用 oneOf＋kind const 区分 Request／Bug。可选标量在请求中统一为 null，不混用空字符串、undefined 和未定义 option ID。

```typescript
type FeedbackPrepare = {
  submissionKey: Uuid
  form:
    | {
        kind: 'request'
        title: string
        categoryOptionId: Uuid | null
        typeOptionId: Uuid | null
        departmentOptionId: Uuid | null
        largeFileUrl: string | null
        contentText: string
      }
    | {
        kind: 'bug'
        title: string
        typeOptionId: Uuid | null
        departmentOptionId: Uuid | null
        largeFileUrl: string | null
        details: {
          description: string
          reproductionSteps: string | null
          expectedResult: string | null
          actualResult: string | null
          frequency: 'always' | 'often' | 'sometimes' | 'once' | null
        }
      }
  attachments: Array<{
    id: Uuid
    originalName: string
    contentType: string
    byteLength: number
    sha256: string
  }>
}

type FeedbackAdvance = {
  expectedRevision: number
  intent: 'continue' | 'retry'
}
```

上述为 Contract 的规范形状，实施后不另手写这份 DTO。submissionKey 和附件 id 由浏览器 crypto.randomUUID() 生成；数组顺序为 ordinal 0–4。SHA-256 为 64 位小写十六进制，逐文件计算，byteLength 为 1–20,971,520。清单不允许重复 id；附件字节不是 JSON／base64。

Request 的 `contentText` 是普通输入框的原始纯文本，form 响应也按该字段恢复；`markdown_content` 仅属于服务端到 ClickUp 的映射。本期不接受 `contentMarkdown` 或 Tiptap 文档载荷，后续变更按第 4.2 节另行评审。

Prepare 单请求 JSON wire 上限为 192 KiB，允许合法正文在 JSON 中转义后增长；语义字节上限独立执行。其他 JSON 写请求上限 4 KiB。Bug body 出现 categoryOptionId 即 schema 拒绝，而非信任客户端覆盖默认值。

Multipart schema 为 { file: binary }，只有一个名为 file 的文件 part，不接受普通字段或其他 part；form filename 与声明 originalName、归一化后的媒体类型必须匹配。真实长度与 SHA-256 必须匹配声明。

### 5.2 响应结构与恢复提示

FeedbackOptions 固定包含 available:boolean、reason:null 或 not_configured／configuration_invalid／upstream_unavailable、categories／types／departments 的 {id,label} 数组，以及 limits（titleCodePoints=200、userContentBytes=65536、fileBytes=20971520、files=5、totalFileBytes=104857600）。不可用时三个数组为空，不返回凭据或外部错误正文。

FeedbackSnapshot 的必需字段为：

| 字段                        | 类型与语义                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| id、submissionKey           | UUID；id 为服务端创建的提交标识                                                               |
| revision                    | 0–MAX_SAFE_INTEGER，所有已持久化状态改变递增                                                  |
| form                        | 已归一化的上述 form，允许恢复正文；不含 token／邮箱                                           |
| createdAt、receiveExpiresAt | 复用 SafeTimestamp                                                                            |
| status                      | receiving／ready／creating／uploading／failed／verification_required／completed               |
| nextAction                  | upload／continue／wait／retry／verify／done／restart                                          |
| taskId、taskUrl             | string 或 null；URL 由任务 ID 按固定 ClickUp 主机生成                                         |
| failure                     | null 或 {code,phase,attachmentId,retryAfterSeconds}，只有固定安全分类                         |
| attachments                 | {id,ordinal,originalName,contentType,byteLength,sha256,status,remoteAttachmentId}[]；无 bytea |

附件状态为 expected／received／uploading／failed／verification_required／uploaded。phase 为 create_task／upload_attachment。所有 nullable 字段必须明确返回 null；status 与 nextAction 必须按以下规则成对返回。

| 状态／条件                                  | nextAction                                  |
| ------------------------------------------- | ------------------------------------------- |
| receiving 未过期                            | upload；零附件同样需 advance 固化提交       |
| receiving 已过期                            | restart，不改变数据库状态                   |
| ready                                       | continue                                    |
| creating，或 uploading 且有未过期的活动尝试 | wait                                        |
| creating／uploading 且活动尝试已过期        | verify；只派生提示，不在 GET／HEAD 中写状态 |
| uploading，无活动尝试且有 received 附件     | continue                                    |
| failed                                      | retry                                       |
| verification_required                       | verify                                      |
| completed                                   | done                                        |

failure code 只包括 UPSTREAM_REJECTED／UPSTREAM_RATE_LIMITED／UPSTREAM_CONFIGURATION／UPSTREAM_UNKNOWN；retryAfterSeconds 为 null 或正安全整数。返回 retry 不保证当前配置已经恢复，但只能继续已证明未写入的步骤。所有者恢复过程不暴露尝试 UUID、维护证据、token 或第三方用户信息。

### 5.3 错误与有限资源

请求级错误统一由 FeedbackError 实现现有公共错误字段，并经 `apps/server/src/errors.ts` 输出；扩展 ErrorCode 类型，不新增错误 envelope 格式。

| HTTP／code                               | 触发                                                               |
| ---------------------------------------- | ------------------------------------------------------------------ |
| 400 BAD_REQUEST／FEEDBACK_INVALID_INPUT  | schema、纯文本非空或选项非法                                       |
| 401 既有认证错误                         | 会话无效                                                           |
| 404 NOT_FOUND                            | 记录不存在或不属于当前用户                                         |
| 408 FEEDBACK_UPLOAD_TIMEOUT              | Website 文件接收超时                                               |
| 409 FEEDBACK_PAYLOAD_CONFLICT            | 同幂等键不同归一化载荷，或同附件 ID 不同字节                       |
| 409 FEEDBACK_STATE_CONFLICT              | 未来 revision、不可执行 intent、缺失附件、过期接收或已开始后的编辑 |
| 413 FEEDBACK_TOO_LARGE                   | 实际文件／清单／wire／JSON／正文超限                               |
| 415 FEEDBACK_UNSUPPORTED_MEDIA           | 非 multipart                                                       |
| 429 FEEDBACK_RATE_LIMITED／FEEDBACK_BUSY | 新提交频率、接收数、接收／同步槽不足                               |
| 503 FEEDBACK_UNAVAILABLE                 | 没有 token、配置或只读元数据不可用                                 |
| 500 INTERNAL_ERROR                       | 数据不变量损坏及未知本地错误                                       |

外部写入已经发生或可能发生时，先保存 safe failure／verification_required，然后以 202 返回 snapshot；不把它包装成无上下文的 502 而诱导客户端重新 prepare。保存结果失败时可返回 500，但旧 active attempt 仍能保护重试。回包无论是否成功，客户端都不能把任意 2xx 显示为最终成功。

## 6. 持久模型与不变量

新增 `support_feedback_submissions`、`support_feedback_attachments`，使用 `apps/server/src/db/schema.ts` 的 Drizzle／bytea 类型。没有已有反馈数据需要回填。

### 6.1 提交表

- id：server UUID，主键；user_id 外键指向 auth_users(id)，ON DELETE RESTRICT。
- submission_key：client UUID；UNIQUE(user_id, submission_key)。
- nickname_snapshot、form_kind、form_version=1、content_rule_version=1、form_json、user_markdown、final_markdown、payload_sha256。
- revision：bigint，0–MAX_SAFE_INTEGER；status 为上一节提交状态之一。
- attachment_count：0–5；total_attachment_bytes：0–104857600，与清单保持一致。
- created_at、receive_expires_at=created_at＋86400000、updated_at；安全整数毫秒。
- clickup_task_id：nullable、非空时唯一；target_list_id 固化为目标列表。
- attempt_id、attempt_kind、attempt_attachment_id、attempt_started_at、attempt_expires_at、attempt_owner_boot_id：nullable 的当前认领快照。
- failure_code、failure_phase、failure_attachment_id、retry_not_before：nullable 安全诊断；maintenance_resolution_json 为有限、经过脱敏的维护确认记录。

CHECK 约束保证 kind／版本／计数／摘要／revision／时间范围合法，active attempt 字段成组非空；upload_attachment 尝试必须已有 task ID。create_task 的认领前置条件是 task ID为空，但创建响应到达后须先保存已知 ID再做只读验证，因此不能把“create_task 尝试存在时 ID永远为空”写成 CHECK。状态 completed 必须有 task ID、无 active attempt、无 failure。涉及附件集合的跨行不变量由父行锁下的事务和读取核验保证，不声称普通 CHECK 能查询子表。

### 6.2 附件表

- submission_id 外键 ON DELETE RESTRICT；id 为清单 UUID，PRIMARY KEY(submission_id,id)。
- ordinal：0–4，UNIQUE(submission_id,ordinal)。
- original_name、content_type、byte_length、sha256：清单创建后不可改变。
- bytes：nullable bytea；status 为上一节附件状态之一。
- remote_attachment_id：nullable，UNIQUE(submission_id,remote_attachment_id)。
- created_at、updated_at：安全整数毫秒。

expected 的 bytes 和 remote ID 均为空；received／uploading／failed／verification_required 的 bytes 非空，真实 octet_length 等于 byte_length 且为 1–20971520；uploaded 的 remote ID 非空、bytes 为空。对应约束拒绝零长度、错误状态组合和不完整成功。

响应读取核验 form_kind 与 form_json、附件数量／顺序／总量、任务状态和尝试归属。损坏数据返回 INTERNAL_ERROR，不静默视为零附件或已完成。SQL 返回的 bigint 在 support records 层显式转为安全整数。

### 6.3 接收、冻结与计数

Prepare 在规范化 form、附件清单及服务端昵称快照后，以固定键顺序计算 SHA-256；幂等载荷摘要不包含昵称快照、时间或新生成的 server id。按附件顺序记录 {id,originalName,contentType,byteLength,sha256}。同键重放以已存快照为准，不因用户改昵称改变原提交。

在短事务中锁定 user 行，以序列化同用户的新记录计数，检查最近 10 分钟的新记录数 <10、未过期 receiving 数 <2，插入提交和全部 expected 附件。唯一约束裁决同键竞争。幂等重放先返回，不占用新记录额度；客户端不能在服务端保存后直接编辑原载荷。

单附件实际接收完成后，在短事务中锁定父提交，复核所有者、receiving 与期限，核对字节与摘要后更新 expected→received，revision++。并发 advance 不得抢先创建缺失附件的任务。已接收相同附件的重放验证一致后只返回当前 snapshot，不重新保存或改变远端状态。

## 7. 推进与外部写入

### 7.1 并发和 revision

advance 首先认证并读取本人记录：

1. expectedRevision 小于当前 revision：200 返回当前 snapshot，不产生外部写入；它是安全重放，不把旧命令应用到下一个步骤。
2. expectedRevision 大于当前 revision：409 STATE_CONFLICT。
3. completed：200 返回原成功。
4. verification_required：200 返回 verify，continue／retry 均不产生写入；即使保留未解决的 active attempt 也优先执行这一分支。
5. 有 active attempt 且已过期：短事务将它标记 verification_required、revision++，返回 verify；未过期则202返回 wait，不重复发起。
6. failed＋continue：409；failed＋retry 才可认领原失败步骤，且检查 retry_not_before。create_task 重试若已有 task ID则拒绝并要求核对；附件重试若已有 remote ID则只返回已完成进度，不能重新上传。
7. receiving 已过期或附件不齐：409；receiving 且齐全时固化 ready 并立即尝试认领 create_task。
8. ready＋continue 认领创建；uploading 无活动尝试时认领最小 ordinal 的 received 附件。

外部调用前先在短事务中 SELECT FOR UPDATE 父行，重新检查 revision／状态及当前附件，生成 attempt UUID，保存 phase／boot ID／期限，revision++。锁释放后才向 ClickUp 发出请求。每个请求最多一次 POST；任何后续推进都需拿到新的 snapshot revision。

先做只读配置／元数据 preflight，再认领外部尝试。同步槽不足时返回 FEEDBACK_BUSY 而不固化外部在途；slot 在全部异常和迟到结果路径释放。可按已确认协议安全判断为拒绝的故障才恢复 failed；存在发送／处理不确定性即 verification_required。

### 7.2 成功、失败与崩溃

创建响应到达：先校验任务 ID，在短事务中以 attempt UUID及当前状态为条件保存已知 ID，仍维持 creating。随后调用只读 getTask(include_markdown_description=true)，核对 List、任务类型、Title、初始状态、用户字段、所有发送的自定义字段和正文；一次 advance 仍只有一个外部 POST。核验全部一致后清除尝试，没有附件直接 completed，否则 uploading。必要成功字段缺失、GET 不可用或字段被静默忽略时进入 verification_required；有已保存 ID时保留该 ID，不能再次创建。

附件成功：校验非空 remote ID，在同一事务中标记 uploaded、保存 ID、bytes=NULL、清除 active attempt；全部附件 uploaded 则 completed，否则 uploading。每次处理只加载一个 20 MiB 上限的 bytea。

写响应的结果分类为：

| 外部结果                                             | 处置                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| 合法 2xx，必要 ID可核验                              | 固化成功，不以整个原始 JSON 作为 API 响应                       |
| 已收到且语义明确的 400／401／403／404／413／422 拒绝 | failed，保留步骤和字节；配置／选项修正后由用户重试              |
| 明确 429 拒绝                                        | failed，按 Retry-After／x-ratelimit-reset 固化 retry_not_before |
| timeout、连接中断、5xx、异常重定向、无法解析成功响应 | verification_required                                           |
| 调用前的只读 preflight 故障                          | 没有外部写入；503，不新增未知尝试                               |
| 外部完成但 DB 结果提交失败／进程退出                 | 持久化的 active attempt 保持在途；恢复后核对                    |

没有幂等保证的第三方写入无法严格保证 exactly-once；不依据“查不到任务”自动再次创建，不依据“没收到附件响应”自动再次上传。

每次进程启动生成独立 boot UUID。schema readiness 完成后、监听前，仅将旧 boot 所有的未解决尝试标记 verification_required，并提升 revision；不发出外部写入。运行中 expired attempt 由明确的维护／advance 命令转入核对，GET／HEAD 只把过期在途的 nextAction 派生为 verify，不更新行。结果提交总是匹配 attempt UUID、boot ID和状态，迟到响应不能覆盖维护结果。

API handler 即使浏览器断线，也等待当前已发出的调用结束并保存可知结果；不再发送后续步骤。应用停止时给在途推进至多 90 秒收尾，拒绝新的推进，等待或将未完成记录交给下次启动核对，之后才关闭数据库。扩展现有 start-application 的关闭资源契约，不让插件 import 启动任务。

### 7.3 时限与容量

| 资源                                               | 限制                                             |
| -------------------------------------------------- | ------------------------------------------------ |
| 单文件 wire                                        | 21037056 字节，20 MiB＋64 KiB                    |
| 文件 parts／fields                                 | 1／0                                             |
| multipart headerPairs／headerBytes／fieldNameBytes | 32／16384／64                                    |
| 单文件接收                                         | 120 秒，同时最多 2 个                            |
| task create／metadata read                         | 30 秒／10 秒                                     |
| 单附件外部上传                                     | 60 秒                                            |
| 单次 advance                                       | 90 秒，同时最多 2 个                             |
| 外部 JSON 响应                                     | 最多 2 MiB，超过或结构不明按操作阶段安全归类     |
| 接收期限                                           | 24 小时，仅 receiving                            |
| 新记录额度                                         | 同用户 10 次／10 分钟，最多 2 个未过期 receiving |

multipart hook 使用现有 MultipartUploadLifecycle，认证／归属前置，wire 计数、连接断线及超时清理不能另写简化版本。按 operation 的 x-fastify-config 登记限额；GET 不安装上传 hook。

默认 Nginx API 预算当前至少 64 MiB，大于每次上传 wire。本方案无需把预算扩大至 100 MiB；更新预算计算／测试时纳入 supportUpload.wireBytes，防止未来其他上限调低后代理拒绝合法反馈上传。验证 gateway 对 PUT 和多次请求的真实转发。

## 8. ClickUp 适配和字段映射

固定 API origin 为 https://api.clickup.com/api/v2，redirect:error。token 按正式配置读取；测试通过构造参数注入 fake transport，生产不可由用户请求改变 origin。外部 DTO 是适配器内部类型，不作为 Website endpoint 定义。

| 输入                  | 目标 ID／参数                                             |
| --------------------- | --------------------------------------------------------- |
| Request／Bug          | custom_item_id=1005／1001                                 |
| Title／最终正文／状态 | name／markdown_content／新增                              |
| Category              | 4acf848b-2a8d-4404-8cda-36156e0f066d                      |
| 修复 option           | d8b4afde-d586-40ae-93d4-0b6923ba6bb9                      |
| Type                  | 4c3befc0-5146-43a2-8610-86efe4e8124a                      |
| 部门                  | 9b3d2027-2162-42e2-81b9-d907592cdb5b                      |
| 额外文件链接          | 4f7eb8a3-5de7-4f3b-87bb-8be5dc2d573f                      |
| 用户                  | 346759da-1bc8-4ae7-aa0c-020102bc287b；值为「昵称 (UUID)」 |

Workspace 固定 90181517066，List 固定 901810170816。目标 ID与映射位于支持域只读配置，不接收客户端覆盖。getFields 使用 include_applied_objects=true；无 applied_objects 视为无该任务类型限制，存在时必须匹配 object_type=19 及对应 custom_item_id。

元数据服务缓存 60 秒，合并并发 refresh。options 读取失败时返回 available=false，不能继续提供过期“可提交”选项；创建前核验有效元数据以及指定 option ID，必要时刷新。用户选择过期 option 时明确拒绝，不替换为其他选项。远端删除字段、改变类型或任务类型适用范围时停止新建，既有已知任务附件续传可继续，不重新创建任务。

createTask 只发送 name、markdown_content、custom_item_id、status 与已填写／必需的 custom_fields。选填 null 不发送。Bug 的 Category 始终由服务器添加。用户身份从 authSession.userId 和 ProfileService.snapshot 取得，不发送额外个人资料。写入字段选项使用 UUID，不使用显示文案或 orderindex。

创建后的只读验证必须检查每个已发送字段，而非只检查 task ID。读取 dropdown 时，以该字段返回的 type_config.options 将 UUID value 或唯一的整数 orderindex value 归一化为 option ID；不存在／不唯一的映射进入核对，不猜测。最终正文按 CommonMark AST 核对纯文本内容、服务端生成的结构与精确提交编号，允许无语义差异的 Markdown 转义／换行变化；末尾分隔线和编号单独校验。仅对远端的自动 URL 链接允许例外：子节点全部为 text、无 title，文字与目标 URL 逐字符一致，且为有效的绝对 HTTP／HTTPS URL，不含凭据、空白、控制字符或反斜杠；将该节点还原为同一 URL 文字后仍须通过完整 AST 核对。不做 trim、解码、主机名、尾斜杠等 URL 同化；不同文字或目标、其他协议、嵌套格式及任意命名链接均进入核对。不能把用户文本被解释成标题、HTML 或其他未获允许的格式视为等价；description 纯文字相同不能替代结构核对。

uploadAttachment 的 multipart 字段为 attachment，单次一个原始 Blob／文件，不手设含 boundary 的 Content-Type。使用原文件名和安全媒体类型。Create Task Attachment 的官方响应声明 id、title、url 等；适配器只保留核对所需 ID及有限元数据，禁止回传第三方 user/email 或签名下载 URL。

task ID 必须符合 `^[A-Za-z0-9_-]{1,128}$`，taskUrl 从其编码后的 ID构造 https://app.clickup.com/t/{id}，不采信任意第三方 URL；公开入口只提供合法主机的任务链接。用户可能没有 ClickUp 登录权限，链接不作为“提交成功”的判断依据。

## 9. 维护核对与明确清理

新增 `apps/server/src/domains/support/maintenance.ts`，普通 factory 使用 db／ClickUp 服务；CLI 位于 `apps/server/src/cli/support-feedback.ts`，只由显式脚本调用，不 import CLI。Website 数据身份、配置读取、退出与连接释放遵守现有数据库 CLI 规则。

| CLI 命令契约                                                                                                                              | 行为                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| inspect --submission-id UUID                                                                                                              | 只读本地状态与尝试，输出安全元数据，不输出正文、bytea 或 token           |
| inspect --submission-id UUID --remote-task-id ID                                                                                          | 只读验证远端 List、类型、用户字段、提交编号及附件元数据                  |
| resolve-task --submission-id UUID --attempt-id UUID --remote-task-id ID --confirm                                                         | 核验后事务回填唯一任务 ID；不能创建或删除任务                            |
| resolve-attachment --submission-id UUID --attachment-id UUID --attempt-id UUID --remote-attachment-id ID --downloaded-file PATH --confirm | 本地用户明确提供的远端下载文件核验长度和 SHA-256；事务回填并释放暂存字节 |
| confirm-not-written --submission-id UUID --attempt-id UUID --evidence-file PATH --confirm                                                 | 维护者提供明确未写入证据后恢复同一步骤为 failed；不是查不到后的自动重试  |
| cleanup-expired --before TIMESTAMP [--apply --confirm]                                                                                    | 默认只读计划；显式应用时仅清理期限已过且无任务／尝试的 receiving 记录    |

维护写命令只能操作待核对或明确过期接收记录；对已过期的在途尝试，先在父行锁下将其标记 verification_required，再按原 attempt ID核对。inspect 可只读查看任意已明确指定的本地记录。行锁下复核当前 attempt ID、revision 与任务归属；已知成功结果不能被覆盖，没有候选、多个候选或无法证明附件内容一致时保持 verification_required。

resolve-task 核验并回填后清除 active attempt／failure、revision++，零附件转 completed，否则 uploading；已经保存 task ID时只接受同一个 ID。resolve-attachment 在同一事务中上传状态转 uploaded、写 remote ID、bytes=NULL、清除对应尝试／failure、revision++；全部 uploaded 才 completed。confirm-not-written 清除活动认领并将原步骤设 failed，保留载荷、字节和已经确认的 task ID，由用户再发 retry；不能绕回 prepare。

evidence-file 只接受最多 4 KiB 的封闭 JSON，字段为 evidenceKind（explicit_rejection／provider_confirmation）、providerReference（1–256 字符）、observedAt（SafeTimestamp）、confirmedNotExecuted=true；不接收原始日志或自由正文。维护者负责真实性确认，系统不把文件存在当成提供方证明。保存前核对其中不包含已知配置秘密，持久化这份有限确认和操作时间，删除文件路径等本机信息；不保存任意原文件、bytea 或未经筛选的远端响应。

远端任务核对必须匹配 List、custom_item_id、用户字段、业务正文与精确提交编号。附件核对需验证它属于原 task，且 downloaded-file 的实际 bytes 匹配本地摘要；不能只凭名称和大小认为是同一个附件。维护者通过现有 ClickUp UI 获取文件，本 CLI 不对任意 URL 发起下载。

confirm-not-written 不把超时、5xx、空列表或暂时查不到作为证据。create_task 已保存 task ID时禁止确认未创建，只能核对该已知任务；附件已有 remote ID时也不能确认未上传。仅维护者掌握提供方明确拒绝／未执行的记录等证据时可使用；无法证明则维持待核对。这接受极少数提交需要人工判断的限制，以防重复创建。

cleanup 对未开始外部同步的过期 receiving 执行明确删除，先子表后父表；拒绝 ready、creating、uploading、failed、verification_required、completed。同用户 receiving 额度查询可排除过期行，但不能隐式删除。普通启动、GET、停止和 reset 之外的日常操作不清理反馈数据。

## 10. 前端提交流程和恢复

1. 打开对应 Modal 后读取 options；不可用显示固定说明，禁用提交。Type／部门默认 null，Request Category 默认 null，Bug 没有该字段。
2. RHF＋Zod 完整校验；按文件顺序读取并计算 SHA-256，生成一份稳定 submissionKey 和清单。只在首次准备新提交时生成，prepare 网络失败后必须重放同一个载荷和 key。
3. 发送 Prepare 前，在当前标签页 sessionStorage 保存该 form kind 的 submissionKey；收到 snapshot 后补充 server submissionId。不保存正文／bytea／token。尚未收到 prepare 响应时保留校验快照在当前页面内存，绝不因重试换 key；重新打开而尚无 server ID时，通过只读 lookup 按 user_id＋submission_key 查询恢复。不把暂时404认定为必须换 key，仍保留原 key 并提供重新核对入口。
4. 按 ordinal 逐文件 PUT；显示进度阶段／已接收数。上传网络失败先 GET 当前记录，已 received 不重复发送；未 received 用原文件继续。
5. 发送 advance(expectedRevision,continue)。仅当返回 nextAction=continue 且本次有确认进度时使用新 revision 推进下一步；wait 时只 GET，1 秒起、最多 5 秒间隔退避。
6. 请求网络失败／超时后先 GET；failed 显示原步骤重试按钮，不自动 retry；verify 展示提交编号与固定说明；done 才使用 ExMessage 完成句柄提示成功，并清除恢复指针、reset 表单。
7. 用户主动重试使用 advance(expectedRevision,retry)，成功的任务／附件不重传。同 key 不允许修改表单。需要新内容时明确开始新反馈；待核对状态不提供“再提交一份相同反馈”的默认操作。
8. 重新打开时 GET 本人 snapshot 恢复值和已接收附件元数据；浏览器不能恢复未上传的 File，提示重新选择缺失附件并核对摘要。已知 server ID收到404时清除失效指针；仅有 submissionKey 的未确认 prepare 按上一条继续核对，不披露其他用户记录。
9. 关闭／退出登录停止下一次推进，当前外部操作仍可能完成；重新核验登录后通过记录恢复。持续错误在弹窗内显示，字段错误由所属表单 setError；不直接显示原始异常。

RHF 表单使用现有 ExForm schema 接口和 ExUI 导出的 useForm，普通输入控件通过其公开字段接口接入；若直接 RHF，则使用仓库已有 resolver 和 Field。选择一种一致接入，不把外部 RHF 实例传给 ExForm。Request 始终恢复 `contentText`，本期没有编辑器文档、选择或撤销栈桥接。

桌面最大宽约 48rem、高度 85dvh；移动端适配屏幕与虚拟键盘。正文滚动、footer 持续可见。中文输入法组合期间不得因规范化回写打断 composition；Markdown 转换不回写普通输入框。弹窗 Escape／放弃确认、Tab 导航、恢复 focus 与纯文本粘贴进行真实浏览器验收；链接子弹窗与编辑器行为留待后续 Tiptap 阶段。

## 11. 配置、启动与兼容

将 CLICKUP_TOKEN 加入 `scripts/runtime/settings.mjs` 的 websiteKeys／supportedKeys，确保进程变量覆盖根配置，仅注入 server，web／Outline／Hydra 环境不包含它。现有 runtime redact 已匹配 TOKEN 名称，但新增测试必须验证短 token、百分号编码 token 和 retained logs。不得增加 VITE_CLICKUP_TOKEN。

ClickUp config 是 enabled／disabled／invalid 的判别对象；缺失或非法配置只使反馈不可用，并输出固定安全诊断，不因未配置外部能力阻止其他 Website 功能启动。配置 token 存在不代表远端可用，401／403 由元数据或写请求安全归类。

没有新监听端口、后台 worker、外部发布或依赖本地 link。只有 server 装配新增服务，HTTP operation 是 additive，不修改既有字段或发明 API 版本兼容层。发布包通过现有 pnpm lockfile 固定；安装只在获准实施阶段进行。

Prepare／PUT／advance 的 route config 在统一 HTTP scope 安装，hook 只筛选对应 operation。确保 JSON bodyLimit、multipart counter 与 Contract预算一致。未配置外部能力时仍注册全部 Contract operation 并返回明确空态／不可用，不能按 token 有无删除路由而破坏 operation 双向覆盖。

## 12. 迁移、落地与回退

按依赖顺序落地，一份 RFC 覆盖这些紧密关联的单元：

1. 更新 `.ai/databases/data-model.md` 的已批准模型影响；新增两表 migration、schema-check 与 reset-plan，验证旧 journal 升级和空库迁移。只生成／审核迁移，不在普通启动中隐式应用。
2. 先写 Contract、运行 api:lint／api:generate，提交生成产物的工作树变化；细化型 DTO 不手改 schema.d.ts。
3. 实现纯内容包、ClickUp 适配器和 support factory／记录层／状态机；外部测试使用 fake transport，数据库用 Testcontainers。
4. 接入业务插件、HTTP hooks／handlers、正式 runtime 配置及维护 CLI；更新全体 createApp fixtures 所需依赖。
5. 接入 Request 普通多行文本输入框、共同字段、Bug 字段和客户端推进；本期不安装或接入 Tiptap，保持投诉弹窗原有范围。
6. 完成自动、浏览器和已明确授权的真实 ClickUp 验收，最后同步 evidence-backed `.ai/` 模块知识。

以上步骤先独立完成，不等待 Tiptap 支持分支。后续再更新两份设计文档、复用该分支编辑器能力、评审正文 Contract／规则版本与旧记录恢复，并补齐富文本验收；不将该后续阶段并入本期完成条件。

更新 workspace 构建／typecheck 顺序，使纯内容包先于消费者构建；更新根测试发现、脚本 tests.mjs 的 watch 目录，以及相关 Vite／Vitest alias，避免新包未参与根验证。不得将新 Website 测试误登记为 Outline 定制测试。

本期仅本地开发。第一次使用需显式 pnpm db:migrate；缺 migration／表／约束时监听前拒绝启动，不自动建库或重置。没有旧反馈需要 backfill，但旧实例不能与新实例同时推进；当前仅支持一个 Website 进程。

应用回退时先停止接收和推进、让当前尝试收尾，再回退代码；保留两张表及反馈数据，不逆向删除已发布 migration。若旧启动校验不能接受额外表，明确保留功能关闭的新版本作为回退点，不绕过身份／schema 校验。ClickUp 已创建任务或附件不随应用回退删除，未知尝试继续保留等待核对。

## 13. 验证与交付门槛

| 类别     | 必须覆盖                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 内容     | Request 纯文本转义与换行、Bug 文本转义与顺序、空白无效而 Markdown 标记保留为文字、原文／转义后64及最终65 KiB边界、HTML／代码围栏作为文字、额外链接HTTPS限制 |
| Contract | 六个 operation 的真实 Fastify 响应、原始 handler 返回值、oneOf 分支、封闭字段、nullable、状态／nextAction 配对、无凭据、双向覆盖                            |
| 接收     | 20 MiB 精确边界、第 6 个文件、100 MiB 清单、零文件、长度／摘要／MIME 不一致、超量 parts、重复 id、断线和120秒超时、2槽释放                                  |
| 数据     | 同键同载荷、同键冲突、两个用户同 key、prepare 竞争、父行锁与上传竞争、已成功字节释放、损坏数据拒绝、额度和期限                                              |
| 同步     | 每次最多一次外部 POST、revision 重放不跨步骤、并发认领、已成功任务／附件不重做、429 冷却、异常／5xx／响应不明进入核对                                       |
| 恢复     | 创建成功后 DB 保存失败、附件响应丢失、boot 恢复、expired attempt、迟到响应 fencing、关闭后再打开、丢失 prepare 响应重放                                     |
| 权限     | 所有 API 认证、上传认证先于字节消费、跨用户404、伪造用户／List／Category拒绝、GET／HEAD不写入                                                               |
| 维护     | 只读 inspect、错误目标拒绝、附件内容摘要证明、同远端ID重复绑定拒绝、confirm-not-written 不自动推断、cleanup dry-run及适用范围                               |
| runtime  | token 正式注入、进程变量优先、web／Outline／Hydra 无泄漏、固定无配置空态、启动 readiness、关闭等待、gateway PUT 转发                                        |
| 浏览器   | 明暗主题、桌面／移动／虚拟键盘、键盘与焦点、中文 composition、表单 reset／恢复、滚动 footer、文件移除、失败重试、成功清空                                   |

根自动命令为 pnpm api:lint、pnpm api:generate、pnpm typecheck、pnpm test、pnpm build。本仓库当前无 TESTING.md，按现有 Vitest／runtime 脚本流程；数据库测试用 PostgreSQL Testcontainers 和每例隔离 schema，Docker 不可用明确失败，不回退开发库。

真实 ClickUp 验收至少对 Request 与 Bug 各一条已授权测试任务，核对类型、默认修复、全部选填字段、用户快照、中文纯文本转义与换行的实际显示及 5 个附件。尤其确认 multipart attachment 字段和官方响应 ID的实际行为；官方 schema 与 fake 不能替代真实上传。测试任务／附件的保留或清理按明确授权处理，本 RFC 不授权自动删除。

本期不验收 Tiptap、富文本格式往返、工具栏或链接弹窗。后续接入阶段补齐这些项目，并验证编辑器 reset／恢复、中文输入法、富文本协议校验及历史纯文本提交恢复。

自动检查、真实浏览器、真实 ClickUp 和部署分别报告；不能由本方案文本推断验收通过。已授权的真实 ClickUp 结果及剩余边界见 `.notes/support-center/acceptance/2026-10-15-clickup-acceptance.md`。

## 14. 风险、取舍与未完成门槛

| 风险                           | 处理／检测                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------- |
| 外部写入结果未知               | 本地预先固化 attempt＋revision；未知停止写入，维护核对；不承诺 exactly-once     |
| 纯文本转义或 ClickUp 显示差异  | 共享内容规则、文字与换行 fixtures＋真实目标桶验收                               |
| 后续 Tiptap 接入影响旧记录     | 复用支持分支，先评审 Contract／规则版本与恢复影响；保留原纯文本载荷及固化正文   |
| 附件暂存增加 DB／备份容量      | 逐文件与2槽、每记录100MiB、同用户额度；成功字节释放，失败数据保留，显式过期清理 |
| 浏览器关闭导致未发出的步骤停顿 | 保存恢复指针与服务端数据；再次打开继续；不伪装后台自动完成                      |
| 元数据变化导致字段被忽略       | 缓存有期限，创建前核验类型／适用范围／option，写入必要ID校验与真实测试          |
| 未知结果需人工证据             | 明确接受这一限制；没有唯一匹配或未写入证据时保持待核对                          |
| token 或提交内容泄漏           | 固定 API origin、无重定向、服务端配置、有限日志、只读归属检查与无前端持久正文   |

直接转发省去本地记录但不满足恢复要求；后台队列改善离线继续能力，但用户已选择立即同步。Tiptap 保留为后续编辑方向；本期普通输入框占位，先交付反馈链路，后续复用另一分支成果。

本期产品选择已确定。实施前的门槛是 migration 模型影响评审与本期内容处理依赖核对，不包含 Tiptap 依赖或支持分支合入；交付前的门槛是完整自动／浏览器检查以及明确授权的真实 ClickUp 写入验收。后续编辑器接口与版本在接入阶段细化。这些是验证条件，不能提前表述为已实现或已通过。

## 15. 来源与责任交接

仓库来源：`api/openapi.yaml`、`packages/api-client/src/client.ts`、`apps/web/src/api/client.ts`、`apps/server/src/app.ts`、`apps/server/src/business-services.ts`、`apps/server/src/http/plugin.ts`、`apps/server/src/http/service-handlers.ts`、`apps/server/src/http/shared/multipart-upload-lifecycle.ts`、`apps/server/src/start-application.ts`、`scripts/runtime/settings.mjs`、`scripts/runtime/output.mjs`、`scripts/runtime/nginx.mjs`。

外部来源：[Create Task](https://developer.clickup.com/reference/createtask)、[Create Task Attachment](https://developer.clickup.com/reference/createtaskattachment)、[Get Task](https://developer.clickup.com/reference/gettask)、[List Custom Fields](https://developer.clickup.com/reference/getaccessiblecustomfields)。[Tiptap React](https://tiptap.dev/docs/editor/getting-started/install/react)、[Tiptap Markdown](https://tiptap.dev/docs/editor/markdown) 保留为后续富文本阶段的原调研来源，本期不据此安装依赖。2026-10-14 设计阶段从官方 endpoint Markdown 内的 OpenAPI definition 核对了附件 response 的 id／title 等声明，当时未验证真实上传；后续实际结果见 `.notes/support-center/acceptance/2026-10-15-clickup-acceptance.md`。

技术交接以本 RFC 和源设计的本期普通输入框版本共同作为实施范围，优先开发反馈功能，不等待另一分支的 Tiptap 支持。业务及表单实施者负责落地与自测，独立验证负责对关键状态／权限／真实行为给出证据；此处没有指定未获确认的人员或发布负责人。Tiptap 接入另作后续文档更新与实施任务。审批产品设计不产生 Git commit／push 或外部发布授权。
