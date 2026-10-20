# 自研 Docs：研究输入与已确认边界

日期：2026-10-16。状态：调研与需求访谈中，尚未形成获批设计，也未派发 Monica 实现任务。

## 已明确的需求

- 建设自己的 Docs 服务，Outline 已退役。
- 文档归属于空间；文档可以包含子文档，形成文档树。
- 支持调整顺序和修改内容。
- 首期只建设 Docs，不同时建设基于 Git/MDX 的官方 Wiki。
- 所有内容公开阅读；编辑要求本站登录。首期不建设完整权限系统。
- 文档编辑器确定使用 Tiptap，优先复用现有共享编辑能力。
- 本期仅开发 Server 能力：HTTP Contract、Docs 业务、PostgreSQL、按工程要求生成的 Client 产物及自动测试；不开发前端页面、Tiptap 编辑界面、侧边栏、拖拽或菜单。
- Tiptap JSON 是正文读写的数据来源。本期需设计服务端校验，不向 Server 导入浏览器专属 Editor 或 Viewer。
- 首期从空空间开始，不导入旧 Outline 内容，也不删除旧数据。
- 不需要实时共同编辑；首期采用普通编辑保存并检测版本冲突，避免旧内容覆盖新内容。
- 已登录用户可管理全部空间和文档；保存成功后立即公开生效，不做草稿、发布或审核流程。
- 文档与全部后代一起软删除，提供恢复能力；首期不提供永久删除或自动清理。
- 需要预留搜索、模板、AI、附件和文档级评论，并在本期创建相关业务表及正式 HTTP Contract，具体业务逻辑后续实现。评论只关联整篇文档，不做内容选区、段落或行内批注。
- 历史记录暂不纳入范围；保存冲突检测仍保留，不能把当前版本计数误当成历史版本功能。
- 研究 Fumadocs 及其他受到较多关注的开源项目，形成可交给 Monica 的自主任务。

## 当前工程事实

- `apps/web/src/App.tsx` 只登记 `/docs` 建设中页面；旧深路径继续使用既有 404。新 Docs 的路由范围需要在新设计中明确，不能恢复 Outline 代理或旧文档服务。
- `apps/server/` 是唯一 Website Fastify Server，`api/openapi.yaml` 是唯一 HTTP Contract；新增 Docs API 必须纳入已有 Contract、operation 注册、生成式 Client 和测试流程。
- 业务数据库是独立 PostgreSQL `exre`。模型变更前应更新并评审 `.ai/databases/data-model.md`，不能在服务启动时隐式迁移。
- `packages/components/` 已提供完整富文本 Tiptap Editor、Viewer 和统一 Hook。其内容事实来源为 Tiptap JSON，具体接入与内容替换边界见 `.ai/knowledge/components/tiptap-content-boundaries.md`。
- `apps/web/` 已使用 `fumadocs-core@16.17.1`、`fumadocs-mdx@15.4.7`，当前内容链路服务于 About 等仓库内容。它不构成已完成的在线 Docs 服务；现有内容边界见 `.ai/architectures/web/content-rendering.md`。
- `.notes/todos/docs-handoff.md` 是已有、未提交的设计输入，提出 Docs/Wiki 双系统和暂不实时协作。它包含尚未核准的范围及 Next.js、Fumadocs UI 等技术建议，不能覆盖当前工程架构，也不代表本次全部采纳。
- Monica 的 Ex Website 项目和 Exre Lead 已核对。当前项目提示词仍含 Outline 独立服务的旧描述，与现行工程规则冲突；后续任务必须明确 Outline 已退役，以现行 `AGENTS.md` 和 `.ai/` 为准。修订项目级提示词应限于已确认的退休事实。
- 项目协作、架构审批、交互 Demo、独立评审和验收路径沿用 `.ai/architectures/monica-team/workflow.md`。本阶段不部署上线。

## 开源参考

关注度在本次调研时通过 GitHub 官方 API 读取。Stars 仅说明关注度，不是质量评分、适配保证或验收结果；数字会变化。

| 项目                                                   | Stars 快照 | 可借鉴内容                                       | 适配判断                                                                             |
| ------------------------------------------------------ | ---------: | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [Fumadocs](https://github.com/fuma-nama/fumadocs)      |     13,378 | 页面树、侧边栏、面包屑、阅读导航、内容源抽象     | 重点研究导航与阅读层；空间、写入、树变更及持久化需要业务服务负责。                   |
| [Docmost](https://github.com/docmost/docmost)          |     21,989 | 空间内页面、嵌套页面、重排、换父节点、树变更事务 | 与本次核心产品模型最接近，优先作为树管理的架构参考。                                 |
| [BookStack](https://github.com/BookStackApp/BookStack) |     19,082 | 内容移动、排序入口、确认与保存反馈               | 层级围绕书籍、章节、页面组织，不直接套用为递归文档模型；官方现已转向 Codeberg 维护。 |
| [Wiki.js](https://github.com/requarks/wiki)            |     29,042 | Wiki 产品的补充比较对象                          | 本轮未核实其空间及递归重排模型，不据此作选型结论。                                   |

### Fumadocs：导航投影与业务模型分离

官方 [Page Tree](https://www.fumadocs.dev/docs/headless/page-tree) 把树定义为提供给侧边栏、面包屑等组件的导航结构，要求避免放入敏感或大量数据。Folder 可以有 index 页面和 children，能够表达“父文档有正文并包含子文档”的阅读投影。

官方 [Source](https://www.fumadocs.dev/docs/headless/source-api/source) 说明内容源可以自定义，也介绍动态源。这意味着不能把 Fumadocs 简化为只能读取静态文件；但内容源接口也不能代替业务数据库、写入 Contract 或并发控制。

适配推论：如果后续采用 Fumadocs 的类型或导航工具，应由 Docs 数据模型生成轻量投影，正文另取，不把它的导航数据当成可写数据库模型。当前官方文档对应的 API 必须与仓库锁定版本重新核对，不能照搬较新示例。

### Docmost：空间、父子关系与顺序分开表达

官方 [Spaces](https://docmost.com/docs/user-guide/spaces) 和 [Pages](https://docmost.com/docs/user-guide/pages) 明确说明空间包含页面、页面可以嵌套、侧边栏拖拽可以重排或改变层级，并提供单独的移动入口。

源码核对基于 main 的 `b81872c003f26360a24cc439b5694e4400753021`：

- [页面表迁移](https://github.com/docmost/docmost/blob/b81872c003f26360a24cc439b5694e4400753021/apps/server/src/database/migrations/20240324T086300-pages.ts) 分别保存 `space_id`、`parent_page_id`、字符串 `position` 和 JSONB `content`。
- [页面 Service](https://github.com/docmost/docmost/blob/b81872c003f26360a24cc439b5694e4400753021/apps/server/src/core/page/services/page.service.ts) 使用 fractional indexing 生成位置；移动前检查自引用、目标父页面、同空间关系和后代关系，并在事务中重新读取当前状态。
- [页面 Repository](https://github.com/docmost/docmost/blob/b81872c003f26360a24cc439b5694e4400753021/apps/server/src/database/repos/page/page.repo.ts) 使用按空间取得的 PostgreSQL 事务 advisory lock 串行化相关树变更。多个空间按固定顺序加锁。

适配推论：树的完整性需要服务端事务保障，前端禁用非法拖拽不能代替校验。是否采用 fractional indexing、整数顺序或其他排序策略仍待比较，不能把调研到的算法写成已接受决定。Docmost 的实时协作和权限逻辑不自动进入首期范围，也不直接复制其实现。

### BookStack：移动与排序交互可以借鉴

官方 [Organising Content](https://www.bookstackapp.com/docs/user/organising-content/) 同时提供移动到目标位置和拖拽排序界面；章节移动保留其子页面。可以借鉴“调整位置、明确目的地、保存反馈”的交互，但其书籍与章节体系不作为本项目空间与文档树的领域定义。

## 初步方案比较

以下比较涵盖前期调研的全栈方向。用户已将本期范围收敛为 Server；本期只评估业务、持久化与 Contract，Fumadocs UI 和编辑器界面集成均留待后续，不设置前端 Demo 验收。

| 方向                                                                                 | 收益                                                 | 代价与限制                                                                                            |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 现有 Fastify 内建设 Docs 领域，复用 Tiptap、ExUI、PostgreSQL，参考 Fumadocs 阅读体验 | 符合当前工程边界，复用认证、Client、编辑器和运行入口 | 需要实现空间、树变更、保存冲突及管理交互。当前优先评估。                                              |
| 在相同业务服务上接入 Fumadocs UI/导航适配层                                          | 可以复用文档阅读组件                                 | 仍需全部写入业务；需验证锁定版本、Router、主题、样式及动态树更新兼容性，不能直接照搬完整 DocsLayout。 |
| 重新接入独立 Wiki 平台或另建独立 Docs 后端                                           | 可以复用现成平台功能或单独运行                       | 增加身份、数据库、运行及 Contract 边界，与本次自研及唯一 Server 的既有约束不符，不作为默认方向。      |

## 第一批确认结果

用户于 2026-10-16 明确确认：

1. 首期只建设 Docs。
2. 公开阅读，登录后可编辑；采用用户选择，原“阅读也要求登录”的建议不采纳。
3. 同意首期从空空间开始，不导入旧 Outline 内容，保留旧数据。
4. 同意普通编辑与保存冲突检测，明确不需要实时共同编辑。
5. 用户再次强调：文档编辑使用 Tiptap。

临时写入授权范围已在第三批确认：所有已登录用户可以管理全部空间和文档，不区分作者、角色或空间成员。

## 第二批确认结果：空间与文档树

用户按本批题目顺序确认前三项，并明确本期只开发 Server、不涉及前端：

5. 空间平级，每篇文档只属于一个空间。
6. 文档是唯一的树节点类型；文档可以同时有正文和子文档，正文允许留空，不另建文件夹节点。
7. 支持更换父文档与跨空间移动，子树整体跟随，并保持已有文档链接有效。
8. 本期不选择拖拽或菜单方案；Server 提供排序与移动 API，前端交互在后续阶段确定。

## 第三批确认结果：写入与内容生命周期

9. 所有已登录用户可以管理全部空间和文档；不增加作者、角色或空间成员限制。
10. 保存成功即公开生效，不做草稿、发布和审核状态。
11. 文档及其全部后代一起软删除，提供恢复 API；首期不提供永久删除或自动清理。
12. 用户要求提前预留搜索、模板、AI、附件，以及文档级评论。不能将这些能力简单排除出架构设计；暂不需要历史记录。
13. 评论仅以整篇文档为归属目标，不以正文选区、段落或内容片段为目标。

## 第四批确认结果：扩展预留的交付深度

Q13. 用户选择 B：本期创建相关业务表及 HTTP Contract，具体业务逻辑后续实现，并强调参考高关注开源项目的成熟架构，保持简单合理、避免过度设计。

用户随后要求现在创建并拆分 Monica Issues。需求可以交接给团队；完整技术设计仍须由 Architect 定稿、独立 Reviewer 审查并经用户确认，才可启动实现。材料入口为 `.notes/docs-service/plans/monica-docs-server-task.md`。

## 补充源码证据与建议

Docmost 的同一固定版本还核实了独立的 [评论表](https://github.com/docmost/docmost/blob/b81872c003f26360a24cc439b5694e4400753021/apps/server/src/database/migrations/20240324T086600-comments.ts)、[附件表](https://github.com/docmost/docmost/blob/b81872c003f26360a24cc439b5694e4400753021/apps/server/src/database/migrations/20240324T086700-attachments.ts)、[模板表](https://github.com/docmost/docmost/blob/b81872c003f26360a24cc439b5694e4400753021/apps/server/src/database/migrations/20260412T135891-templates.ts)，以及文档表内的正文、文本投影和搜索向量。它的评论还支持 selection 等更多能力，本项目只借鉴文档关联关系，不引入选区批注。

BookStack 的 [BookSorter](https://github.com/BookStackApp/BookStack/blob/d3db80004b51a395a9dabdd406f5fbda3d4d76e4/app/Sorting/BookSorter.php) 使用整数 priority，排序后重写条目顺序。对本项目当前规模，事务内重排同级整数顺序是值得优先比较的简单方案；没有必要因为 Docmost 使用 fractional indexing 就复制它的全部排序机制。

建议 Architect 优先比较“一个 Docs 领域、空间/文档/模板/附件/评论五张表”的方案。搜索可以复用文档表的文本投影；AI 可以先预留无状态的正文建议接口，不要求为每个能力机械新建一张表，也不引入搜索集群、向量库、消息总线或 AI 任务系统。以上仍是设计候选，未经用户架构审批。

预留 Contract 不能破坏已有双向 operation 覆盖。可采用明确标注未实现的 operation 与统一 501 错误，保留计划请求/响应 schema；合法请求不会返回模拟业务成功。501 的缓存行为须通过 `Cache-Control: no-store` 显式控制，依据 [RFC 9110 §15.6.2](https://www.rfc-editor.org/rfc/rfc9110.html#name-501-not-implemented)。具体方案交 Architect 和 Reviewer 核对。

PostgreSQL 的全文检索、[GIN 索引](https://www.postgresql.org/docs/current/textsearch-indexes.html) 和 [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) 可作为未来搜索实现的候选，不直接照搬上游的英语分词配置，也不声称本期已经完成中文搜索。

现有 Server 全局 JSON bodyLimit 为 4 MiB，完整 Tiptap 前端内容门禁允许 8 MiB、10,000 节点、32 层。新设计必须明确 Docs operation 的 wire/内容预算及一致性，不能让默认限额使声明支持的正文无法保存。现有共享组件根入口包含 React 与样式；Server 不得直接导入它，也不能把前端内容校验当成 Node 校验已经可用。

## 后续设计必须覆盖的风险

- 同空间父子关系、自引用、循环、并发互相移动、删除期间移动，以及稳定排序。
- 树请求只读元数据；正文按文档加载，避免每次导航拉取全部正文。
- 文档移动或改名不应使身份和已有链接失效；新路由与退休路径的关系需要明确。
- 内容保存冲突及失败重试的服务端语义；编辑器切换时的未保存修改保护由后续前端负责，不计入本期验收。
- Tiptap JSON 的服务端校验与版本策略；现有前端内容门禁不承诺服务端验证，不能用它代替写入校验。
- 权限延期的临时访问语义和后续接入边界。
- 搜索、模板、AI、附件和文档级评论的预留须给出可核对的接入约定，不能只有“后续支持”的口号，也不能注册未实现 operation 或返回模拟成功结果。
- 当前版本计数用于检测并发保存，历史快照及回滚不在本期范围。
- 本期通过真实 Fastify HTTP、原始 handler 输出及隔离 PostgreSQL 自动测试验收 Server；不因没有前端页面而要求浏览器或 UI Demo，不将自动测试记作部署验收。任务已派发不能记为实现完成。
