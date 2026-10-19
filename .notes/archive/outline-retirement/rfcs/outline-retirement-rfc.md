# RFC：退役 Outline，保留独立身份系统

- 日期：2026-10-15。
- 状态：实施设计，待实施验收。
- 设计依据：`.notes/archive/outline-retirement/specs/2026-10-15-outline-retirement-design.md`，采用用户确认的保留第三方登录、SSO 与 Hydra 的范围。
- 模块根目录：`.notes/archive/outline-retirement/`。

## 决策与交付边界

一次交付移除 Outline 应用、文档客户端、Redis、Docs 代理和专属准备流程；保留 Website、Hydra、第三方认证、CLI SSO、OIDC、内部身份接口、会话绑定和撤销能力。Docs 导航进入 Website 的建设中页面。

本 RFC 是一个实施单元。身份配置、撤销任务、运行编排和文档应用删除存在直接依赖，不拆成可以独立上线的 RFC。实现不新增外部登录平台、不合并其他工作树、不设计自研 Docs，不提交或部署代码。

用户确认旧系统没有文件和文档、工程未上线；不做文档导出和内容迁移。此事实不意味着 Website 账号、Hydra 状态或其他客户端记录可以清空。

## 当前实现与问题

| 来源                                                             | 已核对行为                                                                                            | 必要变化                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/server/src/modules/identity/config.ts`                     | clientId 联合类型只有两个 Outline ID 和测试 probe；callback、internal URL、密钥和目标由文档模式派生。 | 用显式身份客户端配置取代固定文档客户端，允许空集合。               |
| `apps/server/src/modules/identity/oidc.ts`                       | 已支持通过客户端字典核对精确回调和 scope，并持久化 flow、sid 与本站 sessionId。                       | 复用现有协议实现，改变配置来源，保持验证强度。                     |
| `apps/server/src/modules/identity/outbox.ts`                     | 非 probe 目标都必须向 Outline 投递，并使用 `outline:` 结果标识。                                      | 以目标配置决定是否通知应用，保留 Hydra 撤销与重试。                |
| `scripts/docs-integration/hydra-client.mjs`                      | 登记和校验写死文档客户端、Docs callback、固定授权方式和 metadata；校验还探测真实 client secret。      | 迁到通用运行目录，消费显式客户端配置，继续只读检查与显式登记分离。 |
| `scripts/runtime/deployment.mjs`、Server `deployment-binding.ts` | identity receipt 固定一个 Outline client secret 和 delivery key，并读取 Outline 库 marker。           | 保留身份绑定保护，改为按客户端固定路由与秘密指纹，去除文档库检查。 |
| `apps/web/src/main.tsx`                                          | 主站品牌样式从 Outline 子模块导入。                                                                   | 在删除子模块前迁回主站。                                           |
| `apps/web/src/pages/IdentityPage/SignedOutPage.tsx`              | OIDC 退出仍会进入此页，但页面包含 Docs 返回和恢复逻辑。                                               | 保留退出确认与竞态保护，改为身份通用文案及首页返回。               |
| `scripts/runtime/`、`compose.yaml`                               | Website/Hydra 的运行工具也从文档集成目录导入；依赖清单包含 Redis。                                    | 迁移公共能力，删除 Redis 和 Outline 的运行配置。                   |

## 身份配置契约

以下为本次新增或调整的配置契约，不描述当前已有能力。

### 启用与共享设置

- `IDENTITY_ENABLED` 替代文档集成启用标志；只接受 `true`、`false`。根 runtime 为现有身份运行注入 `true`；独立 Server 未启用时维持现有身份 operation 不可用的行为。
- `IDENTITY_MODE` 只接受 `local`、`deployment`，由根 `RUNTIME_PROFILE` 显式派生；不保留历史 Docs dev/full 拓扑推导。
- 保留 `HYDRA_PUBLIC_URL`、`HYDRA_ADMIN_URL`、Hydra 数据库字段、`HYDRA_SYSTEM_SECRET`、`IDENTITY_FLOW_KEY`、`IDENTITY_BOOTSTRAP_KEY`、Website 数据库及现役认证设置的原值与验证。
- 删除 `OUTLINE_*`、Redis 和 Docs callback 设置；不把遗留无消费者的 Outline 键存在本身作为 Website 启动失败条件。转换工具只移除已确认的退役键，不用示例值覆写现役设置。
- 客户端只使用当前模式的 issuer。历史清理目标不能扩大授权名单，不能通过回退秘密或地址使缺失配置生效。

### 显式客户端清单

新增 `IDENTITY_CLIENTS_JSON`，为数组，缺省为 `[]`。数组避免 JSON 对象中重复 clientId 被解析器覆盖；重复 clientId、未知字段和非法字段均拒绝。仅保存在根秘密配置及受控服务端环境中，Web 编译和运行环境不能收到此值。

每项字段固定如下：

| 字段                    | 约束与用途                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientId`              | 非空 ASCII 小写字母、数字和连字符，字母开头，最长 64 字符；唯一。两个已退役 Outline ID 不得重新登记。                                                                                   |
| `name`                  | 非空、无控制字符的显示名，只作界面内容，不参与授权判断。                                                                                                                                |
| `redirectUri`           | 一个精确绝对回调 URL，拒绝 userinfo、fragment、通配符、控制字符和路径规范化歧义；local 为显式端口的 literal `127.0.0.1` HTTP，deployment 为 HTTPS。保留合法的精确 query，不做模糊匹配。 |
| `postLogoutRedirectUri` | 同等 URL 验证，精确登记；不得从浏览器任意 return 参数派生。                                                                                                                             |
| `scopes`                | 非重复数组，必须包含 `openid`，仅允许当前已实现的 `openid`、`profile`、`email`。                                                                                                        |
| `clientSecret`          | 非空且无控制字符的秘密，保留已有有效值，不自动生成、轮换或限定为十六进制；本阶段只保留 confidential authorization-code client，不扩展 public client、其他 grant 或 refresh token。      |
| `integrationKey`        | 可选 64 位十六进制秘密；仅配置后授予现有内部会话接口的该客户端身份。不同客户端不得复用。                                                                                                |
| `revocation`            | 可选对象 `{ url, key }`；URL 是明确的受控会话撤销 endpoint，key 为 64 位十六进制。缺省表示只执行 Hydra 撤销，不请求应用通知。                                                           |

`revocation.url` 使用同样的 local/deployment 网络边界，保留实际 endpoint 路径，禁止 userinfo、fragment、query、规范化歧义与重定向跟随。该地址只来自可信根配置，不来自 HTTP 请求。

空清单仍要求身份服务的数据库、issuer 和 flow key 等基础设置有效，但不要求任何客户端秘密或文档配置；启动不创建默认应用。授权申请的 clientId 必须在清单中，空集合拒绝全部申请。测试用 probe 改为测试显式登记的普通客户端，不保留生产内建例外。

### 只读核验与显式登记

新增纯配置包 `packages/identity-config/`，以 `@workspace/identity-config` 导出无副作用的 `parseIdentityClients()` 与 `parseIdentityDeliveryTargets()`。包采用可被 Node 直接导入的 `src/index.mjs` 与配套 `src/index.d.mts`，不依赖 React、Fastify、数据库或运行编排。根运行脚本和 Server 引用同一验证实现，避免两份配置语义漂移；配置解析测试同时覆盖两个消费者。

运行脚本负责 Hydra 凭据核验与登记。秘密清单只投影给可信服务端和登记进程，禁止进入 Web 环境；日志脱敏将整个 `IDENTITY_CLIENTS_JSON` 与 `IDENTITY_OUTBOX_TARGETS_JSON` 视为秘密，不依赖子字段名字匹配。客户端 secret 不参与 Website 用户或内部接口鉴权。

保留 `verifyHydraClient()` 的只读性质，对每个配置项核对精确 clientId、redirect URI、post-logout URI、grant、response type、scope、client authentication method 和秘密有效性。继续使用随机无效 code 探测，预期为 `invalid_grant`，不能只相信 admin GET 中的指纹 metadata。缺失、冲突和网络不可达分别报告，不自动修正已有 client。

新增显式 `pnpm infra clients` 动作，幂等创建缺失 client，随后使用同一校验；已有配置或秘密冲突时失败，不覆盖或扩大权限。空集合为无需登记。保留现有 `authorization_code`、`code`、`client_secret_basic`、public subject，以及 60 秒 access/ID token 配置，不新增 grant、audience、CORS 或 logout 协议。普通 `dev/start` 不调用登记动作。

## 会话与撤销契约

保留 `AuthService` 的会话复核、锁顺序、停用事实与快照规则；保留所有 identity operation 及 HTTP 请求/响应形状。`IdentityClientId` 改为经过配置验证的字符串，不再是文档客户端字面量联合类型。

| 场景           | 必须维持的结果                                                                 |
| -------------- | ------------------------------------------------------------------------------ |
| 普通退出       | 当前本站会话及其绑定立即失效，只为受影响绑定保存撤销快照，不撤销其他设备会话。 |
| 停用/恢复      | 停用撤销账号已有会话；恢复只允许新登录，不复活旧会话。                         |
| 过期清理       | 继续为有效绑定建立撤销任务，未完成事件不能因清理或重试保留期消失。             |
| 晚到投递       | 使用原 sid/sessionId 和独立 eventId，不能以 userId 批量影响恢复后的新会话。    |
| 未配置目标     | 保持 pending 并输出固定错误码；不从当前应用或 issuer 借用地址、秘密。          |
| 无应用通知配置 | 只完成已明确配置的 Hydra 撤销步骤。不得据此声称外部应用获得实时强制退出能力。  |

将 worker 的 `deliverOutline` 改为通用应用撤销投递。固定消息仍为 `{ eventId, sessionId }`，使用 `X-Identity-Delivery-Key`，保留当前一秒超时、幂等和重试节奏；非成功响应、网络或解析失败不能标记投递完成。禁止跟随重定向，以免泄露投递密钥。

新应用投递结果标识使用 `app:<clientId>:<hydraSid>`，Hydra 标识继续为 `hydra:<clientId>:<hydraSid>`。旧 Outline 标识只由退役维护处理，不转换成新客户端的已投递证明。

保留 cleanup-only 的 `IDENTITY_OUTBOX_TARGETS_JSON`，仍为按 clientId 索引的对象；目标结构改为 `{ hydraAdminUrl, revocation? }`，网络与秘密验证同上。它只为已有事件提供原目的地，不进入 approvedClients 或内部调用方名单。与现役同名目标必须完全一致，否则拒绝配置；未知、缺失或未能安全映射的历史目标继续 pending。

## 身份绑定记录

部署 identity receipt 升为版本 2，固定 Website 实际数据库目标与核验库名、public origin、issuer、Hydra admin 目的地，以及按 clientId 排序的现役和 cleanup-only 目标、精确回调、scope、可用内部能力与各秘密的 SHA-256 指纹。文件不保存原始秘密。

固定结构为 `{ version: 2, websiteTarget, publicOrigin, issuer, hydraAdminUrl, clients, cleanupTargets, flowKeyFingerprint, bootstrapKeyFingerprint }`。`websiteTarget` 保留既有 host、port、user、database、verifiedDatabase。clients 每项包含 clientId、name、redirectUri、postLogoutRedirectUri、规范化 scopes、clientSecretFingerprint、可空 integrationKeyFingerprint 和可空 `{ url, keyFingerprint }` revocation；cleanupTargets 每项包含 clientId、hydraAdminUrl 及同形 revocation。两数组按 clientId 排序，scope 排序后投影，指纹基于秘密原始字符串。

运行时仍先核验 receipt，再启动 worker 或投递任务。改变 issuer、已有 client 的路由或秘密需要显式维护，不能用新配置覆盖旧记录。新空环境仅在显式 prepare 时建立记录。

已有版本 1 记录通过一次性维护转换：核对原 issuer、原 Website 数据库、原指纹及实际客户端状态后，仅移除精确退役的 Outline 项并建立 v2。出现其他未能对应的绑定、flow 或 pending 目标时停止转换，保留原记录；不能删除 receipt 后重建来绕过检查。local 保留原有资源和配置核验，不宣称这些静态检查构成部署验收。

## 数据保留与退役维护

不删除 `auth_oidc_flows`、`auth_oidc_bindings`、`auth_identity_outbox`、profile version、账号停用字段、sessionId 或其约束。不重写 migration SQL、journal 和快照。变更只涉及配置、实现和按 clientId 精确清理旧客户端状态，预期无需 schema migration。

新增一次性维护入口 `scripts/runtime/retire-outline.mjs`，缺省或 `--plan` 只读；`--apply` 只执行已核验计划。该工具不由普通 runtime 自动调用。固定退休客户端为 `ex-outline-local`、`ex-outline`；不能用前缀、`LIKE` 或 JSON 文本子串匹配其他客户端。

执行顺序具有约束：

1. 核对旧配置和所有实际连接目标；验证 `exre`、`hydra`、`outline` 实际库名与资源归属。记录原精确进程、容器、挂载和配置证明，停止旧 Outline 与身份 worker，避免清理与投递并发。
2. 按固定 clientId 从 Hydra 注销旧客户端。失败则保留可重试计划，不记录已清理；不删除 Hydra login session 来批量影响其他客户端，不重建 Hydra 数据库。
3. 在 `exre` 单事务内锁定相关 flow、binding 和 outbox。删除两个客户端的 flow/binding。逐条解析完整 outbox 快照，仅移除精确属于这两个客户端的 target 及其结果标识；混合事件保留其他 target、原 eventId、重试与完成状态。只含退役 target 的事件删除，记录为退役丢弃，不能伪造成功投递。遇到无法解析、无法精确归属的快照则回滚该事务并报告。
4. 清理已核验 Outline 进程、Redis 容器与专属卷、附件和缓存，以及独立 `outline` 库；专属角色无其他对象使用时才可删除。存在性不足或归属不明时保留并报告，不能按名称推断删除。
5. 保留 PostgreSQL 容器、`pgdata` 卷、Hydra 容器/进程和 `hydra` 库，以及全部 Website 数据。调整现役资源记录前再次比较保留资源的 exact ID 和完整配置；变化则中止，不能用新现场刷新证明或自动接管同名资源。
6. 清理根配置中的退役项，保留现役值；完成需要的 receipt 转换后启动新 Website/worker，验证 Hydra 和 Website readiness。

数据库操作与 Docker/文件删除不构成跨系统事务。计划记录各目标的已完成步骤，重跑必须重新核验并跳过可证明完成的动作；失败不自动重建数据库或资源。不输出账号凭据、客户端秘密、原始环境文件或用户资料。

其他工作树可能使用同一开发资源。实际计划必须证实资源只属于本次退役目标；不能为了通过当前工作树的检查停止或删除其他工作树的进程和数据。没有旧配置或资源证明时可完成源码交付，但实际资源清理必须报告为未执行或被具体证据阻塞。

## 工程和 UI 变化

| 位置                                                             | 变化                                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/styles/website-theme.css`                          | 从固定子模块 revision 迁回主站品牌覆盖，保持值、作用域与导入顺序。                                                                            |
| `apps/web/src/App.tsx`、`packages/components/src/SiteHeader.tsx` | 增加 `/docs` 与 `/docs/` 建设中页；使用内部路由；旧 Docs 子路径进入现有 404。                                                                 |
| `apps/web/src/pages/IdentityPage/`                               | 保留 OIDC 页面与安全退出确认，改为通用文案和首页返回；删除 Outline iframe status、Docs returnPath/resume 工具及专属测试。                     |
| `scripts/runtime/`                                               | 接回进程监督、公共 readiness、工具发现与 Hydra client 管理；拆除所有 Outline 构建、测试、监听、启动和 bootstrap 分支。                        |
| `compose.yaml`、`infra/runtime/`                                 | 保留 PostgreSQL/Hydra 镜像与服务，删除 Redis 和 Outline 项；保留 Hydra public 白名单及 admin 不公开的边界。                                   |
| Vite、本地 gateway、Nginx                                        | 删除 Docs static、附件、HTTP/WS 转发；保留 Website API、身份流、SPA fallback、内部路径拒绝、转发信任和上传限额。                              |
| 根包与 workspace                                                 | 移除子模块登记、Outline 排除项和 Yarn 专属要求；只删除确认没有其他消费者的依赖。                                                              |
| `.github/workflows/ci.yml`                                       | 删除递归子模块检出和 Outline Yarn 安装，保留 pnpm、Node、SDK 生成依赖、Contract/typecheck/build/test 以及现有 `ci-gate`；不降低身份测试范围。 |
| 当前工程文档                                                     | 同步 README、AGENTS、`.ai/` 的实际架构和运行说明；历史文档及迁移作为历史保留。                                                                |

`pnpm service:*` 继续管理 PostgreSQL/Hydra；`pnpm dev/build/test/start/stop/logs` 保留现有职责并移除文档项。`pnpm infra init/migrate` 只处理 Hydra 的显式准备，`pnpm infra clients` 负责明确的客户端登记，删除 Outline 管理员 bootstrap。`db:*` 仍只维护独立 `exre`。

品牌样式、主题 reconciliation、共享 Tiptap/Fumadocs 和通用存储有现役用途，不随文档应用一起删除。保留 `.env.local` 为 runtime 的根配置源及进程变量优先规则；Build 不连接数据库或启动 Docker。

## 落地顺序和停止条件

1. 迁回样式与通用工具，加入建设中页面，验证主站基础行为。
2. 实现独立身份配置、通用 Hydra client 核验/登记和空集合行为；完成 OIDC、内部鉴权和 outbox 回归验证。
3. 实现 receipt 转换和一次性退役维护，先完成只读计划与精确匹配测试。实际维护必须在丢弃旧资源证明前执行。
4. 简化运行编排、配置、代理、构建与测试入口，再移除 Outline gitlink 和专属目录。保留已存在的 Git 对象供其他工作树使用。
5. 同步当前文档，完成自动检查、本机运行与浏览器验收，分别报告结果。

任何一步发现第三方认证、普通登录、SSO、Hydra issuer 或非退役客户端被破坏，停止继续删除并修复。实际资源归属无法核验时停止该资源维护，不以删除证明或重置库作为恢复手段。

## 验证与验收证据

| 层次     | 核验内容与现有入口                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 配置     | `tests/auth/identity-config.test.ts`、`scripts/runtime/settings.test.mjs`：空集合、重复 clientId、非法 URL、缺失秘密、权限投影、现役与 cleanup-only 隔离。                                                            |
| 协议     | `tests/auth/oidc.test.ts`、`tests/contract/identity.test.ts`：精确回调/scope、未知客户端拒绝、flow 重试、相同 session 与 sid 校验；七个 operation 的 HTTP 和原始 handler 输出继续覆盖。                               |
| 会话     | `tests/auth/identity.test.ts`、`disable.test.ts`、`outbox.test.ts`：跨客户端/跨设备隔离、停用恢复、快照、晚到投递、配置缺失保持 pending、Hydra-only 与应用通知模式、超时和幂等。                                      |
| 维护     | 新增退役维护行为测试：其他 clientId 及混合 outbox 不受损、畸形快照整事务回滚、重复执行、错误数据库/资源归属拒绝、保留 PG/Hydra proof 和 receipt 转换拒绝未知目标。使用临时 PostgreSQL与可控资源适配器，不连接开发库。 |
| 编排     | `tests/dev/entry.test.ts`、`proxy-boundary.test.ts`、runtime 原生测试：缺少 Outline/Redis 仍能构建启动；不隐式登记/迁移；内部接口拒绝和代理预算保留。                                                                 |
| 自动检查 | 依次执行 `pnpm api:lint`、`pnpm api:generate`、`pnpm api:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`。依赖产物的 build/typecheck 不并发；Testcontainers 无 Docker 时明确失败。                                |
| 本机运行 | 验证 PostgreSQL/Hydra、Website readiness、零客户端启动，以及独立隔离客户端的完整授权码流程；记录真实资源清理各项结果。                                                                                                |
| 浏览器   | Docs 导航、两个根路径、深链 404、刷新、匿名/登录、桌面/移动端、明暗主题；普通登录退出、SSO、身份确认页与品牌样式。                                                                                                    |
| 外部验收 | 第三方 provider 和其他应用真实登录按实际接入状态报告。测试客户端和本机浏览器通过不表示 provider、其他应用或公网部署验收通过。                                                                                         |

退役目录中的工具若被迁移，更新测试位置和根清单；不要删除其断言来规避回归。CSS `outline`、UI variant、历史迁移和历史设计中的同名文本不属于退役残留。

## 风险与恢复

| 风险                               | 检测与处置                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| 保留 Hydra 但配置仍强制 Outline    | 零客户端启动、无子模块构建及 OIDC 独立测试必须通过。                                   |
| 新客户端配置扩大权限               | 精确 allowlist、保留既有 grant 和 scope 边界、拒绝非法 URL；不增加公开注册。           |
| 删除或错误完成其他客户端撤销事件   | 精确 JSON 匹配、事务回滚、混合事件及晚到投递测试；未知目标继续 pending。               |
| 投递密钥泄露                       | 只接受可信配置地址、禁止重定向、服务端环境隔离、整项秘密配置脱敏；日志只含固定错误码。 |
| issuer 或目的地错配                | 维持 receipt 核验与显式转换；失败禁止 worker 投递。                                    |
| 主站样式、会话安全或运行工具被误删 | 先迁回资源与公共能力，保留认证测试并做真实浏览器验收。                                 |
| 误删共享数据或绕过资源归属         | 实际数据库名、exact ID、配置和挂载核验；保留 PG/Hydra，禁止整套卷删除与 proof 刷新。   |

源码回滚可以恢复旧 gitlink 和代码；新的客户端注册配置需要显式恢复对应配置，不能回退后覆盖或撤销新客户端。Hydra 与 Website 数据不删除，是身份能力恢复的基础。

专属 Outline 数据库、Redis 卷、附件和客户端状态删除后不能靠 Git 恢复；用户已接受无文档、未上线的直接退役，不承诺恢复旧文档系统。任何与现役身份无关的删除失败不触发账号重置、密钥轮换或基础卷重建。

## 未决项与验收边界

无待用户决定的产品范围或接口选择。实际旧资源的存在性、归属及其他客户端记录必须在只读计划阶段核验，这是执行前置证据，不能由设计假定完成。

本 RFC 只完成设计交付；实现、自动测试、数据库维护、资源清理和真实浏览器均需后续执行。当前阶段不部署上线。
