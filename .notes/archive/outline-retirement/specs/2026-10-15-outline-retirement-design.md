# Outline 退役与身份能力保留设计

- 日期：2026-10-15。
- 状态：已按保留第三方登录与单点登录的要求修订，待用户审阅；尚未实施。
- 模块根目录：`.notes/archive/outline-retirement/`。
- 后续 RFC 目录：`.notes/archive/outline-retirement/rfcs/`。

## 目标与前提

完整移除 Outline 文档应用及其专属集成，保留第三方登录、单点登录和 Hydra 身份基础设施。Website 在没有 Outline 的情况下可以安装、开发、构建和运行。保留 Docs 导航，在 `/docs` 和 `/docs/` 显示“文档建设中”。

用户确认旧文档系统没有文件和文档，项目尚未上线，直接退役；不安排旧文档内容迁移、导出或旧文档地址兼容。保留 Website 账号、会话、第三方账号关联、SSO、申请、通知、头像、通用存储及其他业务数据。

本阶段不设计自研 Docs，也不新增第三方 provider 或接入新的业务应用。保留认证能力不代表未接入的平台已经可以登录。

## Hydra、第三方登录与 Redis 的职责

| 能力               | 用途与处理                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Website 账号与登录 | 管理用户、凭据、本站会话和账号状态；外部账号接入和关联属于该认证体系。保留。                                                         |
| Hydra              | 提供 OAuth 2.0/OIDC 授权与令牌，委托 Website 完成登录、授权确认和退出，供其他应用使用本站账号。保留服务、数据库、issuer 与协议入口。 |
| 本地 SSO 接收流程  | 现有 `auth/sso` operation、CLI 和成功页继续保留；该流程不替代 Hydra OIDC。                                                           |
| Outline            | 当前身份系统的一个文档客户端。删除应用、客户端登记、Docs 回调、附件、协作与专属身份通知。                                            |
| Redis              | 当前由 Outline 使用，Website 业务代码和 Hydra 容器配置没有 Redis 消费方。随 Outline 移除，不为未设计的功能引入 Redis。               |

Hydra 将用户认证委托给登录应用，不自行实现 Google、QQ 等外部账号的接入与关联。职责依据见 [Ory Hydra](https://www.ory.com/hydra) 与 [登录和授权确认流程](https://www.ory.com/docs/oauth2-oidc/custom-login-consent/flow)。工程实际依赖以源码为准。

## 方案与目标结构

采用一次交付完整退役：迁回主站所需资源，解除身份系统对 Outline 的强制依赖，再删除文档应用并验收。分两次交付也可行，但目前没有在线流量或内容迁移需求，无需维护临时双系统状态。

```text
浏览器与接入应用
  ├─ Website：现有业务、身份页面、Docs 建设中页面
  │    └─ Fastify Server
  │         ├─ PostgreSQL exre：账号、业务、SSO 与 OIDC 状态
  │         └─ 现有头像与通用存储
  └─ Hydra public：OAuth 2.0/OIDC
       ├─ 委托 Website 完成登录、授权确认与退出
       └─ PostgreSQL hydra
```

Compose 保留 PostgreSQL 与 Hydra，删除 Redis。Hydra admin 继续仅供受控服务间访问，不暴露到公共代理。保留现有 Website/Hydra 地址、回环监听、issuer、秘密与数据库，不因退役 Outline 重建身份系统。

## Docs 入口与主站外观

- 保留现有导航名称和 `/docs/` 地址，桌面与移动端改用 Website 内部路由，删除独立文档应用的整页导航分支。
- `/docs` 与 `/docs/` 使用现有 `RootLayout`、顶栏、主题和响应式规则，显示“文档建设中”“新的文档系统正在准备中。”及返回首页操作。
- 页面不调用文档 API，不要求登录，不增加编辑、搜索或上传功能。旧文档、附件、搜索和 `/docs` 下的认证路径进入现有站点 404。
- 将 `apps/web/src/main.tsx` 当前从子模块导入的主站品牌 CSS 迁到 `apps/web/src/styles/website-theme.css`，保持 Token、选择器和导入顺序。
- 保留 Website 的主题偏好、设置同步、共享 Tiptap、Fumadocs 和通用存储，继续服务其现有用途。

## 身份系统与 Outline 脱钩

当前 `parseIdentityConfig()` 将客户端固定为 `ex-outline-local` 或 `ex-outline`，回调固定为 `/docs/auth/oidc.callback`，同时强制要求 Outline internal URL、集成密钥和撤销目标。保留 Hydra 需要解除这些依赖。

1. 保留 `apps/server/src/modules/identity/`、OIDC 服务、账号检查、会话关联、撤销 worker、内部鉴权和类型扩展；配置改为独立身份配置和显式客户端集合。
2. 客户端集合允许为空：没有接入应用时 Website/Hydra 仍可启动，不创建虚构客户端，不检查 Outline marker。空集合拒绝所有客户端授权请求。
3. 真实应用逐个登记精确 clientId、redirect URI、scope 和独立秘密；继续拒绝未知客户端、任意回调及未批准 scope。本次不新增公开动态注册、自助接入或应用管理界面。
4. 删除 Outline 客户端、Docs callback、internal URL、集成密钥及专属消息构造。通用客户端和撤销目标配置不继续使用 `OUTLINE_*` 设置承载。
5. 保留 `/identity/login`、`/identity/consent`、`/identity/logout`，以及 OIDC 仍使用的 signed-out 确认。删除仅供 Outline iframe 使用的 status 协议和 Docs 恢复导航；不能整体删除 `/identity/*`。
6. 保留第三方认证现有入口、账号关联、provider 配置和测试，不把其他工作树的功能合入本次退役变更。
7. 保留按 clientId、Hydra sid 和本站 sessionId 定位的撤销语义。普通退出只影响当前会话组；停用撤销已有会话；恢复不复活旧会话。
8. 保留通用 outbox 的逐目标投递、重试、幂等和 issuer 绑定保护。只清理能精确归属于 Outline 的旧目标，其他未完成事件继续待处理，不扩大撤销范围。应用通知若保留，必须有明确配置和鉴权，不能隐式回退到旧 Outline 地址或密钥。

## 工程与配置清理

| 范围       | 处理                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 子模块     | 移除 `apps/outline` gitlink、`.gitmodules` 登记和 workspace 排除项，保留远端仓库和其他 worktree 使用的 Git 对象。                                                                        |
| 工具与依赖 | 删除 Outline 的 Yarn 安装、版本检查、构建、测试和监听要求；保留 Node、pnpm 及其需要的 Corepack。仅删除无其他消费者的包和工具配置。                                                       |
| 通用工具   | 将 Website/Hydra 仍使用的进程监督、锁、归属核验、脱敏及工具发现迁到 `scripts/runtime/`，替换导入后删除旧文档脚本。                                                                       |
| 配置       | 删除 Outline、Redis、Docs callback 设置；保留 Website、Hydra、第三方认证及通用 OIDC 的数据库、issuer、密钥、端口、镜像和环境隔离。已有 `.env.local` 按键清理，保留现役原值且不回显秘密。 |
| 代理       | 删除 Outline HTTP、static、附件和 WebSocket 转发；保留 Website API、Hydra public 白名单、身份路由、内部接口拒绝、SPA fallback、转发信任和上传预算。                                      |
| 监督与准备 | 删除 Outline 进程、schema、marker、管理员和存储检查；保留 Website/Hydra 的健康、客户端、归属、日志和失败回收检查。                                                                       |
| 文档       | 同步当前 README、AGENTS、架构与运行说明及 `.ai/` 索引；历史设计继续保留历史属性。                                                                                                        |

## Contract 与数据库

现有七个 identity operation 保留其身份用途，不整体删除：`inspectOidcRequest`、`acceptOidcLogin`、`acceptOidcConsent`、`acceptOidcLogout`、`checkLinkedSession`、`revokeLinkedSession`、`inspectIdentityUser`。清理实现中的 Outline 强制绑定，保持现有请求与响应契约。内部 operation 继续按已登记调用方和用途鉴权，不能因文档退役而公开。

保留 `auth_oidc_flows`、`auth_oidc_bindings`、`auth_identity_outbox`、`auth_users.profile_version`、`auth_users.disabled_at`、`auth_sessions.id` 及关联约束。仅按精确 clientId 清理 Outline 状态，不清空其他客户端或整个 outbox。

仅删除文档客户端不要求删除上述表。实际需要改变表职责、关系或数据规则时，先更新 `.ai/databases/data-model.md`、评审影响，再新增迁移；历史 SQL、journal 和快照不重写。实际变更 HTTP 契约时遵循 Contract-first 并重新生成 JSON 和 Client 类型，禁止手改生成物。

## 命令行为

| 命令                                  | 退役后行为                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm service:start/stop/status/logs` | 管理 PostgreSQL 与 Hydra，删除 Redis；保留归属核验及日常停止时保留数据的规则。                         |
| `pnpm dev`                            | 生成 Contract，检查 Website/Hydra 准备状态并启动 Website，不启动或检查 Outline。                       |
| `pnpm build`                          | 构建 SDK、Website Web/Server，无需 Outline checkout，不连接数据库或启动 Docker。                       |
| `pnpm test` / `pnpm test:watch`       | 保留 Website、身份与通用运行工具测试，移除 Outline 测试和文件监听。数据库测试继续使用 Testcontainers。 |
| `pnpm start/stop/logs`                | 保留 Website/Hydra 的原生运行管理，删除 Outline 项。                                                   |
| `pnpm db:migrate` / `pnpm db:reset`   | 保持 Website 显式维护语义与现役 schema 检查。                                                          |
| `pnpm infra init/migrate`             | 保留 Hydra 数据库准备和迁移，移除 Outline 内容；普通启动不隐式执行。                                   |
| `pnpm infra bootstrap`                | 删除旧 Outline 管理员准备动作，现役客户端由身份准备流程登记，不自动授权管理员。                        |
| `pnpm infra convert/nginx`            | 保留 Website/Hydra 仍有用途的转换与代理生成，移除文档和 Redis 强制项。                                 |

## 现有开发资源

一次性清理仅处理能证明属于本开发环境的 Outline 进程、Redis 容器与专属卷、Outline 附件和缓存、独立 `outline` 数据库及未被其他对象使用的专属角色。客户端登记与状态按精确 Outline clientId 处理。

保留 Hydra 进程/容器、`hydra` 数据库、issuer、现役秘密、PostgreSQL 实例、`pgdata` 卷、Website `exre`、业务数据、头像、存储及其他工作树。不能通过删除整套 Compose 的卷来清理文档。

先核验实际资源与归属、停止旧 Outline/Redis 资源，再删除旧监督实现或调整资源记录。归属不明的资源不接管或删除，记录具体证据。一次性清理不加入普通启动和停止流程。

当前只核对源码与 Git 登记，未操作实际数据库、Docker、PM2、系统服务或附件目录。用户确认的空文档库是设计前提，不表述为本轮数据库验收。

## 验收

1. 无 Outline checkout、Yarn、Redis 或旧文档配置时，Website 与身份系统可以安装、检查、测试、构建和启动。
2. Hydra/Website 可在空客户端集合下运行并拒绝未登记 clientId；隔离环境登记测试客户端后验证完整 OIDC 登录、授权确认和退出，无需 Outline。
3. 执行 `pnpm api:lint`、`pnpm api:generate`、`pnpm api:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`；SDK 构建与依赖其产物的类型检查顺序执行。
4. 保留普通登录、第三方认证现有行为、CLI SSO、OIDC、会话关联、退出、停用恢复、幂等及跨设备隔离测试；自动数据库测试不回退开发库。
5. 现役代码、配置和运行入口无 Outline 可执行依赖。历史迁移、历史设计与退役记录允许保留名称；CSS `outline` 和 UI 同名 variant 不属于删除目标。
6. 浏览器验证 Docs 导航、根路径、旧子路径 404、刷新、匿名/登录状态、明暗主题和移动端，确认主站品牌样式和身份页面正常。
7. 单独验证 Hydra readiness、客户端检查和本机生命周期。外部 provider 与其他应用的真实登录验收按实际接入状态报告，不能以本地接口测试代替。
8. 资源清理逐项报告删除、不存在与归属未确认的目标，确认 Hydra、`hydra` 和 Website 数据保留。自动检查、本机运行与浏览器验收分别报告，本阶段不部署。

## 证据与后续交付

现状依据：`README.md`、`.ai/architectures/runtime/runtime-boundaries.md`、`.ai/architectures/docs-integration/integration-boundaries.md`、`.ai/architectures/server/authentication-lifecycle.md`、`.ai/architectures/web/authentication-flow.md`、`.ai/databases/data-model.md`、`compose.yaml`、`scripts/runtime/`、`apps/server/src/modules/identity/`、`apps/server/src/modules/auth/service.ts`、`apps/server/src/db/schema.ts`、`apps/web/src/App.tsx`、`apps/web/src/main.tsx` 与 `api/paths/identity.yaml`。

Outline 子模块规则和主站品牌 CSS 已从父仓库登记的 revision 读取。当前工作树认证说明中的 Google、QQ 为禁用占位入口，不能因保留身份设计宣称已完成真实接入。

本文审阅通过后，按 brainstorming 默认流程使用 `technical-design-doc-creator` 在 `.notes/archive/outline-retirement/rfcs/` 编写实施 RFC。设计和 RFC 不自动提交，也不代表实现、资源清理或外部认证平台验收。
