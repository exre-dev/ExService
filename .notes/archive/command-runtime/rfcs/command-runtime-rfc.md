# RFC：统一开发命令、根环境配置与后端镜像部署

状态：待实施；源设计已获用户确认，RFC 已完成作者自检，未经过独立评审。

日期：2026-10-05

模块：`.notes/command-runtime/`

依据：`.notes/command-runtime/specs/2026-10-05-command-runtime-design.md`。本 RFC 保留原 spec，不修改其内容。

## 1. 决策摘要

根日常命令收敛为 `start`、`dev`、`build`、`stop`。依赖容器持续独立运行，开发监督器只拥有本次应用进程。首次准备动作合并到 `infra` 分发入口。根 `.env.local` 是新的人工配置来源，已有环境通过显式导入保持原数据库、秘密、卷和准备阶段。

服务器 Website 后端、定制 Outline 和 Hydra 使用独立部署 Compose；Website 静态前端独立托管。新增严格的 deployment 身份配置分支，解除旧 8090 布局对服务器域名的限制，保留旧布局验证与精确 client/callback 授权。

## 2. 目标、约束与证据

可验收目标：根 `start` 不运行应用或迁移；根 `dev` 不启动或停止容器；Ctrl+C 后依赖保持运行；根 `stop` 不删除数据；根 `build` 包含 Outline；导入配置保持已有账号和数据可用；服务器镜像不依赖宿主机 Node、真实环境文件或 Windows `node_modules`。

不包含业务 HTTP schema 变更、账号数据搬运、密钥轮换、重置数据库、自动指定管理员、实际公网部署、提交或推送。

| 已核对来源                                                                                                                    | 约束                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `package.json`、`apps/server/package.json`                                                                                    | 根工具别名可删除，但 Server SSO/账号操作保留；根现有 build 没有完整 Outline。        |
| `scripts/docs-integration/local-dev.mjs`、`scripts/docs-integration/foundation.mjs`、`scripts/docs-integration/ownership.mjs` | 当前 dev 启停依赖；精确容器/卷/进程 proof、跨模式 mutex 和失败恢复不能绕过。         |
| `scripts/docs-integration/local-config.mjs`                                                                                   | v1 指纹为配置及文档秘密的摘要，Docker labels 和 prepared/run receipts 依赖该指纹。   |
| `compose.local-dev.yaml`、`infra/docs-integration/postgres/init-local.sh`                                                     | local PostgreSQL 专用于 Outline/Hydra，明确拒绝包含 `exre`。                         |
| `apps/server/src/identity/config.ts`、`apps/outline/server/identity/config.ts`                                                | 仅接受 local/dev/full，非 local 布局固定 8090，不能直接用任意服务器域名。            |
| `apps/outline/vite.config.ts`、`apps/outline/server/presenters/env.ts`、`apps/outline/shared/env.ts`                          | `/docs/static/` 是集成资源前缀；浏览器公开环境由服务端 HTML 提供；构建不能引入秘密。 |
| `apps/outline/server/utils/environment.ts`                                                                                    | 自动加载包内环境文件，集成启动需要防止旧包内配置填补未注入的键。                     |
| `apps/server/src/app.ts`、`apps/server/src/db/migration-runner.ts`、`Dockerfile`                                              | 后端运行需要 Contract 和运行依赖，迁移需要 migration 文件；产物不是独立静态 JS。     |
| `vitest.config.ts`、`scripts/docs-integration/local-dev.test.mjs`                                                             | Website Vitest 不收集 scripts 的 node:test 或 Outline；验收必须分别执行。            |

实施前继续读取各模块 `.ai/` 和 Outline 子仓库的实际指令；仓库若新增 `TESTING.md`，先读取再测试。当前根目录不存在该文件。

## 3. 模块与接口

建议新增 `scripts/runtime/` 作为根入口适配层，复用已有受控基础模块：

| 拟新增模块                          | 责任                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `scripts/runtime/configuration.mjs` | 读取、校验根配置，生成按服务划分的环境映射与 target/fingerprint。                         |
| `scripts/runtime/command.mjs`       | 严格解析 start/stop/infra 动作；不自行实现数据库业务。                                    |
| `scripts/runtime/dependencies.mjs`  | start/stop 生命周期、独立依赖 receipts 和归属检查，复用 Foundation。                      |
| `scripts/runtime/server.mjs`        | Website 包入口，按操作映射根配置后启动 server 或显式 CLI，避免再次加载包内 `.env.local`。 |
| `scripts/runtime/build.mjs`         | 无数据库连接的完整构建，分别在根和 Outline cwd 调用原包管理器。                           |

旧 `scripts/docs-integration/command.mjs`、legacy 编排和恢复证据保留，退出正常根命令表；内部恢复仍能按原 mode 处理历史资源。不要复制 Foundation 或另建仅按容器名授权的生命周期实现。

新配置接口是纯函数，概念签名如下，名称是拟议内部契约，不是 HTTP API：

```ts
readRuntimeConfiguration({ workspace, inherited, profile }): RuntimeConfiguration
environmentsFor(configuration, service): Record<string, string>
validateReceipt(configuration, receipt): VerifiedReceipt
startDependencies(configuration, dependencies): Promise<void>
stopDependencies(configuration, dependencies): Promise<void>
```

纯配置读取不连接数据库、不写文件、不启动 Docker。副作用由相应命令在取得 mutex 后执行，runner/clock/process inspection 可注入以验证失败路径。

## 4. 命令契约

根 scripts 最终公开 `start`、`dev`、`build`、`stop`、`infra`、`api:lint`、`api:generate`、`typecheck`、`test`、`db:migrate`、`db:reset`。

| 命令                                     | 前置条件                                                                    | 允许的副作用                                          | 禁止的副作用                                     |
| ---------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `start`                                  | root 配置有效，已初始化文档目标和受管卷，Docker 可用                        | 启动 postgres/redis/hydra，写依赖归属 journal         | 启动应用、构建、迁移、创建 client/admin          |
| `dev`                                    | bootstrap-ready，依赖已运行且真实 schema/client/issuer 就绪，应用工具链完整 | 启动 Website Server/Web、Outline，写应用 run journal  | Docker create/start/stop，迁移、修复准备阶段     |
| `stop`                                   | 无活跃应用或准备命令，依赖归属可证                                          | 停止受管依赖，写已证实 stopped 状态                   | 终止应用、删除卷、删除附件、停止未知资源         |
| `build`                                  | 两套应用依赖与 ExUI 产物完整                                                | 构建输出及原工具规定的生成资源                        | Docker 启动、数据库连接、迁移、账号初始化        |
| `infra configure`                        | root 配置有效、工具和原 Website 数据源可核验                                | 保存配置 receipt；新安装可生成缺少的文档秘密          | 覆盖已有秘密、创建 Website 数据库                |
| `infra configure --import-existing`      | 旧完整 local 配置/秘密存在，旧 owner 及 children 已退出                     | 显式导入、验证并转换配置 receipt                      | 采样当前容器反造旧授权、轮换秘密、静默合并不同值 |
| `infra init`                             | configure-ready，资源可证或全新空目标                                       | 显式准备 Outline/Hydra、迁移并构建必要 Outline server | 创建 exre、创建 Website 账号、隐式 bootstrap     |
| `infra migrate`                          | 已核验 local 目标与依赖                                                     | 仅 Outline/Hydra 显式迁移                             | 迁移 Website、reset                              |
| `infra bootstrap --admin-user-id <UUID>` | init-ready、指定已有 active 账号                                            | 原受控 bootstrap/client 注册及必要临时 inspect        | 选择或创建账号、恢复已撤销的管理员角色           |
| `infra test`                             | 专项测试工具可用                                                            | 调用已有隔离 Outline 测试入口                         | 使用本机开发业务数据库作为夹具                   |

入口剥离一个 pnpm 转发的 `--`，严格拒绝未知 action、重复 flag、缺值和多余位置参数。新日常入口不接受 `--mode dev/full`；旧 CLI 的恢复 mode 不更名、不自动映射到新部署环境。帮助和错误提示显示当前根命令。

四个 SSO/账号操作仍留在 `apps/server/package.json`，参数与业务语义不变；其配置读取经 Website entry adapter 统一到根 `.env.local`。db 两个根命令同样使用该适配器，保留原显式 reset 确认和目标检查。

## 5. 根配置 schema 与环境分发

新增 schema `RUNTIME_CONFIG_VERSION=2`，部署选择 `RUNTIME_PROFILE=local|deployment`。根 start/dev/stop 明确要求 local；服务器 Compose 明确使用 deployment。旧 identity mode 仍作为内部兼容值存在，不作为日常选择。

有效配置值优先级：调用方明确传入的受支持进程变量 → 根 `.env.local` → 文档化的非秘密 local 默认值。空值按各变量契约处理，不能用真假判断把显式空值误当缺失。环境文件用 Node 环境解析器读取，不执行 shell 展开，不进行递归变量替换。

拟议根配置键如下：

| 键/组                                                                | 契约                                                                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `RUNTIME_CONFIG_VERSION`、`RUNTIME_PROFILE`                          | 必须为支持版本和明确 profile，不推断 profile。                                                                     |
| `DATABASE_URL`                                                       | Website 原连接串，路径为 `exre`，保留其连接参数和凭据；真实连接身份沿用 Server 验证。                              |
| `AUTH_CODE_HMAC_KEY`、原 storage/COS 配置                            | 按当前 Server parser 校验，不生成或替换已有业务秘密。                                                              |
| `PUBLIC_ORIGIN`                                                      | 无 credentials/path/query/hash 的 origin；local 为精确回环 HTTP，deployment 为 HTTPS。                             |
| `HYDRA_PUBLIC_URL`                                                   | 精确 issuer 根 URL，local 为回环 HTTP，deployment 为 HTTPS；不从请求 Host 派生。                                   |
| `LOCAL_PUBLIC_PORT`、`LOCAL_WEB_PORT`、`LOCAL_API_PORT`              | 默认 8080、8081、8082。                                                                                            |
| `LOCAL_OUTLINE_PORT`、`LOCAL_OUTLINE_VITE_PORT`                      | 默认 3102、3101。                                                                                                  |
| `LOCAL_POSTGRES_PORT`、`LOCAL_REDIS_PORT`                            | 默认 17432、17379。                                                                                                |
| `LOCAL_HYDRA_PUBLIC_PORT`、`LOCAL_HYDRA_ADMIN_PORT`                  | 默认 14444、14447。                                                                                                |
| `POSTGRES_PASSWORD`、`OUTLINE_PASSWORD`、`HYDRA_PASSWORD`            | 沿用现有秘密格式和 owner 规则；独立文档 PG 不包含 exre。                                                           |
| 其余现有 `secretNames`                                               | 沿用 `scripts/docs-integration/local-config.mjs` 的精确清单和 64 hex 校验；显式 configure 只在全新安装补齐缺少值。 |
| `OUTLINE_STORAGE_DIRECTORY`                                          | local 导入既有附件绝对路径，默认原 local data 路径；必须由配置明示，不能依赖子进程 cwd。                           |
| `SERVER_AVATAR_DIRECTORY`、原本地上传配置                            | 保留已有目录，公开 URL 按原规则配置或派生；不移动文件。                                                            |
| `IDENTITY_OUTBOX_TARGETS_JSON`                                       | 保留当前严格 schema，显式导入完整历史 cleanup targets，不扩大 approvedClients。                                    |
| `VITE_API_BASE_URL`                                                  | 唯一 API 构建地址，默认 `/api`；后端密钥不得以 VITE 前缀进入 Web。                                                 |
| `INTEGRATION_NODE_BIN`、`INTEGRATION_COREPACK_JS`、`EXUI_SOURCE_DIR` | 沿用现有显式工具覆盖，只用于构建/应用准备，不作为依赖启动所需条件。                                                |

local 九个端口均为 1024–65535 的整数、互不重复。`PUBLIC_ORIGIN` 和 issuer 必须与对应 local 端口一致。原 `INTEGRATION_*` 等派生变量若由调用方提供，则只作为断言：与新配置不同即拒绝，不作为第二份 authority。

deployment 使用显式服务地址：`HYDRA_ADMIN_URL`、`WEBSITE_INTERNAL_URL`、`OUTLINE_INTERNAL_URL`、`OUTLINE_DATABASE_URL`、`HYDRA_DATABASE_URL`、`OUTLINE_REDIS_URL`。内部地址可以使用容器 DNS/私有网络 HTTP，不能从公开 origin 自动猜测。数据库名仍分别为 exre/outline/hydra。

`environmentsFor` 按精确键清单输出：

- Website：自己的数据库、HMAC、存储/COS、监听/公开地址及其需要的 identity keys/targets。
- Outline：独立 DATABASE_URL、REDIS_URL、自己的秘密、文件存储及经验证的 Website/OIDC 配置。
- Hydra：自己的 DSN/system secret 和 issuer/login/consent/logout 地址。
- Web：公开 API/开发代理/HMR 变量，不接受 root 数据库、HMAC、COS 或 identity secrets。
- 构建：公开构建配置和非秘密工具变量，不把后端秘密交给 Vite。

Server adapter 移除包内自动 env-file 读取。Outline 的集成路径增加显式“环境已由 runtime adapter 提供”标识，跳过包内 dotenv merge；独立未集成 Outline 沿用自己的 loader。保留明确需要的 PATH/SystemRoot 等 OS 环境键，不能通过继承整个 process.env 把后端秘密带入 Web。

根 `.env.example` 只给非秘密默认值和需要填写的占位说明。根 `.env.local`、导入暂存文件和部署秘密保持忽略，Docker build context 的精确排除继续生效。日志只报出错误键名，不打印对应值。

## 6. v1 导入、指纹和兼容

### 6.1 导入动作

`configure --import-existing` 读取完整 v1 local config/secrets、Website 包配置和必要历史撤销配置。在任何写入前，核验原目标、原已记录资源/卷 proof、准备阶段、没有 live/ambiguous owner 和未完成清理。显式 flag 只授权导入，不授权停止未知进程或重建卷。

root 已有键与导入值完全一致时幂等；不同值时失败，只报告键名。未知原 Website 配置键可原样保留在导入文件内，但不向服务自动分发；实施必须从当前 Server config 模块提取完整已支持清单，不能丢掉存储配置。

导入从实际旧配置映射九个端口、storage 路径、数据库和秘密，不采用新的默认值替代旧值。历史 cleanup target 可导入 `IDENTITY_OUTBOX_TARGETS_JSON`，完整性检查与原解析器一致。

### 6.2 新 receipt

新的 `config.json` 使用 v2，字段至少包含 `version`、profile、无凭据 Website target、布局/目录摘要、configurationFingerprint、resourceFingerprint、配置来源标识及 upgrade receipt ID。真实秘密只从 root 读取。

必须区分两类指纹：

- configurationFingerprint：新有效配置的规范化摘要，用于拒绝未经显式核验的配置变动。
- resourceFingerprint：绑定当前真实容器/卷历史授权的稳定指纹；从 root 的资源相关 projection 重算并核验，不根据新 JSON 的版本号自动变化。

语义不变的 v1 导入保留原 `digest({config:v1,secrets})` resourceFingerprint、全部 exact IDs/proofs/卷身份，以及 prepared stages/adminUserId。v2 保存必要的无秘密兼容布局 projection，使 root 值能重现原指纹；配置字段不能重新成为人工配置 authority。不得重写 Docker labels、原 proof 或 prepared fingerprint 来假装新版本已核验。

新安装计算独立稳定资源 projection。资源相关配置变化导致与现有 resourceFingerprint 不符时拒绝启动，提示显式停机诊断/重新配置；本次不自动重建已有容器、更改密码、迁移 storage 或替换 issuer。

### 6.3 多文件转换失败

在原 mutex 下先写 upgrade journal：固定原文件 hashes/版本、计划输出 hash、原历史 fingerprint 与目标 receipt ID。暂存 root 环境输出，原文件留存；原子替换单个目标文件，最后写 committed receipt。任何阶段失败保留 journal，普通 start/dev/init 拒绝；重跑同一显式 import 核对原/已提交文件 hashes 后恢复，不把部分输出视为全新安装。

暂存文件包含秘密时采用与 root 相同的私有权限、忽略规则和清理范围。旧 config/secrets 保留用于可验证回退，但 v2 普通运行不读取旧秘密，也不自动双写。

## 7. 生命周期、锁和依赖 receipts

复用原跨模式 mutex 与身份检查，在其保护下执行依赖变动。成功 start 退出后不持有一个需要 live owner 的运行锁；独立依赖 receipt 记录 stable resourceFingerprint、原卷 proof、受管 exact IDs、started/preRunning 来源与真实阶段。

start 前固定全部资源 proof；already-running 必须真实核验，不能仅依赖 compose service 名。启动前记录 intent，每次启动后更新真实资源，最后核验 PG/Redis/Hydra 就绪才写 dependencies-ready。已有临时未知容器或 incomplete journal 仍拒绝。失败只停止本次从 stopped 启动的 verified IDs，独立 preRunning 保留。

dev 取得原应用运行占用，绑定相同 resourceFingerprint，但不把独立依赖写为自己的 cleanup-owned resources。它可执行 Docker 只读 inspect/exec/readiness；禁止 Docker create/start/stop/remove。监督器的 finally 和 sibling cleanup 只处理本次应用进程，bootstrap 必须退出普通 dev 后显式执行，不在 dev 内开放会改变基础服务的准备回调。

stop 在同一 mutex gate 下先检查原应用 owner/children 和准备 journal，再固定全部依赖 IDs/proofs/原卷。活应用导致 `APPLICATIONS_ACTIVE; next: Ctrl+C in the dev terminal`；未知归属拒绝零 stop。停止前后继续校验原 proof，最终真实 stopped 才更新 receipt。失败保留 cleanupRequired 与原授权，后续显式 stop 可同来源恢复。卷与容器文件数据均保留。

v1 import 若存在未完成 preparing/cleanup-failed 状态，则新入口拒绝并提示原内部恢复 CLI，例如 `node scripts/docs-integration/command.mjs down --mode local`；legacy dev/full 使用各自 mode。root stop 不冒充旧 full 应用的 down。

## 8. deployment 身份配置契约

新增 identity mode `deployment`，Website 与 Outline 同步实现、同时交付；旧 local/dev/full 行为与 client IDs 保持。deployment 不是“放宽 full”：是无默认公开地址、必须显式配置的分支。

| 项目                    | deployment 规则                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| publicOrigin            | 必须显式 HTTPS origin，无 credentials、query、fragment 或 path。                            |
| issuer                  | 必须显式 HTTPS 根 URL；精确 discovery issuer 比较；不自动回退 8090。                        |
| Outline URL/Website URL | 分别为 publicOrigin + `/docs` 与站点根，必须同源。                                          |
| clientId                | 固定 `ex-outline`，只注册精确 callback；不允许用户任意命名或通配 client。                   |
| callback/logout         | 精确 publicOrigin + `/docs/auth/oidc.callback` 与 `/identity/signed-out`。                  |
| approved clients        | 仅当前 Docs client，不增加 legacy OIDC probe。                                              |
| internal endpoints      | 显式私有 HTTP(S) 根 URL，禁止 credentials/query/hash，容器网络内可达；不提供 public proxy。 |
| 历史 cleanup            | 仍限现有三个 client IDs 和完整目标 schema；不得新增授权 client 来补 cleanup。               |

deployment 必须同步覆盖 Website/Outline config、Hydra client provisioning/readiness、初始化与运行状态校验、公开 SSR 环境和容器参数。不改 OIDC state/nonce/PKCE/browser proof、内部请求密钥、CSRF、会话撤销与匿名阅读策略。

当前旧 full 与 deployment 都使用 `ex-outline`。若同一 Website 业务库还有指向不同 issuer 的旧 `ex-outline` 会话或 pending outbox，不能简单覆盖该 ID 的 target：部署切换前须完成旧目标撤销/投递，或使用另一个显式准备的 Website 数据源。检测到未处理历史即拒绝切换。当前 schema 不支持同一 ID 同时路由到两个不同 issuer，本次不发明兼容路由或重写会话。

同一部署环境改变 issuer/client secret 是身份迁移，不属于改 env 后随意启动的行为；配置与已标记 Outline workspace 不一致必须拒绝。

## 9. 构建与镜像契约

`build.mjs` 依次或按依赖图执行 SDK → Website Web/Server → Outline 完整 build。调用 Yarn 必须在 `apps/outline/` cwd，工具版本符合各包 engines，失败返回非零且标明失败阶段。

build 不要求 `.env.local`、prepared.json 或数据库在线。Website 只使用公开构建参数。Outline 集成构建使用不含真实秘密的合成有效地址配置，固定 `/docs/static/`，禁用任何数据库准备；生产 HTML 的公开 origin/Website URL 从运行时 presenter 提供。将 root 开发 `NODE_ENV` 与 Vite build mode 分开，保持 production bundle。

若现有 Outline 插件构建读取地址，必须通过产物验证证明它只影响预期 public base；不得直接把真实 root 的秘密注入 Vite 以通过构建。静态 bundle 不应出现固定 `exwebsite.test:8090` 或开发 issuer。使用不同运行 origin 的同一镜像验证服务器注入地址有效；Website 跨域 VITE_API_BASE_URL 仍属于重新构建的参数。

镜像在 Linux build stage 安装依赖与原生扩展，固定可追溯的基础镜像和 lockfile。Website 与 Outline 保持各自依赖树及本地 ExUI 消费约束，不能把两个 React 实例混成一份安装。

| 产物                | 必需内容                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Website 静态产物    | `apps/web/dist/`，含 SPA 文件；默认 API `/api`。                                                                                |
| Website server 镜像 | `apps/server/dist/`、生产运行依赖、`api/openapi.yaml`、`apps/server/drizzle/` 与 runtime manifest；启动 `node dist/server.js`。 |
| 定制 Outline 镜像   | 自己完整的 build/static/public、plugin metadata 与生产依赖；启动保留 `--no-migrate`。                                           |
| Hydra               | 原锁定镜像，运行配置独立注入；deployment 不使用 `--dev` 作为公网配置。                                                          |

Website Dockerfile 的后端 target 不需要再次构建一个 Website nginx Web 镜像。已有 web target 可作为 legacy 兼容保留，不加入新部署服务集合。镜像不复制 `.env.local` 或本机持久数据。

## 10. 服务器部署材料

新增 `compose.production.yaml`，独立于 local 和原 8090 full；默认服务集合为 server/outline/hydra，按明确 profiles 提供托管 PostgreSQL/Redis 的可选定义。缺少选定的外部数据库/Redis 地址时拒绝，不自动选用或创建开发库。

Compose 按服务 `environment` 显式映射配置，不向每个服务加载整份 root。容器内部连接使用配置的 service DNS/私有地址；外部 PostgreSQL 继续经完整连接串注入。持久卷名字和附件挂载显式稳定，站点公网域名不参与自动卷重命名。

提供独立 Nginx 示例/说明：Website SPA fallback；`/api` 转发保留前缀；`/docs` 转发仅剥一次挂载前缀；`/docs/static` 与协作 WS 的正确 upstream；Hydra public issuer 使用其专门公开 HTTPS origin。公开入口拒绝规范化后的 internal paths，Hydra admin 不公开。静态 CDN 不能替代承接 OIDC callback、SSR、附件和 WebSocket 的反向代理。

镜像构建与运行使用明确的生产 Compose 命令，不复用根 start/dev。配置校验必须在 compose up 前完成；提供 validate 操作/脚本供部署说明调用，输出只含安全状态，不输出完整展开后的秘密。

显式迁移可用经过精确 image/tag、network 和 target 校验的一次性运行入口；普通容器启动不迁移、创建账号或 bootstrap。模板需说明全新目标先准备 exre、文档数据库、迁移、已有 active 账号及 client/workspace，随后启动业务；实际选择管理员 UUID 属于操作者明确输入，本 RFC 不预选。

本 RFC 验证部署材料在隔离环境可以运行，不授权连接真实服务器或发布公网。邮件、人机验证、备份、监控、多实例和生产容量规划另行设计。

## 11. 交付顺序与修改边界

1. 配置 adapter、v2 import/receipt 和失败恢复先落地，以 fake runner/fixture 验证不改变原 target/秘密。
2. 独立依赖 start/stop、应用 dev 清理拆分，复用原 proof 与 mutex，先保持现有根命令兼容直到新入口验证。
3. Server CLI 和 Outline integrated env loader 接入 root mapping，四个工具行为验证后精简根脚本并更新运行提示。
4. build 完整性、deployment identity 分支、Linux Docker targets 和生产 Compose/代理材料共同完成；不能只提交放宽身份 parser。
5. 隔离服务/浏览器验证与公共使用文档同步；随后才移除根旧别名，保留内部 legacy 恢复入口。

主要修改范围：`package.json`、`apps/server/package.json`、拟新增 `scripts/runtime/`、既有 local-config/local-dev/Foundation/ownership 的必要扩展、Website/Outline identity config 及 tests、Outline integrated environment loader、构建入口与 Dockerfile、生产 Compose/代理材料、`README.md` 和对应使用说明。HTTP Contract 和业务数据模型不改。

尊重已有 dirty work、ExUI links/lockfile、Outline 子仓库边界；不以回退 unrelated changes 实现本设计。源设计保持原文件。实现完成后的 `.ai/` 提炼须按仓库规则另外取得用户同意。

## 12. 验证矩阵

| 层级                    | 必须验证                                                                                                 | 失败判定                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| scripts node:test       | parser、root precedence、精确白名单、v1 hash 保持、部分转换拒绝、journal 恢复、无秘密日志                | 错误目标被接受、root/旧文件静默混读或授权 proof 被改写即失败。               |
| fake lifecycle          | start 服务清单、重复启动、失败只清本次 owned、dev 不启停容器、live 应用拒绝 stop、数据卷保留             | 任何跨职责 mutation 或未知资源 stop 即失败。                                 |
| Website Vitest/Contract | 原 SSO/账号语义、identity local/dev/full 不变、新 deployment HTTPS/callback 拒绝路径、outbox 历史 target | 不得把响应序列化后的绿灯当原 handler 无漂移证据。                            |
| Outline 自己的 tests    | deployment parser、root injected loader、public env 无秘密、OIDC 与 public mount                         | Website tests 不能代替此层。                                                 |
| 隔离 Docker             | PG/Redis/Hydra ready，重复 start/stop；dev 后依赖持续；数据库错误/缺 migration/UUID 拒绝                 | 不允许使用本机开发库作为测试 fallback。                                      |
| 构建                    | 根完整 build 无 DB/root secrets；两个 Linux 镜像资源与运行依赖完整；两种运行 origin 的相同 Outline 镜像  | 缺 Contract/migration、秘密进入镜像/Web、fixed legacy URL 或隐式迁移即失败。 |
| 开发浏览器              | 主页/API、docs 深链接、资源/HMR、匿名阅读、登录、协作 WS、退出撤销                                       | HTTP 200 不替代页面和交互断言。                                              |
| 部署材料浏览器          | 隔离 HTTPS 代理、精确 issuer/callback、SSR/API/WS、内部路径不可达、数据持久化                            | localhost HTTP 或仅 image build 不替代此层。                                 |

scripts 新测试用 Node test runner 单独执行，例如 `node --test scripts/runtime/*.test.mjs`，既有 scripts regression 列出并分别执行。按原真实资源测试入口运行，保持 explicit opt-in 和隔离目标。Website 执行 api:lint/generate 一致性、typecheck、相关 Vitest 和 build；Outline 单独执行自己的 typecheck/tests。

本 RFC 阶段只进行源码与文档自检，不运行应用、Docker、迁移或产品测试。实施报告须明确 PASS/FAIL/BLOCKED/NOT_EXECUTED，分别陈述自动化、镜像构建和浏览器证据。

## 13. 风险、检测与回退

| 风险                                   | 防范与检测                                                             | 回退                                                            |
| -------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| v2 指纹导致旧卷被当未知                | 保持 resourceFingerprint；fixtures 证明原 IDs/proofs/卷/阶段逐项不变   | 停止新 app，按 upgrade journal 验证后恢复原配置文件；不重建卷。 |
| root 导入冲突或半写入                  | 先验证、atomic file 替换、commit receipt 最后、普通运行拒绝 incomplete | 同显式 import 恢复；不删除未完成 journal 绕过。                 |
| dev finally 停止依赖                   | dependencies receipt 与 app cleanup 分开；故障/信号测试                | 暂缓移除旧入口，保留新依赖 receipt 供受控 stop。                |
| 同 client ID 旧 outbox 指向不同 issuer | 部署 preflight 检查历史、拒绝覆盖；不增加隐式 client alias             | 保持原 issuer/targets，显式完成撤销后再切换。                   |
| Outline build 内置错误地址             | inspect public env/presenter 与产物；相同镜像不同 origin 的浏览器验证  | 回到原构建版本和明确旧配置，不对旧 workspace 改 issuer。        |
| 把整个 root env 注入 Web               | 精确服务清单、sentinel secret 产物/进程环境测试                        | 移除该分发路径，停止进入部署阶段。                              |
| 误把本地部署材料当公网验收             | 专项 HTTPS/browser 标记，未执行明确报告                                | 不部署公网；生产运维作为后续独立工作。                          |

应用和配置回退与数据恢复分开。镜像切回旧 tag 不回滚 schema；任何已经执行的新迁移须评估旧应用兼容性，不能自动 downgrade/reset。正常停止和回退均不删除头像、上传对象、Outline 附件或 PG/Redis 卷。

## 14. 自检与剩余事项

已核对源设计、根命令、local fingerprint/锁、专用文档 PG、Server 运行资源、双方身份 parser、Outline public presenter/Vite 与环境 loader、独立测试边界。

没有未决的产品或架构选择，没有待填写项。操作者将在实际部署时填写 domain、连接地址、镜像 tag、秘密、持久目录及管理员 UUID；这些是必填运行输入，缺值必须拒绝，不构成设计中的隐含默认。

实施前置风险是升级 receipt 的原 proof 转换与新 deployment 分支的跨模块完整验证。不得以“修改 package scripts 完成”替代本 RFC 的生命周期、配置和数据保留验收。
