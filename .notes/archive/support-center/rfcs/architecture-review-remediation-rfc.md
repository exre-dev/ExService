# 支持反馈架构审查修复 RFC

- 状态：已实施；独立架构评审、代码审查与完整测试均已通过。
- 范围：2026-10-15 架构审查报告的 01 历史冻结载荷、02 前端反馈类型规则、03 状态裁决、04 字段定义校验。
- 依据：输入报告 `architecture-review-20261015-225209.html` 的四项候选；当前边界以 `.ai/architectures/support-center/feedback-lifecycle.md`、`.ai/databases/data-model.md`、`api/openapi.yaml` 和源码为准。

## 决策摘要

将历史冻结载荷的校验和远端回读放进 support 域内的一个模块；将浏览器的 kind 规则集中在本地纯模块；将正常推进与人工维护的持久状态裁决集中在一个事务内模块；将构建和运行时的字段 JSON 合法性集中在可由原生 Node 加载的 `.mjs`。四项均保持现有用户行为、HTTP Contract、表结构、冻结 JSON 形状及外部写入协议。实施顺序为 01 再 03；02 和 04 可独立设计与验证，但同一工作树的文件写入及集成检查仍串行。

这是已有功能的内部重构。真实 ClickUp、网关和部署验收不由本 RFC 或本地测试替代。

## 现状证据与目标

| 候选 | 当前证据                                                                                                                                                                                                                                                                                                                                                            | 目标与边界                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 01   | `records.ts` 第 35–42 行用当前 `TARGET` 字段 ID 生成期望字段，且 v3 要求当前 `COMMUNITY_TARGET` 的 List、TaskType、status；`metadata.ts` 第 118–122 行依赖当前 List 区分社区 Tag 与匿名用户字段。现有 `state-machine.test.ts` 第 29–50 行已证明 v2 允许旧 List、TaskType、status、用户字段 ID；`community.test.ts` 第 73–106 行证明匿名载荷和远端复杂身份值须拒绝。 | 历史记录按冻结值和受控历史策略核验；当前目标配置只用于新记录的 preflight 与冻结。保留 v2 的宽容历史映射及 v3 的严格匿名隐私约束。   |
| 02   | `feedbackFormConfig.ts` 分组入口，`flow.ts` 第 19 行用非社区补集推断 development，`schema.ts` 与 `FeedbackModal.tsx` 重复解释分类、操作、部门、正文与匿名适用性。                                                                                                                                                                                                   | 一个前端纯规则入口提供 kind→area、适用字段和展示元数据；保留 Zod、RHF 和生成的 Contract union 各自职责，不迁入 `packages/common/`。 |
| 03   | `service.ts` 第 87–123 行及 `maintenance.ts` 第 42–80 行分别更新相同的 status、attempt、failure、revision 与附件字节列；`records.ts` 仅共享清理 SQL 片段。                                                                                                                                                                                                          | 一处事务内的结果裁决和持久化规则，两个调用者仍分别取得外部结果与证据；不引入通用 repository 框架。                                  |
| 04   | `scripts/copy-support-fields.mjs` 第 6–34 行与 `field-config.ts` 第 7–46 行维护同一组三个字段身份和 JSON 约束。目前没有已证实的接受语义偏差。                                                                                                                                                                                                                       | 一个无 I/O 的原生 ESM 解析函数；构建继续全量校验后复制且失败中断，运行继续逐文件降级并排序。                                        |

全局守卫：`user_id` 归属核验和固定安全错误不变；`form_version=2` 的六类及 `form_version=3` 的两类均可读取、恢复和推进；匿名投诉的内部归属不外发；unknown 结果先核对，绝不因为 GET 未找到而盲重试；单次 `advance` 最多一个远端 POST；外部 I/O 在数据库事务外；父行锁、attempt UUID、boot ID、revision 的现有竞态防护不减弱；仅远端附件 ID 已在同一事务持久化后释放对应 `bytea`。

## 01：冻结载荷模块

在 `apps/server/src/domains/support/frozen-payload.ts` 建立两个公开函数，类型可以按实现微调，但调用知识须只留在此模块：

```ts
type ValidatedFrozenTask = { payload: FrozenTaskPayload; policy: FrozenPolicy }
function validateStoredTask(row: FrozenTaskColumns, form: FeedbackForm): ValidatedFrozenTask
function matchesFrozenTask(
  remote: ClickUpTask,
  frozen: ValidatedFrozenTask,
  taskId: string,
): boolean
```

`records.ts` 仍负责账号限定查询、表单及附件归一化、摘要、行和附件状态不变量；它把冻结 JSON、表单版本、目标 ID、昵称快照、最终 Markdown、账号 ID 传入 `validateStoredTask`，并将返回值放入 `RecordSet`。`service.ts` 的任务 GET 与 `maintenance.ts` 的远端确认均调用 `matchesFrozenTask`。`metadata.ts` 保留当前配置的 `options`、`preflight`、`taskInput` 和 `frozenTaskInput`；历史核验、Tag 分类与匿名回读逻辑迁出。`FrozenTaskPayload` 类型可由 `metadata.ts` 以 type-only 方式引用，避免运行时循环依赖。现有直接调用 `matchesTask` 的测试改从新模块导入。

`validateStoredTask` 先校验原 JSON 摘要、封闭字段形状、List 数字 ID、`target_list_id` 一致、标题与最终 Markdown、字段顺序／数量／类型／值、UUID 唯一性和 Tag 合法性，再按 `form_version`、`form.kind` 选择策略。v2 保留现有的历史兼容：冻结 List、TaskType、status 和字段 UUID 可以不同于现行 `TARGET`，但期望字段值、类型、顺序、数量、附件和摘要仍严格匹配；旧 v2 Bug 可没有 Type。v2 受控 Tag 集合仅含原操作 Tag 与冻结操作 Tag，不把「反馈」「投诉」解释为 v2 冲突。不能把 v2 历史匹配收窄为当前映射。

v3 策略保留每代已接受的社区目标元组 `{ listId, taskType, status, userFieldId, largeFileFieldId }` 及分类 Tag 语义。当前版本已知元组来自现有 `COMMUNITY_TARGET` 和 `TARGET`，但必须作为不可变历史条目保留；当前配置另外作为新写入条目参与匹配。以后改变目标或字段身份时，先保留旧历史条目并增加新写入条目，再切换新配置。读取旧记录以冻结的 List、TaskType、status 选择合法历史元组，不以当前目标做等值比较。新配置写入的记录也能匹配新条目。同一目标元组若曾轮换用户字段 ID，匿名回读禁止集合是该元组全部已知历史用户字段 ID 的并集；不能从匿名冻结载荷的空 `custom_fields` 猜测身份字段。若缺少已登记的历史条目，记录安全失败并要求先补全可信历史映射，不能放宽为任意目标。

v3 具名记录的用户字段 ID 与对应历史条目一致，用户值必须是冻结昵称和 `user_id`；匿名投诉必须 `nickname_snapshot=''`，其冻结字段中不得出现任何用户字段，其他字段只允许表单实际要求的历史大文件字段。v3 `suggestion`／`complaint` 必须分别具有唯一「反馈」／「投诉」Tag；回读时两个分类 Tag 同时出现、分类错误、已知历史用户字段含非空值或 `hasUnsupportedValue` 为 true，均不能确认成功。历史 profile 的身份集合要用于所有 v3 匿名回读，包括目标 List 漂移后的旧任务。远端其他字段仍按已有规则处理，不把任意无法解析的身份值当作空值。

摘要验证能发现偶然损坏；它不是防止具有数据库写权限者重算摘要的签名。对“修改冻结 JSON 并重算 hash”的场景，v3 还必须由历史目标元组、字段身份、匿名零身份、Tag 分类和表单值交叉校验拒绝非法改写；v2 维持原有冻结映射宽容边界，不伪称能识别所有具有数据库写权限的恶意改写。当前 ClickUp 配置与字段 JSON 只影响新 `prepare` 的 preflight，不阻断已存记录的 GET、advance 或 maintenance。

## 02：浏览器 kind 规则

在 `apps/web/src/pages/Support/feedback/kind-rules.ts` 建立一个以生成 `FeedbackForm['kind']` 为 key、经 `satisfies Record<FeedbackKind, KindRule>` 静态覆盖全部八类的常量。规则至少包含 `area`、`body: 'bug' | 'text'`、`typeField: 'required' | 'optional' | 'none'`、`department`、`action`、`anonymous`，并可承载已有类型卡片的 label、description、icon 与分类文案。对外只暴露 `ruleForKind(kind)`、`kindsForArea(area)`、`belongsToArea(kind, area)`；对未知 kind 不以“非 community 即 development”回退。

现有矩阵固定为：bug 的 Type 必填及 Bug 正文；feature 的 Type 可选及 Domain 可选；asset/request 的 Type 可选，asset 有 Action；content 有 Action；campaign 无额外字段；suggestion 为 community 普通正文；complaint 为 community 普通正文且可匿名。`flow.ts` 在提交、读取和恢复时只用 `belongsToArea` 核验，不改两个 sessionStorage key 和账号 epoch；`FeedbackModal.tsx` 的入口列表、字段显隐、必填标记与匿名开关消费规则；`schema.ts` 的 Zod 跨字段约束消费规则。`toFeedbackForm` 和 `draftFromForm` 保留必要的判别 union 映射和穷尽检查，不用动态展开制造额外字段；服务端仍最终按 Contract 和 `normalizePrepare` 校验。表单状态继续由 RHF 管理。

## 03：事务内状态裁决

在 01 的冻结语义稳定后，于 `apps/server/src/domains/support/lifecycle.ts` 建立 support 专用持久状态接口：

```ts
type AttemptGuard =
  | { source: 'advance'; attemptId: string; bootId: string }
  | { source: 'maintenance'; attemptId: string; expectedRevision: number }
  | { source: 'reconcile'; attemptId: string; reason: 'expired'; currentTime: number }
  | { source: 'reconcile'; attemptId: string; reason: 'old_boot'; currentBootId: string }
type Outcome =
  | { kind: 'task_id_saved'; taskId: string }
  | { kind: 'task_confirmed'; taskId: string; resolution?: MaintenanceResolution }
  | {
      kind: 'attachment_uploaded'
      attachmentId: string
      remoteId: string
      resolution?: MaintenanceResolution
    }
  | { kind: 'definite_failure'; code: FailureCode; retryNotBefore: number | null }
  | { kind: 'unknown' }
  | {
      kind: 'confirmed_not_written'
      evidence: NotWrittenEvidence
      resolution: MaintenanceResolution
    }
async function persistOutcome(
  tx: SqlExecutor,
  locked: RecordSet,
  guard: AttemptGuard,
  outcome: Outcome,
  at: number,
): Promise<boolean>
```

`persistOutcome` 在调用者已持有父行 `FOR UPDATE` 的短事务中核验 guard、attempt kind、附件 ID、当前状态及结果适用性，原子更新 submission／attachment，并只在真正应用时增加 revision。`advance` 的 guard 同时匹配 attempt ID、boot ID 和运行中状态；晚到结果返回 false，不覆盖维护结论。`reconcile` 的 expired guard 还须核验同一个 attempt 的期限不晚于 `currentTime`，old_boot guard 须核验 attempt 所属 boot ID 不等于 `currentBootId`；只允许从 creating/uploading 的在途状态转 unknown。维护启动先用 expired guard 持久化过期 attempt 为 `verification_required`，重新读取 revision 后才用 maintenance guard 提交人工结论。maintenance 结果 guard 匹配 attempt ID、预读 revision 与 `verification_required`，不匹配则抛现有状态冲突。`task_id_saved` 只保存远端 ID、保留创建 attempt，以便事务外 GET 核对；`task_confirmed` 在有有效远端证据后清 attempt/failure，按附件是否全部上传设为 uploading/completed。`attachment_uploaded` 在同一事务写远端附件 ID、`status='uploaded'`、`bytes=NULL`，然后计算父状态与清理 attempt/failure。`definite_failure` 只接纳远端明确拒绝：create_task 要求尚未保存 task ID；upload_attachment 允许已有 task ID，但对应附件尚未保存 remote ID，转为 failed 时保留该附件字节以供后续显式 retry。不确定结果一律 unknown，保留 attempt 与字节并置 `verification_required`；`confirmed_not_written` 仅接受维护入口已验证的有限证据，置明确失败后才允许后续显式 retry。维护路径的 `maintenance_resolution_json` 只在受控维护结果中写入。

`service.ts` 仍拥有并发上限、expectedRevision 重放、认领、ClickUp POST 和只读 GET；`maintenance.ts` 仍拥有确认参数、证据校验、远端附件字节 SHA-256 核验及只读 inspect。两者不再直接写入结果状态列。`records.ts` 保留读取与快照，`markUnknown`、`clearAttempt`、`clearFailure` 的写入实现移入生命周期模块；过期 attempt、启动恢复和维护启动转 unknown 也调用同一裁决。认领时现有父锁、字节核验、attempt UUID/boot ID 与单次 `advance` 一次 POST 的顺序不变。事务外不持有行锁进行任何 ClickUp 调用。任务 GET 失败、超时、5xx、无法解析的成功响应或 DB 提交失败均不能推导“未写入”；保持或转入核对路径，绝不追加一次创建或上传 POST。

## 04：字段定义纯解析

增加 `scripts/support-field-definition.mjs` 与相邻的 `scripts/support-field-definition.d.mts`，导出三个字段 ID／期望类型的唯一清单和 `parseSupportField(input, id, expectedType)`。纯函数不读文件、不复制、不访问环境，返回当前运行时所需的归一化对象：`required` 归一化为 boolean，dropdown options 检查 1–500 项、UUID、名称、颜色、`Number(orderindex)` 的安全整数范围 0–500、ID 和顺序唯一性，并按顺序排序；text 的 options 保持现行空列表。无效值抛固定内部错误，不含原始 JSON 或秘密。

`scripts/copy-support-fields.mjs` 只负责逐文件读取 JSON、在创建目标目录前用同一函数全量校验，再复制原字节；任何一个失败时终止构建且不创建目标目录。`apps/server/src/domains/support/field-config.ts` 从相同 `.mjs` 导入字段清单与解析函数，保留源/`dist` 文件路径选择、逐文件捕获降级及面向生成 Client 的类型适配。Server 的 `tsconfig.json` 仍以 `src` 为 `rootDir`；从源文件和编译后的 `dist/domains/support` 到仓库根 `scripts/` 的相对层级相同，声明文件只供 TypeScript 检查，不进入运行时。构建脚本在 `tsc` 前可由 Node 直接加载这个 `.mjs`；不新增包或构建期 TypeScript 运行器。交付前须执行真实 Server build，并从编译后的 `field-config.js` 触发一次加载烟测，确认依赖路径和发布布局均有效。

## 文件归属与落地顺序

| 阶段 | 主要文件                                                                                                                                                                                                              | 依赖与交接                                                             |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 01   | 新增 `apps/server/src/domains/support/frozen-payload.ts`；调整同目录 `records.ts`、`metadata.ts`、`service.ts`、`maintenance.ts`；更新 `tests/support/state-machine.test.ts`、`community.test.ts`、`metadata.test.ts` | 先固定历史 v2/v3 策略，再让正常和维护读路径都消费同一验证结果。        |
| 03   | 新增 `apps/server/src/domains/support/lifecycle.ts`；调整 `records.ts`、`service.ts`、`maintenance.ts`；更新 `tests/support/state-machine.test.ts`、`result-persistence.test.ts`、`community.test.ts`                 | 依赖 01 的 `RecordSet`／远端等价语义；由一个实现者串行修改重叠文件。   |
| 02   | 新增 `apps/web/src/pages/Support/feedback/kind-rules.ts`；调整 `feedbackFormConfig.ts`、`flow.ts`、`schema.ts`、`FeedbackModal.tsx` 与对应测试                                                                        | 与 01/03 行为独立；共享工作树写入与集成检查串行。                      |
| 04   | 新增 `scripts/support-field-definition.mjs`、`.d.mts`；调整 `scripts/copy-support-fields.mjs`、`apps/server/src/domains/support/field-config.ts` 与 `tests/support/field-copy.test.ts`、`metadata.test.ts`            | 与其他阶段行为独立；在 Server build 中确认原生 `.mjs` 与编译产物加载。 |

若多个阶段均涉及 `tests/support/metadata.test.ts` 或 Server 构建，不由多个实现者同时编辑同一文件。每阶段完成后做定向验证，最终稳定候选统一交独立测试与代码审查；不重写已存记录或附件，不执行真实 ClickUp 写入。

## 回归验证矩阵

| 场景           | 验证方法与应得结果                                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2 历史映射    | Testcontainers 注入旧 List、TaskType、status、用户字段 UUID、旧操作 Tag；GET、advance、维护仍用冻结值。旧 Bug 空 Type 可继续；附加社区 Tag 不改变 v2 判定。                                                                        |
| v3 配置漂移    | 在测试中先按已登记的旧 profile 冻结并持久化 community 记录，再将当前新写入配置切换为不同 List/TaskType/status/字段 ID；旧 GET、advance、维护按旧元组继续，新记录按新元组可读。测试不通过修改历史策略来放行旧记录。                 |
| v3 匿名与篡改  | 匿名 payload 无用户字段且昵称快照为空；重算 hash 后注入用户字段、错字段 ID、错 Tag、任意未登记目标均被读取拒绝。远端在旧或新用户字段 ID 返回非空或不可解析复杂值时进入核对；具名身份字段仍按冻结值精确核对。                       |
| 远端未知与权限 | 不同账号 GET/lookup 不可读取记录；超时/断线/5xx/无法核对正文或身份进入 `verification_required`，不重复 POST；每次 advance 至多一次 POST。                                                                                          |
| 状态等价和竞态 | 正常任务／附件成功与人工回填产生相同业务状态、revision、attempt/failure 清理；附件远端 ID 与 `bytes=NULL` 同事务提交。并发抢占、过期 attempt、旧 boot、旧 revision、维护后晚到结果不能覆盖已裁决状态；事务提交失败保留可核对事实。 |
| kind 全量矩阵  | 八类逐一核对 area、入口、字段显隐、必填、冻结 form、草稿恢复；错误 area 拒绝提交及恢复，未知 kind 不回退；anonymous 仅 complaint。运行 `flow.test.ts`、`schema.test.ts`、`FeedbackModal.test.tsx`。                                |
| 字段定义一致性 | 同一组有效/无效 JSON 在构建与运行两侧使用同一个纯解析结果；重复 ID/顺序、负顺序、越界、错误类型均拒绝。构建失败不创建目标目录；运行单文件失败仅降级该字段。执行原生 Node import、Server typecheck/build 及编译后加载烟测。         |

按仓库 `TESTING.md`（若存在）执行测试；至少运行定向 support/Web 测试、`pnpm typecheck`、`pnpm test`、`pnpm build`。无 HTTP operation 或 schema 变更，因此不触发重新生成 Client 或 Contract test 更新；若实现中发现确需改变 Contract，停止该部分并先另行评审 Contract。自动测试、浏览器交互与真实 ClickUp/部署验收分别报告。

## 风险、回滚和待评审点

| 风险                                                               | 缓解与检测                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 旧 v3 目标变更时遗失历史 profile                                   | 旧条目只追加，不随当前配置覆盖；配置漂移测试先冻结旧记录再切换当前配置，并覆盖 GET、advance、维护。 |
| 匿名记录没有用户字段，无法单靠 frozen payload 知道须禁用的身份字段 | 历史 profile 保存用户字段身份并使用同目标代际 ID 并集；远端非空或不可解析值拒绝确认为成功。         |
| 状态收敛改变 unknown 或晚到结果语义                                | Testcontainers 对正常/维护路径同案比较、并发和失败注入；所有外部 I/O 仍在短事务外。                 |
| 编译后 `.mjs` 路径不成立                                           | 在实际 Server build 后由 Node 加载编译产物；保留根 `scripts/` 的运行布局。                          |

回滚仅回滚应用代码；数据库结构和冻结 JSON 均不变，不能丢弃 v3 读取支持或清理历史数据。若某阶段回归未通过，停止该阶段后续落地，保留上一已验证阶段；外部写入不用于本地回归。当前没有新表职责、数据规则或 HTTP Contract 决策，因此不需新 ADR、迁移或 OpenAPI 修改。设计后的稳定知识是否归档 `.ai/` 按 `AGENTS.md` 在实现完成后另行处理。
