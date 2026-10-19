# RFC：Outline 文档授权、公开目录与工作区初始化

状态：架构预审已通过，实施中；实现审查与运行验收尚未完成。

日期：2026-09-30。来源：`.notes/archive/docs-integration/specs/2026-09-30-docs-integration-design.md`。依赖 `.notes/archive/docs-integration/rfcs/environment-and-subpath-rfc.md` 与 `.notes/archive/docs-integration/rfcs/identity-and-session-lifecycle-rfc.md`。下文 Outline 源码路径均以 Website 根目录的 `apps/outline/` 开始。

## 决策与范围

以文档集成员权限决定登录访问与编辑，以集合级 Share 决定匿名公开。普通用户保持 Viewer 角色，编辑能力来自明确的集合 ReadWrite 授权，不通过提升全局 Member 获得。文档管理员负责集合创建、成员授权及公开状态；关闭单篇独立公开和单篇授权旁路。

复用 Outline 编辑器、评论、集合、Share、查询与 presenter 基础，增加集中集成权限函数及公共内容投影。禁止复制完整文档系统到 Website；Website 不存文档授权表，不通过其 Fastify 新增文档业务 API。

本期只有一个新工作区；无旧数据迁移，无逐篇发布审核，无用户自行建工作区，无第三方认证/个人 API token/MCP 外部入口绕过身份核验。

## 实施前源码基线

- `apps/outline/server/policies/collection.ts` 的创建允许 Admin 或 memberCollectionCreate；更新/新建文档可由显式集合 ReadWrite/Admin 成员授予。
- `apps/outline/server/policies/document.ts` 的团队级创建拒绝 Viewer，但文档更新还允许直接文档成员和作者草稿分支，不能只设置 Viewer 就满足全部限制。
- `apps/outline/server/commands/documentCreator.ts` 的 `authorizeDocumentCreate`、`authorizeDocumentPublish` 被 API 和 MCP 创建路径复用，应保持统一授权入口。
- `apps/outline/server/commands/shareLoader.ts` 同时支持集合 Share、文档 Share 和子文档树，读取时存在 withDrafts scope；必须明确剔除单篇公开和草稿路径。
- `apps/outline/server/models/Share.ts` 已有 published、revokedAt、allowIndexing、collectionId/documentId 等字段；不需要再创建第二个集合公开布尔值。
- `apps/outline/server/commands/accountProvisioner.ts` 在新团队时赋予 Admin；现有 provider/provisioner 支持按邮箱匹配，必须使用身份 RFC 的专用入口。

上述为局部静态核对，不是全部 API 授权审计；以下矩阵是实施必须补齐的规范。

## 统一可见性与权限模型

在 Outline 集成模式中使用集中模块 `apps/outline/server/policies/websiteAccess.ts`，供 policy、列表查询、Share loader、附件和协作调用。函数输入为受验证的 actor、目标集合/文档和当前成员关系；不能用前端隐藏按钮替代。

### 集合与角色

- 普通 Website 用户映射 `UserRole.Viewer`；仅 bootstrap 或文档管理员显式授予 `UserRole.Admin`。不根据 Website admin 组提升。
- 所有新集合 `permission=null`，不使用面向所有工作区用户的 ReadWrite/Read 默认值。显式 Read 成员可读，ReadWrite 成员可编辑；受文档管理员管理的组成员关系按相同规则聚合。
- 普通用户/编辑者不能设置 collection.permission、sharing、公开 Share、成员权限或提升自身角色。集合 metadata 的允许修改字段使用白名单，防止借通用 update 写授权字段。
- 集合 Share 公开与登录成员关系正交：公共已发布内容任何人可读；私有内容不因登录自动可读。管理员管理全部集合，非管理员只看到自身可读集合和公共集合。
- 集成工作区禁止新建直接文档级成员授权；不能以 DocumentPermission.ReadWrite/Admin 绕过集合规则。已有非集成工作区不在本次修改目标内，普通上游模式可继续原行为。

### 文档动作

| 动作                            | 判定                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| 读已发布文档                    | 文档与集合均有效，且公共可见或 actor 为管理员/有集合 Read 以上权限        |
| 读草稿                          | 作者且仍有目标集编辑权，或该集编辑者/管理员；匿名和普通 Read 成员均不可见 |
| 评论                            | 有效 Website 关联会话、可读、活动文档与可变工作区；不要求编辑权           |
| 在集合中新建/编辑/发布          | 管理员或该集显式 ReadWrite；父级也必须属于该集且满足现有结构约束          |
| 无集合草稿                      | 本集成中禁止创建，包括通过复制、导入、MCP 间接创建；UI 先选择可编辑集合   |
| 复制                            | 可读源文档且可在目标集新建；取消仅检查团队 createDocument 的旧限制        |
| 移动                            | 可编辑源文档且可在目标集新建；跨集移动整个子树均应用目标权限              |
| 删除/归档/取消发布              | 管理员或该集编辑者，同时保留 Outline 现有对象状态约束                     |
| 新建集合、公开/撤销公开、改授权 | 仅文档管理员                                                              |

普通 Viewer 的全局角色不再阻止已获集合 ReadWrite 的合法编辑；所有需要“有任何可编辑集合”的全局 UI 用真实集合能力判断。反过来，作者身份不能在集合授权被撤销后继续写草稿。

团队级 createDocument 不作为执行授权：调用方必须提供集合。用于按钮展示时，单独计算“是否存在可编辑集合”，不得把这个布尔值作为任意集合的新建权限。默认跳转空草稿的快捷键改为集合选择；编辑器、导入、模板、duplicate、移动与恢复路径都经上述目的地检查。

评论配置固定为允许可读用户评论：初始化选择相应团队配置，并禁止 UI/API 将集成工作区或集合评论关闭。保留已删除/归档文档不能新增评论等状态限制。匿名默认不返回评论数据；登录读者使用已验证的评论 API。

## 集合公开状态与数据约束

继续用 Share 作为唯一公开事实：`collectionId` 非空、`documentId` 为空、published=true、revokedAt=null，且团队/集合 sharing=true、集合与工作区未删除/归档/停用，才公开。文档还需属于该集合、publishedAt 非空、未删除/归档。Share ID 只是定位值，不是绕过这些条件的能力凭证。

为同一集合的未撤销 Share 增加唯一约束（部分唯一索引），保证管理员并发公开不会产生多个有效入口。集成模式拒绝创建 documentId 非空的 Share，禁用自定义分享域名和子篇公开设置；shareLoader 遇到单篇 Share 一律返回不可见。

管理员公开操作在事务内锁定集合并创建/更新唯一集合 Share：published=true、includeChildDocuments=true、allowIndexing=true。撤销公开写 revokedAt 并失效公共导航/缓存；重新公开可创建新 Share，canonical 不包含 Share ID，因此正常文档 URL 不变。

编辑者发布草稿将 publishedAt 写入，公开判定自然生效；修改已发布内容直接影响公共版本。不增加内容发布副本或审批表。移动已发布文档进入公开集合会使其公开，UI 在目标集选择处提示这一结果，不新增审批。

所有读取的 publishedAt 和归属从当前数据库文档读取，不能信任过期 navigation tree。层级中若出现不可公开祖先，不在目录中泄露其标题；公开子文档在公开目录中提升到最近可见祖先。父子关系仍由编辑侧维护。

## 公共页面与 API

匿名 `/docs/` 展示公共目录；登录用户进入原 Outline 工作区视图，同时能看到公开集合。无 Outline Cookie 但已有 Website 登录的自动接入由身份 RFC 的状态探测触发，不要求访客强制登录。

复用现有 `/docs/doc/<slug>` 文档路径作为 canonical。匿名深链接由服务端先检查公共可见性并输出标题、描述、canonical 和可索引正文，再由客户端接管只读编辑器视图；仅返回空 SPA 不算完成搜索引擎可收录目标。查询不存在或不可见目标统一 404，不泄露私有标题或登录成员名单。

拟新增以下 Outline 自有 Koa RPC（实际外部前缀 `/docs/api/`）。在 `apps/outline/server/routes/api/public/` 使用既有 validate/pagination/presenter 约定；这是 Outline 的 schema，不复制进 Website OpenAPI 或 Website API Client。

| POST operation            | 请求                                                               | 响应 data                                                                             |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `public.collections.list` | `{offset?:integer,limit?:integer}`                                 | `[{id,name,description,url}]`                                                         |
| `public.documents.list`   | `{collectionId:UUID,offset?:integer,limit?:integer}`               | `[{id,title,url,parentDocumentId:UUID或null,updatedAt:ISO日期}]`                      |
| `public.documents.info`   | `{id:string}`，支持已验证 slug/id 解析                             | `{id,collectionId,title,content,url,updatedAt}`；content 采用现有文档 AST JSON schema |
| `public.documents.search` | `{query:string,collectionId?:UUID,offset?:integer,limit?:integer}` | `[{id,collectionId,title,url,excerpt}]`                                               |

统一响应 `{data,pagination}`，列表 pagination 为 `{offset,limit,hasMore}`，info 为 `{data}`。offset 默认 0，limit 默认 20、最大 100；query trim 后 1–200 字符。拒绝未知字段。不返回整个内部 Document/Collection 实体、作者邮箱、成员关系、私有链接预览、草稿计数或不经过过滤的总数。

公共 SQL 查询先联结集合级有效 Share 和已发布文档再过滤/分页；搜索复用 PostgreSQL 文档全文检索能力，只在可公开集合范围生成结果和摘要。不可先全局搜索再在应用层丢弃私有行，否则计数与分页可泄露信息。集合/文档列表按现有名称或更新时间加稳定 ID 排序；非快照分页中并发发布可改变后续页面，但不能返回私有行。

旧 `shares.info`/公开 Share 页面仍需使用同一 PublicAccess resolver；不能新增公共 API 后留下旧路由旁路。登录 API 的列表/search 和 direct document load 同样应用新权限规则，公开内容对登录用户可读，但草稿不能混入默认读者视图。

集成模式的 `documents.info` 对没有内部集合阅读权、但目标当前公开的登录用户返回最小公开 `data` 和顶层 `publicOnly=true` 能力标记；该标记由本次实时授权决定，不伪造成员关系或提升角色。客户端据此进入公开只读文档场景，避免完整 DocumentScene 的成员、访问记录与分享副请求，并通过受会话保护的评论 API 保留登录读者评论能力。登录列表和搜索中的同类结果也只使用安全公开投影；内部成员继续使用其正常授权投影。

公共 API 不使用 optional auth 依赖 Website：其响应始终是匿名投影，即使请求携带已失效 Cookie。登录评论/编辑另走受保护 API，认证失败时不能执行写入。公开站点地图只枚举同一 resolver 结果；robots/canonical 不以 noindex 代替授权。

## 附件、缓存与旁路

本期 Outline 使用本地私有文件目录。文件物理目录不由 nginx 静态暴露，所有附件读取都经过 Outline resolver；本期不返回可在授权撤销后继续使用的长效对象存储 URL。

附件读取须确认附件的实际所属文档；匿名要求该所属文档当前公开、已发布，并且附件在其当前可公开内容中被引用。仅在公开文档粘贴一条私有附件 URL 不改变附件归属，不授予访问权。新上传但未关联的文件仅限经会话核验的上传者，关联写入必须验证目标编辑权和归属。

下载、Range、缩略图、图片代理、嵌入预览、PDF/ZIP 导出和历史版本逐项复用相同判定。匿名不提供历史版本和集合批量导出；登录历史/导出继承可读范围及既有额外权限，不能通过旧 revision 访问其他集合文档。撤销前已经传出的字节不能收回，撤销后新请求必须拒绝。

文档 HTML、API、附件和站点地图统一 no-store，不启用 CDN/public 内容缓存；静态 JS/CSS/fonts 可长缓存。SW 仅缓存静态资产，禁止私有内容离线缓存。数据库结果可在单请求内复用，跨请求公共授权判定不缓存，因此撤销公开不依赖缓存 TTL。

关闭集成工作区的其他登录插件、邀请建号入口、个人 API token/OAuth 应用授权创建、外部 MCP 和桌面 transfer 登录路径；协议/配置入口与后端操作均限制。真正需要的内部队列/服务使用自身身份，不接受终端用户替代 token 绕过 SessionGuard。

## 唯一工作区初始化

新增 Outline 集成标记表 `WebsiteIntegration`：单行 key=`website` 主键，保存 teamId、issuer、initialAdminSubject、createdAt。teamId 唯一且不可通过普通 UI 修改。ExternalIdentity/ExternalSession 由身份 RFC 负责，本表不重复维护会话。

`pnpm integration:bootstrap -- --admin-user-id <id>` 是编排入口：

1. 检查三个库 migration 就绪、Outline 为新集成目标；通过 Website bootstrapKey 调用用户 inspect，要求账号存在且启用。
2. 幂等配置固定 Hydra 客户端；已有 client 的 issuer/回调/权限与期望冲突时失败，不静默覆盖扩权。
3. Outline 在事务中取得初始化锁。标记不存在且库已有非本集成 Team 时拒绝；空库创建唯一 Team、Website OIDC AuthenticationProvider、管理员 User 与 ExternalIdentity，设置 Viewer 默认角色、关闭成员建集合与独立邀请。
4. 写集成标记并提交；相同 issuer/admin 的重试返回已有结果，不重置管理员后续权限、不创建第二 Team。不同管理员参数或 issuer 返回冲突，后续授权通过管理流程完成。

管理员资料来自 Website，不填造邮箱，也不依赖“首次访问触发 accountProvisioner 新团队”逻辑。初始化期间 Website 用户可能被停用：提交前再核验，失败回滚；提交后停用由常规会话 guard 拦截。不能因初始化失败清空数据库或回滚已存在 Website 账号。

未初始化时身份 callback 返回明确 503 未就绪，不能自动新建 Team。只读公共目录可显示空状态和“文档服务尚未初始化”的安全提示，无管理员自助抢占入口。

## UI 改造与实现边界

- Outline 登录页面替换为 Website 统一登录入口；用户菜单昵称/头像只读并提供 Website 设置链接。
- 集合创建、成员管理和公开开关只对文档管理员展示。编辑者的发布按钮保留，公开集内提示发布会对外可见。
- 单篇 Share 弹窗移除匿名公开开关，替换为“复制链接”；复制不改变权限。
- 公共目录/文档无私有侧栏、通知、评论内容和编辑动作；登录后按授权加载完整能力。
- 创建文档先选择有编辑权集合；被撤权时关闭编辑能力，协作连接重新授权，不单靠前端只读。
- 普通 Read 用户可见评论框，不受旧 Viewer UI 条件误隐藏；接口仍需身份 RFC 核验。

现有布局、ExUI 样式和编辑器交互尽量复用，不借本期替换 React 或整体重做 UI。集成行为通过显式 `WEBSITE_INTEGRATION_ENABLED` 模式启用；有集成标记的数据库不得关闭此模式继续启动，以防恢复上游宽松策略。

## 验证与验收

覆盖源规格 E08–E10、E14–E16。测试矩阵同时包含匿名、普通 Viewer、集合 Read、集合 ReadWrite、文档管理员、停用用户及另一工作区对象。

必须验证：集合权限 vs 全局角色交叉；普通用户团队级草稿/导入/复制旁路；作者撤权后草稿；编辑者更改 sharing/memberCollectionCreate/直接 Share API；直接文档成员授权；搜索分页和摘要；公开链接/草稿附件/历史；私有文档粘贴公开页面链接；公开集移动进出；并发公开/撤销；并发 bootstrap；登录 Cookie 失效但公共页面仍可读。

路由测试覆盖真实 Koa middleware/schema/policy/serializer，不能只单测 helper。数据库测试覆盖 Share 唯一约束、成员查询与树投影。浏览器用两种运行模式验证：访客目录、登录后评论、指定集编辑发布、匿名同步阅读、管理员撤销公开、5 秒撤权协作及隐私负向用例。以源规格 PASS/FAIL/NOT_EXECUTED 报告。

## 上线顺序、风险与回滚

落地顺序：集中权限 helper/查询 scope → Share 约束与公共 resolver → bootstrap → UI → 附件与所有旁路 → 集成矩阵。可在 identity RFC 完成前用隔离测试 actor 验证策略，但真实登录/协作验收依赖其完成。

风险与检测：旧 API 漏接 helper（按路由/命令入口枚举并做负向测试）；旧 tree 含草稿（每节点重新过滤）；Viewer UI 拒绝合法编辑（角色×集合矩阵）；缓存或附件绕过（直接 URL、Range、撤销后重放）；公开模式依赖 Website（断网浏览器用例）；初始化竞争（并发事务测试）。

回滚以关闭整个 `/docs` 入口或回到仍执行集成授权的前一版本为单位，保留数据库、附件和初始化标记。禁止在同一集成数据库上直接关闭模式切回上游授权，否则单篇分享/默认成员能力可能重新开放。迁移增加字段/索引不自动降级；如果需回退物理结构，先备份并显式核对引用，不能删库重建。

未决产品选择：无。实际账号 ID 由执行 bootstrap 时提供；当前文档未运行任何 UI、Koa 或数据库测试。权限函数、页面和 RPC 均为拟实现契约，不代表现有 Outline 已具备这些行为。
