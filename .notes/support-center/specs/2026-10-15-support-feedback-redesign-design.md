# 支持中心六类反馈重构设计

> 2026-10-16：正文输入与内容规则由 `.notes/support-center/specs/2026-10-16-feedback-markdown-design.md` 增量更新。Tiptap GFM 已接入；本设计中暂用纯文本的选择仅描述当时范围。此次保留已有 v2/v3 记录，不重新执行早期清理迁移。

- 状态：已确认；用户授权默认同意后续细化，完成 Spec / RFC 后直接开发。
- 日期：2026-10-15。
- 模块根目录：`.notes/support-center/`。
- 需求来源：`.notes/support-center/detial.md` 与本次会话确认。
- 取代范围：`.notes/support-center/specs/2026-10-14-support-feedback-design.md` 中双入口、Request/Bug 表单及 Category、单个大文件链接设计。旧文档保留为历史依据。

## 1. 决策摘要

支持首页移除独立 Bug 反馈入口，统一从「功能和需求」打开 Modal，先选六种类型，再填写对应表单。采用固定业务流程、JSON 字段渲染、通用文件选择组件的方案。正文保持普通多行文本，将来另行接入 Tiptap。

项目尚未上线，本次直接破坏性更新，只支持最新 Contract、表单与记录结构，不实现旧记录读取、迁移转换、双写或兼容接口。旧反馈记录及其暂存附件按显式开发迁移清理，不重置账号或其他业务数据；不执行任何远端任务删除。

## 2. 已核对的现状

当前 `apps/web/src/pages/Support/SupportHome.tsx` 提供功能和需求、Bug 反馈、投诉和建议三张卡片；前两项分别打开 Request / Bug 表单。`apps/web/src/pages/Support/feedback/` 已有 RHF/Zod 表单、上传和恢复逻辑。`apps/server/src/domains/support/` 已有不可变提交、单步外部推进和结果核对。

现有 `metadata.ts` 将旧 Category 及 Bug「修复」作为前置条件，当前需求文件对应的字段快照已不含该字段。本次同时移除界面与服务端依赖。

本次只读 ClickUp 核对确认：Bug=1001、Request=1005、Content=1007、Campaign=1008、Asset=1009；另有 Resource=1006，但本次资源使用 Asset。标准 Task 使用 `custom_item_id=0`，依据 ClickUp 官方 Create Task 文档。当前目标 Space 未找到「新增」「修改」「删除」Tag；准备与真实验收必须覆盖此条件，不能伪报已可用。

## 3. 范围

本次实现统一入口、六类表单、`ClickUpFieldInput`、`FileUploader`、公开字段 JSON 片段、服务端映射、Contract、记录结构和完整的提交恢复流程。

投诉和建议仍保留现有预留 Modal。常见错误、联系人、ClickUp 开发进度视图保持现有职责。本次不增加富文本依赖、反馈管理后台、历史列表、双向同步、后台重投队列或部署。

## 4. 入口与交互

首页「反馈与建议」保留「功能和需求」「投诉和建议」两张卡片，响应式调整排版。功能和需求卡片说明须覆盖问题反馈和其他类型。

统一 Modal 的初始页展示以下类型及说明：

| 类型       | 说明                                       |
| ---------- | ------------------------------------------ |
| Bug 反馈   | 描述遇到的问题与复现过程，帮助定位和修复。 |
| 功能       | 提出新功能或现有功能的改进想法。           |
| 资源       | 提交车辆、角色、衣服等资源的新增或调整。   |
| 需求       | 描述你希望解决的具体问题或使用需要。       |
| 文档和内容 | 补充、修改或删除文档与内容。               |
| 宣传与活动 | 提交宣传想法、活动方案或协作需要。         |

类型卡片使用可聚焦按钮，点击直接进入表单，提供「返回选择类型」。桌面使用两列卡片，窄屏单列。表单区沿用约 48rem 宽的 ExUI Modal，内容滚动、底部操作持续可见，窄屏适配可用视口。关闭后焦点回到触发按钮；键盘和减少动态效果设置均可使用。

未提交草稿在当前 Modal 内按类型分别保留；切换类型时不把另一类型字段或附件混入提交。关闭有内容的 Modal 须确认放弃；真正关闭后清空全部草稿。开始提交后锁定类型，重新打开优先恢复原记录。草稿正文和 File 不持久化到浏览器存储。

## 5. 字段矩阵

| 业务类型 / kind         | ClickUp TaskType | 专属表单                                                                       |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------ |
| Bug 反馈 / `bug`        | Bug / 1001       | 标题、问题分类（Type，必填）、问题描述、复现步骤、预期结果、实际结果、发生频率 |
| 功能 / `feature`        | Task / 0         | 标题、功能分类（Type）、部门（Domain）、内容                                   |
| 资源 / `asset`          | Asset / 1009     | 标题、资源类型（Type）、操作、内容                                             |
| 需求 / `request`        | Request / 1005   | 标题、需求分类（Type）、内容                                                   |
| 文档和内容 / `content`  | Content / 1007   | 标题、操作、内容                                                               |
| 宣传与活动 / `campaign` | Campaign / 1008  | 标题、内容                                                                     |

所有类型提供附件选择和可选的大文件补充信息。标题和正文必填；新 Bug 的问题分类和问题描述必填，其余详情及频率选填。问题分类默认不选择，须选择一个可用选项，不提供清空项。其他类型的 Type 与 Domain 选填、默认不选择、允许清空；Bug 完全没有 Domain。所有新任务均不填写 Category。

四类 Type 控件分别使用「问题分类」「功能分类」「资源类型」「需求分类」，各自提供说明和明确的选择占位提示。新 Bug 必填规则仅约束新提交；已接收的 v2 表单快照仍允许原来的 null 分类，恢复、读取及继续推进保留原冻结载荷，不补填或重新解释。

资源、文档和内容的「操作」必选、无默认值，提供新增、修改、删除、其他。服务端分别映射为同名 Tag；其他不发送操作 Tag。其余四类不接受操作值或操作 Tag。Tag 是任务标签，不能错误写入已移除的 Category 自定义字段。

## 6. 输入规则

| 输入           | 规则                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| 标题           | trim 后 1–200 个 Unicode 码点，不含换行或控制字符。                                   |
| 普通正文       | 有实际文字，原始文本及转义后 Markdown 各不超过 64 KiB UTF-8。                         |
| Bug 文本       | 各正文项最多 16 KiB UTF-8，组合正文最多 64 KiB；按现有小标题顺序生成。                |
| 大文件补充信息 | 普通多行文本，允许多个链接、提取码、说明，最多 16 KiB UTF-8；不再要求单个 HTTPS URL。 |
| 选项           | 发送 ClickUp option ID；服务端核验对应字段、配置和任务类型适用范围。                  |
| 附件           | 0–5 个，每个 1 字节至 20 MiB，总计不超过 100 MiB，不限制类型。                        |

大文件补充 Switch 默认关闭。关闭时不提交该字段；开关反复切换可保留当前内存草稿文本。开启且内容为空时仍视为未提供，不写空字符串。用户文字中的 Markdown / HTML 均按普通文字处理，保留换行。将来接入 Tiptap 时另行变更正文 Contract 和格式验收，不预先接入编辑器依赖。

## 7. 通用组件与字段 JSON

`ClickUpFieldInput` 放在 `packages/components/`，接收单字段 JSON 和所属 RHF 字段绑定。`drop_down` 渲染 ExUI 下拉、`short_text` 渲染单行输入、`text` 渲染多行输入；不接受 button 等未实现类型并静默降级。字段错误、标签关联、禁用和恢复均跟随表单。业务可提供中文标签覆盖；JSON 保留 ClickUp 原始字段名和选项结构。

`FileUploader` 放在 `packages/components/`，支持最大数量、单文件大小、允许 MIME / 扩展名、总大小预算，以及是否启用大文件补充信息。组件负责选择、追加、移除、展示大小与错误；不访问 API、不管理提交 ID、不直接上传。通过所属 RHF/Zod 管理字段；文件类型限制除 input accept 外还必须在选择后校验。文件列表和补充信息可分别禁用，以适应恢复时重新选择缺失文件。

从 `.notes/support-center/clickup-fields-probe.json` 提取三个完整单字段对象，保存到 `apps/web/public/clickups/fields/`，文件名为字段 UUID：

| 字段         | UUID                                   |
| ------------ | -------------------------------------- |
| Type         | `4c3befc0-5146-43a2-8610-86efe4e8124a` |
| Domain       | `9b3d2027-2162-42e2-81b9-d907592cdb5b` |
| 额外文件链接 | `4f7eb8a3-5de7-4f3b-87bb-8be5dc2d573f` |

只公开此三类字段结构，不公开 token、任务正文、用户值、AI prompt 或自动化配置。其余用户归属字段由服务端维护。

JSON 是维护来源；构建校验并为 Server 打包同一份数据。前端通过既有 options operation 获得服务端校验后的字段定义和各类型可用状态，不额外绕过共享 Client 建立配置 API。替换已有字段 JSON 后重新构建并重启生效。支持修改名称、颜色、顺序、选项；改变字段身份、类型或表单业务关系仍须调整受控映射。

服务端同时检查实际 ClickUp 字段、option ID 和 `applied_objects`，失效只影响依赖该字段或任务类型的反馈类型；公共凭据或需求桶不可用才影响全部类型。JSON 更新不重解释已经 prepare 的记录。

## 8. 提交与恢复

继续经现有六个 support operation 执行：保存表单及附件清单、逐文件接收、创建 ClickUp 任务、逐文件同步、查询和恢复。每次 advance 至多一个外部写请求。服务端负责 TaskType、初始「新增」状态、操作 Tag、用户昵称和账号 ID。

prepare 固定最新表单、正文和外部创建载荷快照，包括目标 TaskType、已选择的字段 ID / option ID / 值、Tag。推进和回读按该快照执行，不随配置更新改变。配置已失效时保留原记录，提示核对，不自动替换选项。

任务创建时一并传入 Tag，不增加普通提交中的补 Tag 外部步骤。任务回读新增 Tag 核对；任务及所有附件均已持久化成功才 completed。失败可继续原任务；超时、断线、5xx 或无法确定结果进入 `verification_required`，不能盲目创建第二个任务。保留 revision、attempt、boot fencing、附件摘要和认证归属核验。

使用新的浏览器恢复命名空间，仅保存提交 key / ID；不读取旧 v1 指针。会话切换停止后续推进。正文和文件不进入 sessionStorage。

## 9. 破坏性更新与数据边界

只支持新格式记录和最新 Contract；不提供旧 schema 分支、Category 回填、单链接兼容或旧 Request 到 feature 的转换。旧反馈记录由显式开发迁移清理，先删除 `support_feedback_attachments`，再删除 `support_feedback_submissions`，随后更新约束与新快照结构。使用增量迁移，不改写可能已应用的 0003 migration，不重置整库。

迁移前停止旧支持写入并等待在途步骤完成；存在不确定远端结果时先记录并核对原任务，避免清理本地编号后重复提交。已创建的 ClickUp 任务和远端附件不删除、不重新创建；本地旧记录清理不可通过代码回滚恢复。新代码和新结构一起启用，旧页面刷新后按新 Contract 使用。

本设计授权编写破坏性迁移，不把普通启动变成自动迁移。执行开发库迁移必须使用显式命令并核对 `exre` 身份。账号、头像、通知、其他模块数据和 Outline 均不在清理范围内。

## 10. 验证与完成标准

- UI：两张入口、六类选择、说明、字段矩阵、Bug 无部门、操作必选、草稿隔离、关闭确认、恢复时类型锁定。
- 组件：三类 JSON 控件、非法配置可见错误、选项 ID、清空、禁用、字段错误关联；上传数量 / 单个 / 总量 / 类型限制和大文件 Switch。
- 服务端和 Contract：真实 Fastify 响应及原 handler 输出、六类映射、无 Category、无越权字段、标准 Task=0、操作 Tag 回读、补充信息多行原样语义。
- 恢复：丢失响应、重复 prepare、过期 revision、配置变化、未知远端结果、附件重选与摘要不匹配，不重复外部写入。
- 迁移：旧反馈清理范围与新约束；保留其他模块数据；旧载荷拒绝，旧恢复指针失效。
- 最终命令：`pnpm api:lint`、`pnpm api:generate`、`pnpm typecheck`、`pnpm test`、`pnpm build`，依赖产物构建与 typecheck 顺序执行。数据库测试仅使用 Testcontainers。
- 浏览器：明暗主题、桌面和窄屏、六类表单、长正文和长文件名、键盘焦点、滚动和关闭。
- 真实 ClickUp：分别核对六类 TaskType、字段、Tag、大文件补充信息和附件；本地测试不能替代外部验收。

## 11. 替代方案与风险

未采用完整 JSON 表单引擎：当前只需六种明确流程，引擎会引入额外布局、条件与规则语言。未采用六套独立表单：重复上传、字段和恢复逻辑容易漂移。

主要风险是远端配置与 JSON 不一致、Tag 尚未准备、更新时存在在途任务、错误地向不适用的 TaskType 写字段。分别通过配置预检与按类型降级、显式 Tag 准备、停写并核对、创建后快照回读检测。Tag 准备和真实写入结果尚未验收；此事实不是本地开发阻塞。

## 12. 证据与后续交接

源码依据：`api/paths/support.yaml`、`api/schemas/support.yaml`、`apps/server/src/domains/support/`、`apps/server/src/modules/clickup/service.ts`、`apps/server/drizzle/0003_support_feedback.sql`、`apps/web/src/pages/Support/feedback/`、`packages/feedback-content/src/index.ts`。

ClickUp 官方资料：[Create Task](https://developer.clickup.com/reference/createtask)、[Custom task types](https://developer.clickup.com/docs/custom-task-types)、[Get Space Tags](https://developer.clickup.com/reference/getspacetags)。Task=0、创建载荷 tags 和字段适用范围依据官方接口；自定义任务类型 ID 与 Tag 缺失来自本次只读 API 核对。

用户已授权继续写完 RFC 并直接开发，无需额外产品决策。下一步按 `technical-design-doc-creator` 将本 Spec 交接到 `.notes/support-center/rfcs/`，随后使用 `create-team dev` 实现。设计阶段不修改 `.ai/` 长期结论；实现验证后按实际行为维护。
