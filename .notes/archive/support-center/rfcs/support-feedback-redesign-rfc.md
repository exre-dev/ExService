# RFC：支持中心六类反馈与配置字段

> 2026-10-16：Markdown 接入依据 `.notes/support-center/specs/2026-10-16-feedback-markdown-design.md`，实施计划见 `.notes/support-center/plans/2026-10-16-feedback-markdown.md`。新正文带显式格式，旧纯文本记录保留原规则；下文“不接入 Tiptap”和早期破坏性清理仅属于原重构阶段，不适用于此次增量更新。

- 状态：Accepted for implementation；用户已授权按默认同意完成设计并直接开发。
- 日期：2026-10-15。
- 模块根目录：`.notes/support-center/`。
- 唯一产品依据：`.notes/support-center/specs/2026-10-15-support-feedback-redesign-design.md`。
- 本 RFC 取代旧 `support-feedback-rfc.md` 的双入口、旧表单与单链接映射；旧文档原位保留。

## 1. 问题与选择

当前反馈组件将 Request/Bug 表单、文件选择、进度和恢复放在一个 Modal 中，旧 Category 还是服务端必备配置。新需求需要统一选择六种类型，按类型精确控制字段，同时允许替换 ClickUp 字段 JSON 调整已有选项。

选择固定六类表单、受限 JSON 字段组件与独立附件组件；继续复用现有六个 HTTP operation 和单步外部同步状态机。该更新具有破坏性，不实现旧数据与旧客户端兼容。正文暂用普通文本，Tiptap 接入独立于此次交付。

## 2. 责任与改动边界

| 单元                               | 所有权                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `apps/web/src/pages/Support/`      | 两张入口、类型选择、分类型草稿、表单展示、提交与恢复 UI。                        |
| `packages/components/src/`         | `ClickUpFieldInput`、`FileUploader` 及各自样式、测试和公开导出。组件不访问 API。 |
| `apps/web/public/clickups/fields/` | 三个 UUID 命名 JSON，是字段显示配置的唯一编辑来源。                              |
| `packages/feedback-content/`       | 类型无关的纯文本规则、Bug 正文组合和共享大小限制。                               |
| `apps/server/src/domains/support/` | JSON 配置读取、六类映射、preflight、不可变创建载荷、进度与恢复。                 |
| `apps/server/src/modules/clickup/` | 通用 tags 读写载荷及回读解析、Space Tag 查询；不引用支持中心类型。               |
| `api/`                             | options、六类输入、快照的唯一 HTTP Contract。                                    |
| Server DB / drizzle                | 新格式快照约束和仅反馈数据的破坏性增量迁移。                                     |

不修改 Outline、不安装 Tiptap、不提交凭据、不创建新的数据库或重置 `exre`。

## 3. 前端与组件契约

### 3.1 统一 Modal

将类型选择、动态表单和提交进度拆为明确单元；外层容器维护 Modal、当前类型和流程状态，RHF/Zod 管理字段值与错误。类型为 `bug | feature | asset | request | content | campaign`。

初始页六个按钮两列排列，窄屏单列；选择类型即显示表单。表单顶部显示当前类型和返回按钮。编辑阶段按类型保存内存草稿（含 File），返回不触发提交；确认关闭后清除所有草稿。prepare 开始即固定类型，禁止返回修改，重新打开优先读取当前未完成记录。

新版本使用统一的 `exwebsite.feedback.v2` 恢复 key，只保存提交 key / ID。忽略并清理本站旧 `exwebsite.feedback.v1.request`、`exwebsite.feedback.v1.bug` 指针，不做 lookup 转换。读取到不存在的新格式记录时保留现有安全核对规则，不因网络异常重新生成 key。恢复完成才允许填写下一份。

字段严格遵循 Spec 第 5 节；Bug 无 Domain，只有 feature 有 Domain；仅 asset/content 有 action；content/campaign 无 Type。切换与序列化必须删除不适用字段，服务端拒绝额外字段。

### 3.2 ClickUpFieldInput

受限字段定义采用 ClickUp 原生结构：`id`、`name`、`type`、`type_config.options`、`required`，以及可选 `applied_objects`。保留 option 的 `id/name/color/orderindex`。支持 `drop_down | short_text | text`；类型或配置不合法时显示明确错误并禁止使用，不静默猜测。

组件接收字段定义、表单绑定、可选 label/description、disabled；值由 RHF 持有。下拉使用 option ID 作为 value，按 orderindex 排序，选填字段提供空选项。渲染以 ExUI Field/Input/Textarea/选择组件为基础，支持错误、聚焦、label 和 aria 关联。

组件只表达控件，不根据 ClickUp `required` 自行覆盖业务必填规则；表单 Zod 与服务端规则仍是业务权威。内部可以复用现有 ConfiguredField 的清晰模式，不要求把整个仓库表单迁移到新组件。

### 3.3 FileUploader

公开能力包括 value/onChange、maxFiles、maxFileSize、maxTotalSize、acceptedTypes、disabled、fileSelectionDisabled、enableLargeFileInfo、largeFileInfoEnabled、largeFileInfo/onChange 和错误。具体 prop 命名可遵守本仓库规范，但语义必须覆盖以上能力。

通过 RHF Controller / 字段绑定使用，不创建第二套表单状态。共享 Zod 文件规则可导出给消费者，组件不得在 submit 中另写逐字段检查。支持选择文件后追加与移除，展示名称及 MiB；恢复模式只允许重新选择待接收文件，已固定的补充文本不可改。

`acceptedTypes` 支持 MIME、MIME 通配和扩展名，与原生 accept 一致；选择后同样校验。支持模块本次传入 5 个、20 MiB、100 MiB、不限制类型、启用补充信息。开启 Switch 展示多行文本；关闭不发送该字段，内存草稿可保留。补充信息不触发远程下载，不解释或执行链接。

## 4. JSON 配置装载

从 probe 提取 Type / Domain / 额外文件链接三个单字段完整对象，写到 Spec 指定的三个 UUID.json。不要复制其他字段、AI prompt、自动化按钮、token 或任务数据。

Server source 模式读取此规范目录；Server build 校验并复制相同三个文件到自身产物的固定资源目录，生产运行读取打包副本。不得依赖部署后仍存在 Web 源码目录。源与产物选择必须由确定的模块位置 / 构建路径决定，禁止随意回退到工作目录中的同名文件。测试允许注入字段定义，无须读取真实 ClickUp。

options operation 返回经校验的字段定义、六类可用状态、受支持操作可用状态及统一限制。Web 只通过共享 API Client 读取；公开 JSON 的存在用于维护与构建，不要求页面另行 fetch JSON。

字段配置变化需要重新构建并重启。原始 JSON 中未知但无害的描述元数据可以忽略；字段 ID / 类型 / option ID 的重复、非法形状和超量均须报错。服务端配置仅允许受控三个 ID；用户不能提交任意自定义字段 ID。

## 5. HTTP Contract

保留当前六个 operationId 和路由：`getSupportFeedbackOptions`、`prepareSupportFeedback`、查询提交、按 key 查询、上传附件、推进。精确名称沿用 `api/paths/support.yaml` 的登记，不新增平行 endpoint。

`FeedbackForm` 改为六个封闭对象的 oneOf，各自 `kind` 用 const 区分，`additionalProperties: false`。共同字段为 `kind/title/largeFileInfo`，正文为 `contentText`（非 Bug）或 `details`（Bug）。

| kind     | 额外输入                                          | ClickUp |
| -------- | ------------------------------------------------- | ------- |
| bug      | `typeOptionId`（新提交必填）、Bug details         | 1001    |
| feature  | `typeOptionId`、`departmentOptionId`、contentText | 0       |
| asset    | `typeOptionId`、`action`、contentText             | 1009    |
| request  | `typeOptionId`、contentText                       | 1005    |
| content  | `action`、contentText                             | 1007    |
| campaign | contentText                                       | 1008    |

所有可选输入统一用显式 null 或 Contract 明确的缺省归一化，规范化持久值固定一致。`action` 为 `add | modify | delete | other`，映射「新增」「修改」「删除」或无 Tag。`largeFileInfo` 为 null 或至多 16 KiB UTF-8 的多行普通文本，替代 largeFileUrl；空白归一化 null。移除 categoryOptionId 和旧 FeedbackRequestForm 的部门规则。

`FeedbackPrepare.form` 引用 `FeedbackSubmissionForm`，其中 `FeedbackBugSubmissionForm` 约束新 Bug 的 `typeOptionId` 不得为 null；前端 RHF/Zod 同步要求选择，并通过 `ClickUpFieldInput.required` 覆盖本类型的展示和清空行为，不改写共享 ClickUp JSON 的 required 元数据。`FeedbackForm` 继续描述已接收快照，允许此前冻结的 Bug null 分类；`readRecord` 使用 `normalizeStoredPrepare` 校验完整旧快照形状及内容，不套用新的 intake 条件。分类文案按 Spec 第 5 节区分四类用途。

options 中各类型含稳定 kind、可用性与固定原因码；字段定义是明确列举的受支持形状，不能通过自由 JSON 绕过 Contract。操作可用性单独描述：缺少「新增」Tag 只阻止需要该 Tag 的动作，「其他」仍可用。公共凭据或 List 无效才禁用所有类型。字段适用性按真正依赖该字段的类型核验，不要求 Campaign 支持它并不使用的 Type。

更新 `api/openapi.yaml` / schemas / paths 后运行 api:lint 和 api:generate，不手改生成类型。原 handler 输出和真实 Fastify 响应必须都验证，防止序列化隐藏多余字段或错误类型。

## 6. ClickUp 映射与准备

目标 Workspace=`90181517066`，List=`901810170816`，初始 status=「新增」，目标 Space 经 List 元数据核验（本次只读为 `90185812083`）。用户归属仍由服务端 Profile 快照填入昵称和账号 ID。

TaskType 映射按第 5 节显式定义；标准 Task 不要求出现在 Get Custom Task Types 的自定义列表中。创建时明确传入 custom_item_id=0；回读适配须正确处理 ClickUp 标准任务表示，不能把标准 Task 当成未配置或转成 Request。其余自定义 TaskType 必须精确核对 ID。

所有类型移除 Category 写入和旧 repair 前置。大文件信息写入 `4f7eb8a3-5de7-4f3b-87bb-8be5dc2d573f` text 字段。Type、Domain 按 Spec 矩阵写入；null 不写外部字段。

通用 ClickUp adapter 增加创建载荷 tags 数组、读取任务 Tag 名称、读取目标 Space Tag 清单。`tags` 在创建请求中一次传入，保证 advance 仍最多一个外部写请求；不在用户提交中自动另发创建 Space Tag 或补 Tag 请求。

「新增」「修改」「删除」须在目标 Space 预建。缺失时 options 返回该动作不可用，preflight 再核对；不因用户选择操作就偷偷创建全局标签。交付文档提供显式准备步骤；实际外部配置变更与真实写入验收按授权单独执行，不阻塞实现和 fake transport 测试。

回读核对任务 ID、List、类型、标题、状态、已填写字段、完整正文和操作 Tag。所选操作 Tag 必须存在，其他受控操作 Tag 不得混入；「其他」及其余四类不应出现受控操作 Tag，其他由远端正常产生的无关 Tag 不作为正文一致性的替代依据。

## 7. 不可变记录与推进

prepare 在同一事务内固定规范表单、正文、用户快照及外部创建载荷。新增载荷 JSON 快照及完整性核验，含 List、TaskType、status、custom_fields、tags，避免后续更新配置改变原任务。可选择明确新列或新格式结构；SQL、readiness、reset-plan 和维护 CLI 必须一致。

仅支持新表单版本 2；纯文本内容规则仍沿用原版本 1（正文语义未变）。读取旧版本明确拒绝，不进入兼容路径。`payload_sha256` 覆盖规范化输入；外部载荷也须有确定性验证，禁止从当前 JSON 重算并替换旧快照。

原 receiving / ready / creating / uploading / failed / verification_required / completed 状态、24 小时接收期和逐附件摘要校验保持。创建 claim、外部请求、结果落库与任务核对保持既有事务边界、expectedRevision、attempt/boot fencing。支持 six kind 后更新所有分支，不能把非 request 一律当 Bug。

未知结果不重投，明确失败才继续原步骤。GET / lookup 无外部写入。全部附件成功落库后才报告 completed，成功附件继续释放暂存 bytea。维护命令处理最新快照格式和 Tag，不能因移除旧字段绕过核对。

## 8. 破坏性迁移与启用

实施前更新 `.ai/databases/data-model.md` 中反馈数据规则，再修改 schema / migration。新 migration 只处理反馈表：先清理附件子表与父提交记录，再变更新版本约束、kind 和载荷快照结构；不得清理 auth_users、通知、头像或 Outline 数据。

保留已有 0003 migration 字节，新建后续 migration 与 Drizzle 元数据。空库顺序执行后得到最新结构；已有开发库显式执行后清除旧反馈，不支持回填。readiness 的必需结构、migration 校验、schema signatures 与 reset-plan 随之更新。

启用次序：停止旧反馈写入并等待在途调用，保留不确定任务的人工核对线索；显式核对 exre 并执行迁移；构建一致的前后端与 JSON；重启；刷新浏览器并使用新恢复 key。普通 dev / start 继续只检查准备状态，不自动清理或迁移。

回滚应用代码不能恢复已删除的旧记录。需要恢复旧开发状态时使用事先保留的数据库备份和对应代码，不支持新旧程序同时写入。迁移不删除远端 ClickUp 任务、标签或附件。

## 9. 实施顺序与所有权

1. 保存并自检本 Spec / RFC，依据用户默认同意进入实施，不再追加设计确认。
2. 主实现者先写会失败的六类映射 / 字段矩阵 / 新输入测试，再实施 Contract、JSON、共享纯文本规则、适配器、服务端和迁移。
3. 同一主实现者随后实现共享组件与统一 Modal，完成字段和恢复流程测试，避免多人同时修改同一工作树的共享产物。
4. 冻结候选后，由 Test Engineer 独立运行最终验证，Code Review 只读审查同一候选；必要修复回到原实现者。
5. 验证后维护实际 `.ai/` 持久知识和验收边界。不创建 commit、PR、push 或部署。

## 10. 验证

### 行为测试

- 六个 kind 的允许 / 禁止字段、TaskType、无 Category、Bug 无 Domain、仅 feature 有 Domain。
- 四种操作、中文 Tag、一请求创建、Tag 缺失按动作降级、标准 Task 不被自定义类型列表阻塞。
- JSON 新选项 / 顺序 / 名称更新后供前后端一致使用；配置冲突不改变已 prepare 快照。
- 两张入口、六种选择、草稿隔离、关闭确认、pending 优先恢复、旧指针失效。
- FileUploader 数量、单体 / 总量、类型、重复选择、移除、Switch、多链接提取码文本、恢复禁用状态。
- 授权、原始 handler 输出、真实 HTTP、重复命令、超时不重投、附件摘要与部分失败、最新版维护 CLI。
- Testcontainers 中新 migration 清理旧支持数据且保留账号等其他数据；schema/readiness/reset 同步一致。

### 最终命令与浏览器

冻结后依次执行 `pnpm api:lint`、`pnpm api:generate`、`pnpm typecheck`、`pnpm test`、`pnpm build`。完整测试只用 Testcontainers，Docker 不可用则明确失败，不改用开发库。Windows Python PATH 问题只在进程局部修正。

真实浏览器检查明暗主题、桌面和窄屏，类型选择、六类字段、长内容滚动、键盘、关闭、配置不可用状态。真实 ClickUp 六类创建、Tag 和附件验收独立记录，不能把 fake transport 或构建通过表述成外部完成。

## 11. 风险与接受条件

| 风险                       | 处理与检测                                                                     |
| -------------------------- | ------------------------------------------------------------------------------ |
| JSON 与 ClickUp 配置不同步 | 更新后重建重启；options/preflight 按字段适用性与真实 ID 核对，冻结后用原载荷。 |
| 三个操作 Tag 尚未创建      | 显式准备，不在用户流程创建；按操作禁用，fake transport 覆盖，真实验收单列。    |
| 大文本或附件超出预算       | RHF/Zod 和服务端共同校验 UTF-8/字节数，上传前认证，wire 预算保持一致。         |
| 破坏性清理丢失旧恢复记录   | 用户已接受不兼容；停写、核对不确定任务、限定两张反馈表，不自动迁移。           |
| 用户输入被解释为格式       | 共享纯文本转义和完整 Markdown 结构核对继续使用，Tiptap 不在本次引入。          |
| 共享工作树已有未提交实现   | 以现有工作为基线，最小修改，不回滚无关文件，不自动提交。                       |

无待用户决定的产品问题。外部 Tag 准备和真实六类任务写入是外部验收依赖，不影响本地开发与自动测试。

## 12. 资料与证据

Spec 第 12 节列出源码与本次只读核对。官方 [Create Task](https://developer.clickup.com/reference/createtask) 定义 tags 和 custom_item_id=0 以及自定义字段适用约束；[Get Space Tags](https://developer.clickup.com/reference/getspacetags) 用于只读检查目标 Space 的 Tag。本 RFC 不声称外部写入已通过。
