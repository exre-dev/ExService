# ExWebsite 与 Outline 文档服务集成交接

日期：2026-09-30。下一阶段：基于已确认需求开展技术设计，形成可评审的跨仓库方案；尚未进入实现。

## 接手入口

本文件位于 ExWebsite 仓库，所有未特别标注的路径均相对于 ExWebsite 根目录。另一个参与仓库是 Outline 的 `ex-outline-exui`，也是原会话的初始工作目录；带 `Outline:` 标记的路径相对于该仓库根目录。操作前确认所在仓库。

先读取两个仓库各自的 `AGENTS.md`，再按以下顺序恢复上下文：

1. `.ai/CONTEXT.md` 的「文档服务集成目标」及「首次集成边界」：本次访谈已确认需求的唯一汇总，不在交接中重复维护。
2. `README.md`、`.ai/README.md`、`.ai/architectures/overview.md`：Website 当前结构与开发边界。
3. `.ai/decisions/api/04-separate-local-session-and-sso-completion.md`、`.ai/architectures/web/authentication-flow.md`、`.ai/databases/data-model.md`：现有身份流程与数据库规则。
4. `.ai/knowledge/web/api-base-url-and-proxy-traps.md`：现有代理前缀与本地运行约束。

用户最后修正的是评论权限，已反映在 `.ai/CONTEXT.md` 的「评论权限」中；不要采用前面曾建议过的“只有编辑者可评论”方案。其他已确认事项不必重新逐项采访。

## 当前进度与授权边界

- 已读取 Website README、相关 `.ai/` 和局部源码，也检查了 Outline 的路由、分享、认证与权限入口。
- 本次任务此前只修改了现有 `.ai/CONTEXT.md`；本交接是新增的唯一交接文件。没有编写集成实现、正式规格、RFC 或实施计划，也没有创建 ADR。
- 用户已选择全新初始化 Outline，具体范围见「首次集成边界」。尚未执行任何数据库清理；不要把这项设计选择扩展成对任意本机数据库的删除授权。
- 未安装依赖、运行应用测试、进行浏览器联调、部署或提交代码。已有检查仅为文档 `git diff --check`，不能作为集成验收证据。
- 下一阶段应把技术方案与验收契约做成可评审结果。访谈技能要求在用户确认共享理解完整之前不开始实现；本轮用户只要求交接。
- 用户指定交接位置为 `.notes/archive/docs-integration/handoffs/`，优先于 handoff 技能默认的系统临时目录。模块根目录固定为 `.notes/archive/docs-integration/`；后续规格、RFC、计划分别放入其 `specs/`、`rfcs/`、`plans/`。
- 长期知识仍在 `.ai/CONTEXT.md`；沿用仓库既有 `.ai/architectures/` 结构，不创建模块级 CONTEXT 或另起一套重复领域模型。

## 已观察到的技术事实与调查入口

以下是源码调查线索，不是完整兼容性审计。后续改动前核对当前版本，不依赖旧行号。

| 主题             | 调查入口与观察                                                                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website 路由     | `apps/web/src/App.tsx` 尚无 `/docs`；`apps/web/vite.config.ts` 仅代理 `/api`；`apps/web/src/api/client.ts` 默认前缀为 `/api`。                                                                                                                                                   |
| Website 身份能力 | `api/openapi.yaml`、`apps/server/src/auth/service.ts`。既有 SSO 是本地请求确认流程，不能直接当作已实现的 OIDC 身份提供方。会话撤销逻辑存在，账号停用能力是否完整仍须继续调查。                                                                                                   |
| Outline 子路径   | Outline: `app/utils/ApiClient.ts` 默认 `/api`；`app/utils/history.ts` 调用 `createBrowserHistory()`；`app/index.tsx` 注册 `/static/sw.js`；`vite.config.ts` 构造 `/static/` 资源前缀；`server/routes/index.ts` 包含分享和根路径路由。仅增加反向代理规则不足以证明 `/docs` 可用。 |
| Outline 身份对接 | Outline: `plugins/oidc/server/auth/oidc.ts`、`oidcRouter.ts`、`OIDCStrategy.ts`、`server/commands/accountProvisioner.ts`、`userProvisioner.ts`。已有 OIDC 接入与主动退出入口，但尚未选定本项目身份协议，也未验证双向退出、账号停用及实时连接撤销。                               |
| 首次管理员       | Outline: `server/commands/accountProvisioner.ts` 有新建团队时授予 Admin 的路径。设计需要明确初始化与普通首次接入的分界，避免触发不符合已确认要求的默认行为。                                                                                                                     |
| 匿名公开内容     | Outline: `server/models/Share.ts`、`server/routes/api/shares/shares.ts`、`server/routes/index.ts`。已有 collection 分享、published、revokedAt、allowIndexing 等机制；尚未证明其能直接提供目标公开目录、草稿隔离及全部阅读体验。                                                  |
| 权限组合         | Outline: `server/policies/collection.ts`、`document.ts`、`share.ts`、`server/models/Team.ts`。同时存在全局角色、文档集权限、单文档权限及评论配置。不要把产品中的“不能编辑”直接等同于某个角色名称：团队级与文档集级新建规则不同，需沿真实调用链验证。                             |

## 下一阶段需要完成的设计

1. **同域入口与路径契约**：明确统一入口如何分发 Website 与 Outline 请求；覆盖页面深链接、API、认证回跳、静态资源、附件、WebSocket、协作服务、Service Worker、分享链接与站点地图。确定本地运行拓扑与复现命令。
2. **统一身份协议**：比较沿用 Outline OIDC 客户端的方案与其他适配方式，给出推荐及代价。具体协议尚未由用户选定；不要把已存在 OIDC 插件解释为已经选定方案。设计稳定账号关联、首次用户创建、并发幂等和资料同步时机。
3. **身份生命周期**：把统一退出、账号停用、会话过期和实时连接撤销写成明确契约；补充 Website 不可用时受保护请求的行为、状态传播时延与重试方式。普通 SSO 登录成功本身不证明满足这些要求。
4. **公开目录与授权**：给出匿名与登录视图、文档集公开状态、评论和编辑权限的落实方式；覆盖不可见内容的目录、搜索、附件、历史版本和缓存。核查既有单文档分享入口是否会绕过已确认的整集公开及管理规则。
5. **初始化与验收**：设计单工作区、显式首个管理员、全新 Outline 初始化流程；具体管理员账号尚未指定，设计可用占位配置，执行前再落实。定义本地端到端验收矩阵及负向用例，不把单测或构建通过当成真实联调完成。

优先自行调查可由代码回答的问题；只把会改变产品范围或形成重大取舍的问题交还用户。不要为了赶进度把未定方案写成已接受决策。

## 仓库与执行注意事项

- 两个仓库都检查过 `.codegraph/`，当时不存在。若接手时出现该目录，应先使用 CodeGraph 定位代码；否则使用 `rg`。
- Website 采用 pnpm 和 Contract-first；API 与数据库变更遵守其 `AGENTS.md`。Outline 使用 yarn，且其规则禁止新建 Markdown；本次明确请求的交接位于 Website，后续设计产物也留在既定 Website 模块目录。
- Website 工作树存在与本任务无关的依赖、锁文件和未跟踪资料；会话期间这些状态发生过变化。以接手时 `git status` 为准，保留他人修改，不回滚或一并提交。Outline 曾有未跟踪 `.notes/`，也须重新核对。
- PowerShell 读取中文文档使用 `Get-Content -Encoding utf8`；默认编码曾导致显示乱码，文件本身没有据此改写。
- 未读取或记录凭据；后续调查避免输出 `.env.local`、数据库连接秘密或个人资料。

## Suggested skills

下一位 agent 按阶段调用 Skill 工具；若运行环境没有该工具，则读取对应 `SKILL.md`：

- `technical-design-doc-creator`：组织跨服务技术设计、替代方案、契约和验收标准。
- `mattpocock-skills:research`：对身份协议、子路径适配等未决问题进行有界研究；优先本地源码，涉及外部协议时引用官方一手资料。
- `mattpocock-skills:grilling`：仅在调查后仍存在重要产品或架构取舍时继续聚焦提问。
- `mattpocock-skills:domain-modeling`：维护已确认领域术语，沿用现有模型并避免重复记录。
- `codebase-documenter`：按 Website 规则整理经证据确认的架构与长期知识。

当前不需要启动实现、提交或多 agent 流程；后续若用户授权相应阶段，再选用对应技能。
