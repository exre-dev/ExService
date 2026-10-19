# 命令精简、运行配置与部署产物设计

日期：2026-10-05

状态：方向已确认，完整设计待用户评审；尚未修改运行代码。

模块根目录：`.notes/command-runtime/`。模块覆盖日常命令、依赖生命周期、环境配置和部署产物边界，不改变业务 HTTP Contract。

## 1. 已确认方向

- 本地 Docker 运行依赖，前端与业务后端由宿主机 `pnpm dev` 启动。
- 日常保留简单的 `start`、`dev`、`build`，增加对应的 `stop`。
- 服务器 Website 后端和定制 Outline 使用 Docker 镜像；前端部署构建后的静态文件。
- 配置集中在根目录 `.env.local`，提供可提交的 `.env.example`；本地配置和真实密钥不进入 Git、浏览器产物或镜像。
- 首次准备、数据库迁移和指定管理员初始化仍是显式维护操作，不能混入日常启动。

“Docker 仅运行依赖”适用于本地开发，服务器应用容器使用独立部署配置。Hydra 是当前统一登录必需的 OIDC 依赖，因此本地 `start` 除 PostgreSQL、Redis 外还启动 Hydra。该完整服务清单提交本次评审确认。

## 2. 当前实现证据

| 来源                                                                      | 当前行为与设计影响                                                                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                            | `dev` 调用 local supervisor；`build` 只构建 SDK、Website Web 和 Server；根目录公开多个 integration 与手工账号工具别名。                            |
| `scripts/docs-integration/local-dev.mjs`                                  | `runLocal` 会启动 PostgreSQL、Redis、Hydra，并监督 Website Server/Web、Outline；需要拆开依赖与应用生命周期。                                       |
| `scripts/docs-integration/local-config.mjs`                               | Website 从 `apps/server/.env.local` 和进程环境取配置，文档密钥来自 `.local/docs-integration/local-dev/secrets.env`，端口与目标存于 `config.json`。 |
| `compose.local-dev.yaml`                                                  | 独立 local 项目已有 PostgreSQL、Redis、Hydra，文档 PostgreSQL 不包含 Website `exre`。                                                              |
| `infra/docs-integration/postgres/init-local.sh`                           | 明确只准备 `outline`、`hydra`，拒绝目标含 `exre`，不能把已有文档卷直接改成混合业务库。                                                             |
| `apps/server/src/cli/sso-create.ts`、`apps/server/src/cli/sso-inspect.ts` | 手工创建、检查 Website SSO 请求的工具，不负责 Hydra client 注册。                                                                                  |
| `apps/server/src/cli/auth-account.ts`                                     | 启停账号的维护工具，已有共享实现；禁用会话语义必须保留。                                                                                           |
| `apps/server/tsconfig.json`、`apps/server/src/app.ts`                     | Server 是编译后的 Node 程序，运行需要依赖与 `api/openapi.yaml`，不是只上传 JS 的静态服务。                                                         |
| `Dockerfile`、`apps/outline/Dockerfile.integration`                       | 已有镜像基础，Outline 镜像含旧 8090 构建配置；需区分构建参数、运行参数和 public origin。                                                           |
| `.ai/architectures/docs-integration/integration-boundaries.md`            | 现有准备状态、稳定密钥、资源归属、旧会话撤销目标和停止恢复约束不得因入口精简丢失。                                                                 |

## 3. 方案选择

采用“统一日常入口 + 单一维护入口 + 独立部署产物”的方式。

- 只删除根别名：修改小，但保留 `dev` 启动依赖和多份配置的问题，不能满足用户目标。
- 所有准备放入 `start` 或 `dev`：表面命令少，但会隐式迁移、选择账号或改变数据库，不采用。
- 本设计：四个日常命令，维护动作收敛到一个 `infra` 分发入口，保留现有受控准备与恢复能力。

## 4. 根命令契约

| 命令                  | 行为                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm start`          | 读取并验证根配置，启动已准备、归属已验证的 PostgreSQL、Redis、Hydra，等待就绪后退出；不启动 Website/Outline/Web，不运行迁移或 bootstrap。 |
| `pnpm dev`            | 只读核对依赖已运行与应用准备状态，启动 Website Server、Website Vite/公共入口和 Outline 开发服务；依赖缺失时提示 `pnpm start`。            |
| `pnpm build`          | 构建 SDK、Website 静态前端、Website Server 和定制 Outline 完整产物；不启动 Docker、连接业务数据库、迁移或初始化账号。                     |
| `pnpm stop`           | 核对受管依赖归属并停止本项目依赖容器，不删除容器卷或文件数据；开发应用仍由其终端 Ctrl+C 停止，应用运行中拒绝停止依赖。                    |
| `pnpm infra <action>` | 运行显式维护动作，默认唯一 local 开发拓扑，日常流程不再选择旧 dev/full mode。                                                             |

`infra` 动作：

| 动作                               | 明确职责                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `configure`                        | 校验配置、工具与原 Website 数据源，保存无明文秘密的目标/准备元数据；缺配置拒绝，不覆写已有秘密。                         |
| `configure --import-existing`      | 一次性从已有 Website/local 配置导入根 `.env.local`；同名冲突拒绝并只报告键名，保留所有原文件。                           |
| `init`                             | 显式准备文档基础资源，启动准备所需依赖并执行 Outline/Hydra 迁移，完成后保留依赖供日常使用；不创建 Website 数据库或账号。 |
| `migrate`                          | 显式升级已核验的 Outline/Hydra schema；Website 仍由 `pnpm db:migrate` 处理。                                             |
| `bootstrap --admin-user-id <UUID>` | 校验指定已有启用 Website 账号并初始化文档身份与管理员；缺 UUID 拒绝，重复运行不恢复后续被撤销的管理员权限。              |
| `test`                             | 运行现有 Outline 专项测试入口，和 Website 的 `pnpm test` 分离。                                                          |

根目录继续保留 `api:lint`、`api:generate`、`typecheck`、`test`、`db:migrate`、`db:reset`。删除 `dev:outline`、四个 SSO/账号根别名及全部 `integration:*` 根别名。单应用开发通过工作区或 Outline 自己的命令完成。

Server 包内保留 `sso:create`、`sso:inspect`、`auth:disable`、`auth:enable`，通过 `pnpm --filter @workspace/server <command>` 调用；既有业务能力与对应测试保留。

## 5. 配置与地址映射

根 `.env.local` 是新的配置来源，进程环境对明确允许的配置键具有更高优先级。导入完成后不静默回退到旧配置文件，避免多份不同值生效。`.local/` 继续保存资源归属、卷身份、目标指纹和准备状态，不能作为第二份人工配置来源。

配置按服务命名并分发：Website 使用 `DATABASE_URL`、现有 HMAC/存储配置；Outline 使用独立的数据库与 Redis 配置；Hydra 使用独立数据库、issuer 和身份密钥。不同服务需要的 `DATABASE_URL` 由启动适配器映射，不能向所有子进程注入同一个数据库地址。Web 仅接收明确的公开配置，不接收后端密钥。

本地公共 origin 默认 `http://127.0.0.1:8080`，保持已有九个默认端口和 `/api`、`/docs` 代理语义。issuer、callback、头像公开地址和登录返回地址从经校验的公开地址派生；拒绝冲突配置，不依据请求 Host 生成身份地址。

服务器容器通过显式服务配置注入根配置中的必要键。容器内部使用 service DNS，宿主机开发使用回环地址，两者独立映射。环境文件不打包进镜像；更换运行配置需要重建容器或重启应用，不宣称实时热更新。

前端 `VITE_*` 是构建配置，构建后修改 `.env.local` 不会改变已生成 JS。本次默认前端 API 使用同源 `/api`，由服务器反向代理映射后端；跨域 API 地址变化需重新构建前端。不得把数据库或 Redis 凭据写成 `VITE_*`。

开发密钥缺失时，由显式配置/初始化流程在新安装场景产生并保存；已有密钥绝不自动轮换。运行配置变更不自动改已有 PostgreSQL 密码、卷 labels 或归属 proof；需要显式重新校验，目标或身份不一致时停止继续运行。

## 6. 数据库与首次使用

继续使用现有 Website `exre` 数据源，其地址、账号和 HMAC 从原配置导入。local Docker PostgreSQL 继续承担独立 `outline`、`hydra`，不搬运、覆盖或克隆 Website 业务库。

若全新环境希望 Website PostgreSQL 也由 Docker 承载，使用独立 Website 数据库实例和卷，由用户显式准备并在 `DATABASE_URL` 中指向它；其自动化 provision 不纳入本次默认 local 迁移。`start` 不把原 `DATABASE_URL` 改成 Docker 地址，不把专用文档卷改造成 Website 卷。

已有环境切换流程：确认没有旧 supervisor/准备命令运行 → `pnpm infra configure --import-existing` → 校验既有卷/准备记录可复用 → `pnpm start` → `pnpm dev`。只有真实状态需要升级时才显式执行迁移，不要求重新 bootstrap。

全新环境流程：准备依赖、ExUI 与独立 Website `exre`，填写根配置 → `pnpm infra configure` → `pnpm db:migrate` → `pnpm infra init` → 用户注册并选择已有启用账号 → `pnpm infra bootstrap --admin-user-id <UUID>` → `pnpm start` → `pnpm dev`。

新配置格式使用独立版本标识。已有完整归属证据通过显式 configure 转换，只保留真实历史 target/卷/proof；不能根据当前同名容器反造旧授权。半份配置、未知卷或未完成恢复记录拒绝自动转换。

## 7. 生命周期与失败处理

- `start` 不依赖 Website/Outline 源码构建或 Yarn/ExUI 工具链来运行已准备的基础服务；应用工具链校验归 `configure`、`init`、`dev` 和 `build`。
- `start` 成功后依赖独立持续运行，重复 start 校验后幂等；失败只回收该次新启动且归属确定的资源，保留事先已运行资源。
- `dev` Ctrl+C 或必需子进程失败只清理本次应用进程，不能停止由 start 管理的依赖；Windows 保留私有进程树归属与退出校验。
- `stop` 按精确资源与历史 proof 校验，不使用无范围的容器 stop、kill 或 `down -v`；live 应用、未知资源或未完成恢复记录导致拒绝。
- 旧 8090/full 模式从正常根命令移除，旧资源停止/恢复仍保留受控内部 CLI 与文档，不直接删除旧编排、记录或卷。
- 错误提供安全错误码和精确下一步命令；不打印数据库密码、环境文件内容、完整带秘密 Compose 展开或原始 SQL 错误。
- 修改后的启动/准备状态必须记录真实成功与失败，不能以退出码或缓存标记替代数据库、卷和进程检查。

## 8. 构建与服务器部署边界

`pnpm build` 产物包括 `apps/web/dist/`、`apps/server/dist/` 和 Outline 的完整构建输出，使用原各自包管理器。Website/Outline 保持独立 React 和 ExUI 消费，不改 lockfile 链接以凑合构建。

Website 后端镜像含编译代码、完整运行依赖、`api/openapi.yaml` 与显式迁移所需文件。定制 Outline 镜像含自己的 server、client/static、public 和运行依赖；不能用未定制的官方镜像替代当前代码。基础镜像和依赖版本可追溯，Linux 原生依赖在镜像构建环境安装，不复制 Windows `node_modules`。

服务器 Compose 单独维护，不使用本地 `start` 命令部署应用；它运行 Website Server、Outline、Hydra 与按配置选用的基础依赖，不包含 Website Vite 或开发监督器。Website 静态站点由独立 Nginx/CDN 托管，不要求额外 Website Web 应用容器。

公开代理继续负责 SPA fallback、`/api`、`/docs` 与 WebSocket；`/docs` 的 SSR、动态 API、附件和协作仍归 Outline，不能把所有 `/docs` 请求当静态目录。Hydra admin、Website/Outline 内部身份 operation 和数据库不暴露到公共入口。公开 HTTPS/origin、精确 issuer/callback 与 service DNS 必须通过专门配置校验，不能沿用固定的 `exwebsite.test:8090` 当生产地址。

头像、上传对象、Outline 附件与数据库卷独立持久化；服务器部署选择已有数据库地址或显式准备新数据库，不自动迁移开发库。镜像版本回退不自动回退数据库 schema；迁移仍是部署前显式动作。

本次产出可构建、可配置的部署材料及隔离环境验证，不部署公网，不宣称现有邮件、人机验证、审核、备份恢复、监控和多实例能力已达到生产要求。公网运维准备是后续独立范围。

## 9. 验证标准

1. 命令测试证明根脚本集合收敛，旧 SSO/账号工具仍可定位；更新错误提示与文档里的原命令引用。
2. 使用 fake runner 验证 start 仅启动基础服务且不迁移，dev 不调用 Docker 启停，Ctrl+C 不停止依赖，stop 拒绝未知资源和 live 应用。
3. 配置测试覆盖导入、冲突、进程环境优先级、稳定密钥、数据库目标不变、准备状态转换和服务环境白名单；失败日志不包含秘密。
4. isolated PostgreSQL/Redis/Hydra 和受控卷验证重复 start/stop、依赖缺失拒绝、现有数据保留、迁移必须显式、缺 UUID 拒绝；测试不读取本机开发数据库。
5. 构建验证 Website 与定制 Outline 产物、Linux 后端镜像所需资源及运行依赖完整，镜像和前端无真实 `.env.local`/密钥，镜像启动不隐式迁移。
6. 真浏览器分别检查主页、API、`/docs` 深链接、静态资源、登录、WebSocket 与退出；开发和镜像部署证据分开记录，无法执行时报告 NOT_EXECUTED。
7. 执行仓库规定的 API lint/generation 一致性、typecheck、相关测试与 build；无 HTTP schema 改动时不得手工修改生成类型。执行 Outline 自己的检查，不把 Website 检查当成 Outline 验收。

## 10. 范围与后续交接

确认范围：根命令、local 生命周期拆分、根环境配置及显式导入、维护动作收敛、完整构建、后端镜像/部署配置、对应回归验证与文档同步。

不包含：修改业务 API、迁移现有账号数据、自动选择管理员、密钥轮换、数据库 reset、提交/推送、实际服务器部署或公网生产验收。

风险：local 归属指纹与准备记录转换必须保留原 proof；现有跨模式 outbox 撤销目标不能因配置收敛丢失；Outline 旧构建内置 origin 需要验证哪些值影响浏览器产物，不能承诺所有地址仅靠运行环境切换。

设计批准后按 brainstorming 默认流程交给 technical-design-doc-creator，在 `.notes/command-runtime/rfcs/` 形成一个 RFC，明确配置 schema、状态转换、镜像地址契约和验证矩阵。编写 RFC 不等于实施或提交授权。设计结论写入 `.ai/` 须另行取得用户同意。
