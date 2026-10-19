# RFC：本地集成环境、Outline 子仓库与 /docs 子路径

状态：架构预审已通过，实施中；实现审查与运行验收尚未完成。

日期：2026-09-30。来源：`.notes/archive/docs-integration/specs/2026-09-30-docs-integration-design.md`。本文使用 Website 根目录路径，Outline 接入位置为 `apps/outline/`。

## 决策与边界

根目录提供完整容器和宿主机热更新两种运行模式，共用入口、数据库及文件存储契约。Outline 作为 `apps/outline/` Git submodule；ExUI 继续链接本地源码，通过固定的仓库内忽略路径适配宿主机与容器。所有 Outline 外部地址保留 `/docs`。

本 RFC 可独立验收构建、路径与持久化；统一登录依赖 `.notes/archive/docs-integration/rfcs/identity-and-session-lifecycle-rfc.md`，最终公开目录依赖 `.notes/archive/docs-integration/rfcs/outline-public-access-rfc.md`。环境完成不代表业务集成完成。仅本地开发，不提供公网部署承诺。

## 实施前源码基线

- Website 使用 pnpm 11.9.0，`pnpm-workspace.yaml` 当前包含 `apps/*`；Website Server 使用独立 `exre` PostgreSQL。
- Outline 使用 Yarn 4.11.0，现有 remote 为 `git@github.com:caep-dev/ex-outline.git`。实施前复核 remote 和可取得的提交，不将未提交修改当成 submodule 引用。
- Outline `Dockerfile.base` 构建源码，`Dockerfile` 从基础镜像复制产物，Node 基线为 26.3.0；现有 Compose 只定义 PostgreSQL 和 Redis。
- Website 的两个 ExUI 消费包使用外部目录 `link:`，Outline 使用 `portal:`。ExUI 的 tokens 和组件按顺序构建，存在根 `watch` 命令。
- Outline API、history、静态文件、SW、事件连接 `/realtime` 和编辑连接 `/collaboration` 存在根路径假设。

## 文件与版本归属

以下均为拟新增或调整，不是已存在命令：

| 路径                                                      | 责任                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `.gitmodules`、`apps/outline/`                            | fork remote 和经过联调的 submodule 提交                         |
| `pnpm-workspace.yaml`                                     | 保持现有包，增加 `!apps/outline` 排除                           |
| `compose.yaml`                                            | PostgreSQL、Redis、Hydra、gateway 和持久化声明                  |
| `compose.full.yaml`、`compose.dev.yaml`                   | 完整模式应用容器；开发模式宿主机上游和端口暴露                  |
| `infra/docs-integration/`                                 | gateway、Hydra 模板、镜像版本记录及初始化配置模板               |
| `scripts/docs-integration/`                               | 配置检查、显式初始化/迁移、两模式启动与停止封装                 |
| `Dockerfile`、`.dockerignore`                             | Website/ExUI 多阶段构建及前端、Server target                    |
| `apps/outline/Dockerfile`、`apps/outline/Dockerfile.base` | 定制 Outline 构建和运行产物，禁止默用未经本地构建的官方应用产物 |
| `vendor/exui/`                                            | 忽略的本地目录链接，不纳入版本控制或 pnpm workspace             |
| `.local/docs-integration/`                                | 忽略的配置、模式锁和运行记录；不存入镜像                        |

submodule 接入创建独立 checkout，不移动或删除原 Outline 目录。需要纳入其现有修改时，先识别改动归属，再由正常交付流程选择提交；本 RFC 不授权提交这些修改。Website 和 Outline 的提交与引用更新分别进行。

固定 Hydra 协议基线为 `oryd/hydra:v2.3.0`，其 API 已按该 tag 核对；它是本设计选定基线，不声称是最新或已完成安全审计。PostgreSQL 使用 16 系列，Redis 使用 7.4 系列，gateway 使用 Nginx 1.28 系列，Node 使用 Outline 已有 26.3.0 基线。首次实现时解析精确镜像摘要并记录到 `infra/docs-integration/images.lock.json`，Compose 使用该锁定结果；未取得实际摘要前不填造摘要。更新任何镜像需重跑相应兼容性用例。

## ExUI 链接与构建

本地配置键 `EXUI_SOURCE_DIR` 指向用户实际 ExUI checkout。配置命令在核验目录后建立 `vendor/exui/` 的 Windows junction 或 POSIX symlink；既有链接指向不同目标时停止并说明，不覆盖真实目录。

三个消费者的依赖指向固定布局：Website `apps/web/` 和 `packages/components/` 使用 `link:../../vendor/exui/packages/components`；Outline 使用 `portal:../../vendor/exui/packages/components`。包管理器生成对应锁文件，不手改 resolution。这些固定相对路径也在容器构建树中成立。

容器构建根为 `/workspace/website`；额外 `exui` context 复制到 `/workspace/website/vendor/exui`。按 ExUI 自身 pnpm 锁文件安装 Linux 依赖，先构建 `@exre/exui-tokens`，再构建 `@exre/exui`，随后分别安装/构建 Website 与 Outline。宿主机的 node_modules、dist、秘密、旧输出不作为容器构建输入。

Compose 使用 `additional_contexts`，最低支持该能力的 Compose 2.17；启动前检查 builder 支持，而非静默忽略。依据：[Compose Build Specification](https://docs.docker.com/reference/compose-file/build/#additional_contexts)。

Outline runtime 如保留 portal 依赖，必须保留解析所需的 ExUI 产物及包元数据，不能只复制悬空 symlink。Website 静态前端打包后不挂源码；Server 只带运行所需产物。构建探针在最终镜像内验证各运行入口和依赖解析。

开发模式由 `scripts/docs-integration/watch-exui.mjs` 监听 ExUI tokens/components 的 src/scripts，规范化原生事件的相对或绝对文件名，忽略生成的 `packages/tokens/src/style.css`，顺序执行原包同一 pnpm build。适配器先构建 tokens/组件再等待源码变化，仅管理自身启动的子进程，不修改外部 ExUI checkout。消费者对解析后的 ExUI dist 路径开放文件访问并触发 reload。只消费 Outline 已在使用的 tokens/style 入口，不借此引入 React 19 组件或升级 Outline React。Website 延续 React dedupe，避免外部源码链接产生重复 React。

## 网络与两个运行模式

本地选定两个名称，显式配置宿主机解析到 `127.0.0.1`：

| 公共地址                              | 作用                                                      |
| ------------------------------------- | --------------------------------------------------------- |
| `http://exwebsite.test:8090`          | Website 及 `/docs`                                        |
| `http://identity.exwebsite.test:8090` | 固定 Hydra issuer，协议走根路径，避免嵌套 issuer 路径适配 |

gateway 容器监听 8090，宿主机仅发布 `127.0.0.1:8090`；Compose 网络中给 gateway 配置相同 DNS aliases。两种模式均使用这一 issuer，不能让容器用另一个 issuer 字符串。初始化检查并提供 hosts 配置步骤，不静默修改系统 hosts。

完整模式：web 静态容器、server:8080、outline:3000、hydra:4444/4445 仅在集成网络互通。开发模式：Website Vite 8081、Server 8080、Outline 后端 3100、Outline Vite 3001 在宿主机运行，gateway 上游使用 `host.docker.internal`。Docker 到宿主机的访问不能依赖只监听 127.0.0.1 的应用；集成开发配置显式监听可达接口并限制 Windows 防火墙来源为本机/Docker 网络，普通 `pnpm dev` 保持现状。

开发模式单独发布 PostgreSQL `127.0.0.1:16432`、Redis `127.0.0.1:16379`、Hydra admin `127.0.0.1:14445`。数据库、管理端口不代理到公共 gateway。完整模式不需要这些宿主机管理端口。

本地使用 HTTP 和 Hydra 开发模式，仅用于本地验收；Cookie 不设置域共享，名称隔离，SameSite=Lax。本 RFC 不把本地配置提升为公网 TLS/安全配置。

## 路由与路径实现

| Host / 路径                                         | 上游                      | 规则                                                                           |
| --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| Website `/api/*`                                    | Website Server            | 保留 `/api`；拒绝公共访问 `/api/internal/*`                                    |
| Website `/docs`                                     | gateway                   | 规范化到 `/docs/`，保留 query                                                  |
| Website `/docs/*`                                   | Outline                   | 仅此处剥离一次 `/docs`；保留 query 与 WebSocket upgrade                        |
| Website `/docs/static/*`                            | Outline 构建资源或其 Vite | 完整模式剥 `/docs`；开发模式定向 3001 并保留 `/docs/static`，与 Vite base 一致 |
| Website `/docs/realtime/*`、`/docs/collaboration/*` | Outline 后端              | 含 polling、upgrade，内部仍使用原 `/realtime`、`/collaboration`                |
| Website 其他页面、身份适配 UI                       | Website Web               | SPA fallback；禁止覆盖 `/docs` 和 `/api`                                       |
| Identity 公共 OIDC 路径                             | Hydra public              | 原样路径；仅允许选定协议路径，不转发 `/admin`                                  |

引入 Outline 集中 `publicPath()`/`publicUrl()` 工具：`URL` 配置为完整 `http://exwebsite.test:8090/docs`，`BASE_PATH` 从 URL pathname 校验得到 `/docs`，内部 Router 路径继续根相对。客户端 history 使用 basename，所有应用内路由仍使用逻辑路径；API base 和外部资源 URL 则显式加前缀，禁止重复加 `/docs/docs`。

HTTP 与 WebSocket 在代理边界统一剥前缀，避免一套服务端 route prefix、另一套 upgrade 手动路径互相冲突。Outline 输出的 Location、表单 action、编辑器附件 URL 和 canonical 必须用 public URL 工具，不能靠代理 HTML 文本替换。

SW 注册 `/docs/static/sw.js`，scope 为 `/docs/`，响应明确允许该 scope。仅 precache 静态资源，关闭当前 API/附件运行时缓存；升级时删除 Outline 旧缓存，不删除 Website cache。普通事件连接、编辑协作与 HMR 均使用独立的公共路径配置。

Cookies（包括原 accessToken、OAuth state、lastSignedIn）集中设置/清理到 `/docs`；最终会话 Cookie 按身份 RFC 改名为 exdocs_access，前后端读取方式同步改造。HTTP 集成环境的可读 CSRF Cookie `csrfToken` 同样使用 `/docs`。唯一例外是 HTTPS 的 `__Host-csrfToken`：浏览器前缀规则要求它具有 `Secure`、无 `Domain` 且 `Path=/`，继续保留其 host-only 防护，不能改为 `/docs` 而导致浏览器拒收；代理必须可信地传递 HTTPS 状态。集成会话 Cookie 的非安全方法要求 Origin 精确匹配公开站点及签名双提交，四个匿名只读 public RPC 精确豁免；同源本地附件 XHR 上传也必须提交 CSRF token，跨域对象存储请求不得携带该 token。登录回调固定 `/docs/auth/oidc.callback`。禁止从不可信转发头计算公开域名，gateway 覆盖转发头并限制 Host。

统一入口还必须拒绝 `/docs/internal/*`，供 Website 向 Outline 投递撤销的接收器仅走内网。Identity Host 允许 discovery、JWKS、授权、token、userinfo、revocation、logout 的已登记协议路径；其余路径拒绝。这不是把任意客户端请求转发到 Hydra admin 的通用代理。

## 初始化、存储与操作契约

拟新增根命令：

| 命令                                                                 | 行为                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm integration:configure`                                         | 校验 ExUI 和 submodule、生成本机配置及目录链接；不创建数据库                            |
| `pnpm integration:init`                                              | 显式启动基础设施、创建本集成独立数据库/角色、应用三方 migration；不接入或重置旧本机库   |
| `pnpm integration:bootstrap -- --admin-user-id <id>`                 | 按另两份 RFC 创建 Hydra 客户端和唯一文档工作区                                          |
| `pnpm integration:up`                                                | 以完整模式启动；结构未初始化时失败并提示 init                                           |
| `pnpm integration:dev`                                               | 基础服务加宿主机应用与仓库内 ExUI integration watcher；以统一入口访问                   |
| `pnpm integration:migrate`                                           | 显式执行各服务 migration；打印目标身份，不打印秘密                                      |
| `pnpm integration:down`                                              | 停止当前模式，不删除 volumes 或本地文件                                                 |
| `pnpm integration:test:outline <server-test-file> "<case-name>" ...` | 每个明确用例创建独立 PostgreSQL/Redis 容器，显式 migration 后执行；不读取既有测试库连接 |

模式锁记录进程/Compose 项目身份；启动另一模式时检查实际存活情况，避免 stale lock 永久阻塞。初始化不调用 Website `db:reset`；其回环和数据库身份限制不为容器方便而放宽。

Outline 服务端 SQL 测试不能直接沿用 `.env.test` 中的本机连接。隔离测试入口仅接受一个明确的 `server/**/*.test.ts` 或 `plugins/**/*.test.ts` 文件和一个或多个字面用例名；每个用例分别创建新 PostgreSQL 与 Redis 容器，清除继承的数据库、Redis 和身份服务连接及凭据，使用独立本地附件目录，再显式迁移。入口核对数据库身份，禁止忽略未处理异常，并要求 JSON 报告中恰好一个指定用例通过，结束时关闭本次创建的容器；不执行整套 Outline 测试，也不重置既有库。

本集成 PostgreSQL 默认使用独立新卷，创建 `exre`、`outline`、`hydra` 和独立角色。它不会复制原本机 Website 数据；需要已有账号时先在新集成实例按现有注册流程建号，或后续单独执行经核对的导入。实际初始化前必须显示新实例目标，不能误认为对旧库迁移。

数据库/Redis 使用 named volumes。Website 头像和 Outline 本地附件分别使用 `.local/docs-integration/data/avatars/`、`.local/docs-integration/data/outline/`，完整模式 bind mount、本机模式直接使用同一目录，路径可配置且分别验证。现有 Website 默认头像路径通过新增显式配置替换，不靠复制旧目录。旧头像保留；COS/通用内容存储现有配置保持自身边界。

Outline 初始化使用 `yarn db:migrate`。已核实 `apps/outline/server/scripts/checkMigrations.ts` 默认执行 pending migration，存在 `--no-migrate` 检查分支；两种模式的全部 Outline 服务启动均必须传入该参数，并验证 watch 重启后的子进程仍保留它。Hydra 初始化显式 `migrate sql`，服务启动不得捎带迁移。bootstrap 前拒绝 Outline 已有非本集成初始化标记的数据，避免把旧工作区改成新集成。

## 验证、风险与回滚

验收源规格 E01–E04，之后配合 E05–E16。独立验证包括：无外部 ExUI 时给出明确失败；两个最终镜像能解析依赖；pnpm workspace 列表不含 Outline；gateway 拒绝未知 Host/admin；宿主与容器 issuer discovery 一致；深链接/SW/两类 socket/HMR 路径正确；切换模式后文件及数据库不丢失。

主要风险：Windows 文件监听不触发（用 ExUI dist 变化实测）；路径重复前缀（列举重定向与编辑器 URL 测试）；container→host 不可达（启动前探测）；portal 运行镜像悬空（镜像内 import 检查）；镜像资源消耗过高（记录实际峰值后调整，不编造容量）。不以 healthcheck 代替真实登录和协作验收。

落地顺序：submodule/链接布局 → 镜像和基础服务 → 路径工具与代理 → 两种模式验证 → 另外两份 RFC。回滚先停止新模式，恢复 Website 配置和 submodule 引用，保留新卷与文件；回旧应用版本前确认数据库向后兼容，不能自动 down migration。恢复旧 checkout 不移动原目录、不删除其他人的修改。

未决产品选择：无。实施时需解析镜像摘要、选择已提交 Outline 引用并提供本机 ExUI 路径；这些是执行输入，不授权降低已批准范围。当前验证仅为源码/规范审阅，镜像构建、Compose、hosts 和浏览器运行均未执行。
