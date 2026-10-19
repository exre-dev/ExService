# 自研 Docs Server：Monica 自主任务基线

日期：2026-10-16。状态：需求已确认，允许创建和拆分任务；完整架构尚待设计、独立审查及用户确认。本文件不是已获批技术设计，也不授权绕过架构审批直接实现。

## 目标与已确认范围

为 ExWebsite 建设自有 Docs Server，复用现有唯一 Fastify Server 和独立 PostgreSQL `exre`。本期仅包括 Server、HTTP Contract、必要的生成式 Client 产物、数据库迁移、测试和工程文档，不开发前端，不设置 UI Demo 或浏览器布局验收。

- 只建设 Docs，不建设 Git/MDX 官方 Wiki；不迁移旧 Outline 内容，也不删除旧数据。
- 空间平级，每篇文档只归属一个空间。
- 树节点只有文档。每篇文档可以同时有正文和子文档，正文允许为空，不另外引入文件夹类型。
- 支持同级重排、更换父文档、跨空间移动，全部子文档整体跟随，文档身份及已有引用保持稳定。
- 文档编辑确定为 Tiptap；Server 保存、返回并校验其完整富文本 JSON，不以 Markdown/MDX 替代正文，不导入浏览器编辑器。
- 公开读取正常内容；所有已登录用户均可管理全部空间和文档。本期不增加作者独占、成员、角色或 ACL 规则。
- 保存成功即公开生效；不做草稿、发布和审核流程，不做多人实时共同编辑。
- 使用版本检查避免旧请求覆盖新内容；当前版本计数不等于历史记录，本期不建立历史快照或回滚系统。
- 文档连同子树软删除并可恢复；本期不做永久删除或自动清理。
- 搜索、模板、AI、附件和文档级评论按 B 落地：本期建立所需业务表及正式 HTTP Contract，具体业务逻辑后续实现。不得把“声明了接口”报告为功能可用。
- 评论只关联整篇文档，不关联选区、段落、文字范围或行内锚点。
- 架构优先采用成熟开源方案，简单合理；不为未来可能性提前建立通用插件平台或分布式基础设施。

## 当前工程与材料

- 使用 Ex Website 项目的“ExWebsite 本地开发仓库”资源，核对真正工程根目录、README、package.json 与 Git remote。当前根仓库 origin 是 `https://github.com/caep-dev/ExService.git`；项目的旧 Git resource 记录可能过时。不要进入未跟踪的嵌套 `ExWebsite/` 或 `apps/outline/` 作为目标工程。
- Outline 已退休。Monica 项目提示词中“独立 Outline 现役服务”的旧说明不适用于本任务。以当前用户范围、工程 `AGENTS.md` 和 `.ai/` 为准，不恢复旧服务、数据库、代理或前端深链接。
- 本次研究在 `.notes/docs-service/specs/2026-10-16-docs-service-research.md`，已作为父任务附件提供；本基线也附在父任务，隔离工作目录须读取附件，不能假设未提交材料存在于新 checkout。
- 先读 `.ai/README.md`、`.ai/CONTEXT.md`、`.ai/architectures/server/request-lifecycle.md`、`.ai/architectures/server/authentication-lifecycle.md`、`.ai/architectures/api/contract-layout.md`、`.ai/databases/data-model.md` 与 `.ai/architectures/monica-team/workflow.md`。
- Tiptap 边界见 `.ai/knowledge/components/tiptap-content-boundaries.md`；存储复用前核对 `api/paths/storage.yaml`、`api/schemas/storage.yaml` 和 `.ai/knowledge/storage/lifecycle-traps.md`。
- 当前工作区有用户未提交、未跟踪内容；保留现有改动，任务隔离遵守项目规则。共享目录、Git 索引与运行资源的修改串行。

## 架构调研与建议方向

关注度及源码证据已在研究附件中记录，Stars 只是关注度，不能冒称质量评分。

| 参考                                                                    | 借鉴点                                                        | 本项目限制                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| [Docmost](https://github.com/docmost/docmost)                           | 空间、父子关系、JSON 正文、独立模板/附件/评论表、事务内树移动 | 不复制实时协作、企业权限、聊天历史或商业模块。    |
| [BookStack](https://www.bookstackapp.com/docs/user/organising-content/) | 内容移动、整数顺序与同级重排                                  | 不套用书籍/章节的固定层级。                       |
| [Fumadocs](https://www.fumadocs.dev/docs/headless/page-tree)            | 轻量导航树与正文分离                                          | 本期没有前端集成，不把阅读导航库当作可写 Server。 |

优先评估一个 `apps/server/src/domains/docs/` 领域，内部按 service、数据库查询、内容校验和 `api/` 接入组织。先比较空间、文档、模板、附件、评论五张表；搜索复用文档文本投影，AI 可以先采用无状态建议接口。表数和具体排序策略是候选，不是已确认决定；如果需要偏离，给出与当前需求直接相关的证据。

不默认增加独立服务、队列、Redis、Elasticsearch、向量数据库、事件总线、AI 任务表、通用工作流或通用仓储框架。优先复用已有认证、数据库事务、存储和统一错误出口。

## 架构任务必须定稿的边界

1. 空间创建、改名、描述与删除规则。优先比较只允许删除真正空空间，防止误删正常或回收内容；用户尚未单独确认该细节，随完整设计审批。
2. 树数据约束、排序策略、稳定文档 ID、空间/父节点一致性、递归查询及树元数据分页。
3. 同级重排、换父文档、跨空间移动的事务与加锁顺序，特别是并发互移、删除和移动竞争、已回收后代与跨空间移动。
4. 删除分组、回收站读取、恢复范围与父节点不可用时的处理。不得因恢复父文档而误恢复之前单独删除的子文档；公开 API 不返回回收内容。
5. Tiptap JSON schema、未知节点/属性的处理、完整富文本节点兼容、服务端校验与有限预算。未知内容应明确拒绝，不能静默裁剪后保存成功。
6. 内容与结构更新的版本检查，以及冲突、不存在、无效移动、未登录和超限的统一错误。
7. B 的最小预留表、请求/响应 schema、operationId、认证要求与未实现响应。候选为统一 501 `DOCS_FEATURE_NOT_IMPLEMENTED` 和 `no-store`；需同时满足 Contract/handler 双向覆盖，不返回模拟成功。
8. 模板关联范围；附件的文档归属与既有存储能力的真实接缝；文档级评论明确禁止选区/段落字段；AI 不直接绕过普通保存验证；未来搜索过滤回收内容，不复制上游英语分词假装中文搜索已验收。
9. 迁移顺序、旧完整 schema 升级路径、结构检查、回退保留数据和自动测试。

Architect 使用 `brainstorming --handoff --module=docs-service`，基于已确认范围自主补齐实现选择，只将确实不能推断的重大产品问题交 Lead。设计在 `.notes/docs-service/specs/`，按需要使用 `.notes/docs-service/rfcs/`，不例行重复写多份 PRD/RFC。

## 执行阶段

| Stage | 子任务            | 责任角色与输出                                                                                                                  |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 架构定稿与审批    | Architect 完成含成熟源码依据的 Server 设计；Reviewer 独立审查；Lead 提交具体版本给用户确认。                                    |
| 2     | 核心 Server       | Engineer 实现空间、文档、Tiptap JSON、树查询/重排/移动、版本冲突、软删除/恢复及所属测试。                                       |
| 3     | 扩展表与 Contract | Engineer 实现 B 要求的最小预留表、正式 schema/operation 和明确未实现响应，复用 Stage 2 约束。                                   |
| 4     | 独立代码评审      | Reviewer 检查同一候选，阻塞问题交原作者修复，新候选刷新受影响审查证据。                                                         |
| 5     | 独立验收          | Tester 验证真实 HTTP、原始 handler 与隔离 PostgreSQL；失败交原作者；通过后 Engineer 同步稳定知识与授权内交付，Lead 验收父任务。 |

Stages 是先后关系，不是自动批准。Stage 1 在获得用户明确架构批准前不得通过；Stage 2/3 不得开始生产实现。Stage 4/5 不能由实现作者自行验收。普通修复、复审和重测自主推进；重大设计变化才重新请求用户确认。

父任务由 Exre Lead 持有；后续子任务先排队，不提前唤醒执行者。每次只路由一位当前接手者，核对活动任务并去重；按项目规则注册实际任务终态唤醒兜底。

## 验收与交付

- 核心功能真实可用，B 预留功能明确返回未实现，两类状态分别报告。
- `api/openapi.yaml` 是唯一 Contract。先改 Contract，运行 `pnpm api:lint`、`pnpm api:generate`，不手改生成物。
- 真实 Fastify HTTP 与原始 handler 输出分别符合 Contract；所有 operation 双向覆盖、认证边界与错误 envelope 可验证。
- PostgreSQL 测试使用 Testcontainers 和逐例 schema，Docker 缺失明确失败，不连接开发库。覆盖竞争、原子回滚、跨空间整树一致性、回收恢复、旧完整 migration 升级及既有数据保留。
- 本期有 TESTING.md 时按它执行；否则按现有测试约定。完成后运行适用的 `pnpm api:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`，共享生成物的命令串行。
- 已声明可支持的 Tiptap JSON 大小与 Docs 路由 wire 预算一致；当前全局 4 MiB 与编辑器 8 MiB 门禁的差异需显式解决，不能静默失败。
- 记录 PASS、FAIL、BLOCKED、NOT_EXECUTED；本期不要求前端 Demo 或浏览器布局证据，不部署上线，不操作真实旧 Outline 数据。
- 设计、代码、测试按具体候选记录；通过团队审查不等于用户架构批准。Git 交付遵循已有授权和 CONTRIBUTING.md，本任务不扩大推送、合并或环境变更权限。
- 完成后用 codebase-documenter 将已验证知识按工程归属更新到 `.ai/`，不把执行日志、任务 IDs 或工作区状态写入持久知识。
