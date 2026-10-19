# 开发、测试、构建与原生部署简化 RFC

日期：2026-10-10。状态：待审阅；来源设计已获用户同意，本 RFC 尚未实施。

来源：`.notes/runtime-simplification/specs/2026-10-10-runtime-simplification-design.md`。保留来源文件原文。

## 决策与范围

将日常流程收敛为本地依赖、应用 watch、隔离自动测试、离线 Build、PM2 原生运行五项职责。根 `.env.local` 是环境设置唯一来源；根 `compose.yaml` 只启动 PostgreSQL、Redis、Hydra。服务器使用原生依赖、Nginx 和 PM2。旧 dev/full、Docker production、ExUI 本地源码链接及普通启动的配置 receipt 退出运行链。

目标是消除重复模式、配置和准备步骤，同时保留数据库身份、身份集成、资源归属及数据安全检查。不会改变 HTTP Contract、业务表职责、Outline 的独立 Yarn/submodule 边界或已有账号权限。当前交付不包括公网部署、集群或容器发布平台。

服务器操作系统沿用来源设计的 Linux 假设；依赖安装由操作者负责。真实服务器运行仍须独立验收。

## 现状与本次补充审计

以下均来自当前工作区源码，而非历史文档对行为的描述。

| 问题与证据                                                                                                                                    | 精简方式                                                                            | 删除条件与保留边界                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 根目录五份 Compose；旧入口仍存在于 `scripts/docs-integration/command.mjs`、`legacy.mjs`                                                       | 一个本地 Compose；删除旧入口及模式分支                                              | 数据和身份切换验收后删除；不删除卷、备份、附件或 Outline 上游独立 Docker 材料                      |
| `scripts/runtime/command.mjs`、`dependencies.mjs` 继续调用旧 local 配置、prepared/ownership 体系                                              | 运行编排集中在 `scripts/runtime/`；Docs 保留身份和准备逻辑                          | 提取仍被使用的共享函数后删除旧适配器；保留进程与容器归属核验                                       |
| `scripts/runtime/configuration.mjs` 要求配置版本和 receipt；旧配置导入、升级与跨模式恢复大量叠加                                              | 普通运行直接校验 `.env.local` 和真实服务；历史转换只执行一次                        | 迁移记录属于维护记录，不成为普通运行必需品；数据库集成 marker 和未完成撤销投递不能当作配置缓存删除 |
| `scripts/docs-integration/configure.mjs` 保留 ExUI source/link/context；`watch-exui.mjs` 仅有历史监听用途；根 `concurrently` 没有查到运行调用 | 保留 registry 安装包检查，删除本地链接、源码复制和监听；核实后删除根闲置依赖        | 不删除 Outline 自己使用的 concurrently；不批量修改两个依赖树                                       |
| 根 `pnpm test` 仅收集 TS/TSX；`scripts/runtime/` 和 Docs 编排的 Node `.mjs` 测试不在其中                                                      | 一个测试入口显示 Website、runtime、定制 Outline 的执行范围与结果                    | 保留各自 runner；真实 Docker 生命周期、浏览器验收仍显式执行                                        |
| `test-outline.mjs` 每个指定用例都重建 PG/Redis 并执行完整迁移；默认 Node 路径指向本机历史工具目录                                             | 统一工具选择和用例清单，失败直接指出用例、准备阶段和日志位置                        | 本轮保留逐例隔离；批量复用容器属于后续性能优化，需先证明污染隔离和收益                             |
| `Dockerfile`、`image-context.mjs`、production Compose 和 Nginx example 形成另一套部署链                                                       | 用 PM2 入口、现有编译目录和一份 Nginx 模板替代；部署地址从根配置渲染                | 删除服务器镜像打包及专属测试；保留模板的代理、安全、WebSocket 与转发行为                           |
| `DATABASE_USER`、`DATABASE_PASSWORD` 不在当前配置白名单；`.env.example` 的 `SERVER_NOTIFICATION_TOKEN_KEY` 也未被传给 Server                  | URL 一次转换为连接字段；白名单完整覆盖实际消费者                                    | 配置冲突明确拒绝；不能继续保留填写后无效的设置                                                     |
| `verifyFoundationSchemas()` 和 deployment 验证将数据库连接、认证等异常笼统翻译为结构未准备                                                    | 一套分阶段诊断与脱敏输出，供全部入口使用                                            | 保留失败原因和退出码；HTTP 对外错误 envelope 不扩展底层异常                                        |
| `README.md`、`docs/runtime.md` 与 `.ai/` 保留重复流程和已经不存在的 `integration:*` 根命令                                                    | README 放日常命令；runtime 放首次准备、维护、原生部署；知识文件只放边界和非显然约束 | 历史设计档案保留并标明历史；不再把旧命令展示为当前入口                                             |

## 配置契约

运行配置适配器必须满足：

- 使用仓库根路径解析 `.env.local`，不受调用 cwd 影响；受支持的进程变量优先。向每个子进程只注入其允许字段。
- 保留 `RUNTIME_PROFILE=local|deployment`；取消手工 `RUNTIME_CONFIG_VERSION`、普通启动的 config hash receipt 和跨模式 journal 依赖。
- Website 连接使用 `DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_NAME`、`DATABASE_USER`、`DATABASE_PASSWORD`；Outline 与 Hydra 分别使用对应 `OUTLINE_DATABASE_*`、`HYDRA_DATABASE_*`。三者数据库名分别固定校验为 `exre`、`outline`、`hydra`，部署允许不同 host。
- 数据库 URL 由适配器生成，账号和密码按 URL 规则编码；源配置只保留组件字段。TLS 等连接选项使用显式字段，禁止导入时丢弃已有 URL 的连接语义。
- Redis/Hydra、公开 origin、内部地址、应用端口、存储和日志设置沿用来源设计的分组；PM2、Compose、Nginx 不持有第二份环境值。具体支持字段须在同一适配器定义并由 `.env.example` 说明。
- `SERVER_NOTIFICATION_TOKEN_KEY` 为可选 32 字节 hex 密钥，必须正确传给 Website；缺省仍沿用 Server 当前派生逻辑。普通密码与密码学密钥分别按消费者约束校验。
- 本地 PG、Redis、Hydra public/admin 默认端口为 `5432`、`6379`、`4444`、`4445`；只绑定回环，不探测可用端口后自行替换。临时自动测试仍允许 Testcontainers 随机映射端口，与持久后台服务区分。
- 普通连接密码和 OIDC client secret 支持可读明文。签名和加密密钥保留既有格式和值；不能把随机 hex 值误判为可逆 hash，也不能替用户生成可读密码并轮换现有服务。

旧配置转换必须显式执行：备份原配置，解析旧 URL 与设置，发现字段冲突时仅报告键名并停止；核验原目标后再写入新配置。已有身份目标仍有 pending 撤销投递时，不得仅用新地址覆盖旧目标。转换不改变账号、存储、密码或密钥。

用户选择新密码后，由显式维护同步角色或 OIDC client，并验证新旧状态；失败回退到一致状态。普通启动不执行密码维护。新卷初始化的数据库密码与已有卷角色密码不是同一件事，改 `.env.local` 不能被宣称自动修改已有角色。

Build 只读工具及允许的公开编译设置，不要求运行配置完整。前端固定同源 `/api` 和 `/docs`；运行时 origin、内部地址及秘密不得被打包进前端产物。

## 命令与模块职责

| 入口                                          | 行为与成功标准                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm service:start`                          | 只启动本项目 PG/Redis/Hydra；真实就绪后打印地址、结果、日志和停止入口并退出                  |
| `pnpm service:stop`                           | 仅停止已证明归属的本项目依赖；不删除持久数据                                                 |
| `pnpm service:status` / `pnpm service:logs`   | 查询真实状态或跟随指定依赖日志；退出跟随不停止服务                                           |
| `pnpm dev`                                    | 验证依赖、结构和身份后启动 Website/Outline watch；展示同源入口；Ctrl+C 清理自己的子进程      |
| `pnpm test` / `pnpm test:watch`               | 一次或持续执行有明确范围的自动测试；不连接开发库、不执行 Build                               |
| `pnpm build`                                  | 构建 SDK、Website 前后端、Outline 前后端和运行资源；失败报告具体阶段                         |
| `pnpm start` / `pnpm stop` / `pnpm logs`      | 通过 PM2 管理本项目 Website、Outline、原生 Hydra；start 必须检查真实健康                     |
| `pnpm db:migrate`                             | 显式迁移已有 Website `exre`                                                                  |
| `pnpm infra init` / `pnpm infra migrate`      | 显式准备或迁移 Outline/Hydra，既有环境保留数据与 owner                                       |
| `pnpm infra bootstrap --admin-user-id <UUID>` | 核验用户明确选择的已有 active Website 账号，准备 client 与文档管理员；不恢复已明确撤销的角色 |

根入口不需要为每个内部阶段再公开一个别名。保留 `api:lint`、`api:generate`、`typecheck` 与已有显式危险维护命令；内部 package scripts 是各包工具契约，不因统一根入口而全部删除。

运行编排、配置、输出和通用健康诊断集中在 `scripts/runtime/`。身份 client、Outline bootstrap、issuer 检查等逻辑保持独立可复用，不塞入 Compose 或 PM2 文件。共享仓库路径与 registry 检查从历史 `configure.mjs` 提取，避免仅为常量而继续加载旧模式模块。

容器生命周期使用固定项目和已验证的服务、卷、容器身份；既有运行资源只复用经核验的目标。停止依据当前实际 inventory 与保存的归属信息，不能用同名 PID、模糊容器名或 `pm2 delete all`。配置摘要可用于内部比对，但不再要求用户生成或管理配置凭据文件。

普通 `dev/start` 的准备验证保持只读。连接配置错误、结构缺失、身份冲突分别失败，不隐式 init/migrate/bootstrap/reset。单实例应用监督锁保留；删除的是跨旧模式协调，不是全部并发和归属检查。

## 测试与 Build

测试入口顺序输出 Website、runtime、定制 Outline 的结果，任一必需分组失败均返回非零。默认范围包括根 Vitest 收集的 Website 用例、保留 runtime/Docs 逻辑对应的 Node 单元测试，以及项目定制 Outline 用例；明确排除旧模式专属测试与真实外部验收，不能将排除项计为通过。

Outline 使用文件与原样用例名组成的单一静态清单，复用现有隔离 runner。初始清单覆盖 `server/identity/` 的 config、readiness、readinessCli、websiteProvisioner、websiteOidc、SessionGuard、syncWebsiteProfile、expiredAccessTokens，以及 `server/routes/auth/websiteOidcFlow.test.ts` 中项目定制行为。实施时将这些文件的实际用例名登记并通过执行报告核对，无匹配、重复匹配、未处理错误或准备失败都算失败。纯前端定制测试由 Outline 自有 app/shared 项目按文件选择执行。

`test:watch` 监督各分组的变化与结果；Outline 后端每次重跑仍使用临时资源，不能让 watcher 继承开发库设置。数据库测试只使用 Testcontainers 与独立 schema/数据库，Docker 不可用明确失败。目标 PG18 的关键迁移、reset 和身份用例必须在 PG18 验证；历史 PG16 兼容及 16→18 恢复作为迁移验证保留。

不把 Build 与完整测试并行作为默认路径：它们可能争用 SDK 产物和运行资源。开发预览的 `dev` watch、测试 watch、Build 三者语义分开。

Build 沿用 `scripts/runtime/build.mjs` 已有顺序：SDK、Web、Server；Outline clean、vite:build、copy:i18n、build:server。打包已有翻译，不以构建为由重新提取并覆盖翻译源。沿用 `apps/web/dist`、`apps/server/dist`、`packages/sdk/dist`、`apps/outline/build` 和现有 public/plugins/locale 等资源；运行清单还要包含 Contract、migration、启动适配器、模板及 lockfile，不创建第二份重复产物目录。

生产迁移和必要 CLI 使用编译产物，不依赖 `tsx`。依赖在目标操作系统按两个 lockfile 安装；Windows `node_modules` 不作为 Linux 部署产物。Build 不启动数据库、Docker、PM2或测试，不改准备记录和秘密。

## 原生运行与输出

PM2 配置只描述本项目进程与入口；环境由统一适配器注入。Website 和 Outline 使用单实例编译入口，Outline 包含 web、协作、WebSocket、cron/worker 等既有服务。Hydra 使用配置指定的原生二进制；版本与本地锁定版本保持一致，管理入口不向公网暴露。

Nginx 由根配置渲染模板，生成位置与应用存储分离。模板保留静态 Website、API、Outline `/docs`、Hydra public 白名单、WebSocket、HTTPS forwarding 与内部路由拒绝。先校验生成配置，再显式安装/重载；`pnpm start` 不隐式修改系统 Nginx。更换服务器地址、数据库或域名不要求重新 Build。

启动成功必须同时满足进程存在、Website 健康与 schema、Outline 健康与集成 marker、Hydra readiness/discovery/client 核验。失败只回收本次启动的应用，保留此前存在的进程与后台服务。PM2 online 不能代替上述验证。

共享输出采用标题、阶段、完成摘要、时间/级别/服务事件。TTY 简单进度，非 TTY、CI、`NO_COLOR` 稳定纯文本、不清屏。Build 成功折叠普通输出，警告可见，失败展开必要上下文；未知警告或 stderr 不得无条件丢弃。详细模式依然脱敏。

诊断至少包括服务、阶段、脱敏目标、配置键、错误码和下一步。区分 Docker 不可用、端口占用、DNS、拒绝连接、超时、PG `28P01`、数据库不存在、migration 缺失和身份冲突。只有 inventory 证实未启动时才建议启动受管服务；远程目标连不上不能断言本地容器未启动。

短密码、URL 编码密码、Bearer、身份秘密、完整连接串和原始 SQL 均不能进入终端或日志。服务器保留结构化应用日志，通过终端格式化查看；日志大小与保留数量有界且可配置。HTTP 对外错误仍使用既有固定 envelope。

采用现有工具提供的能力：[Compose `--wait`](https://docs.docker.com/reference/cli/docker/compose/up/)等待 running/healthy 后还需应用级验证；[Vite logger 与 clearScreen](https://vite.dev/config/shared-options#customlogger)适配统一输出；[PM2 日志管理](https://pm2.keymetrics.io/docs/usage/log-management/)提供日志查看与配置。无需另引入整套任务平台或终端 dashboard。

## 迁移、落地顺序与回退

1. 先完成共享配置、字段审计、脱敏诊断和新入口的隔离验证；旧运行路径暂保留作维护回退，新入口不自动导入旧配置。
2. 完成 Build 产物、编译 CLI、PM2 与 Nginx 模板验证；首次准备命令既支持本地依赖，也支持配置指定的原生服务，不固定调用 Docker。
3. 显式维护窗口停止写入，保存配置、完整数据库备份、owner、卷、附件清单和恢复步骤。核对原 issuer 的 pending 撤销投递并先完成投递；不能绕过历史来源校验。
4. 保留现有 PG18 的 `exre` 与原卷。将最新 PG16 的 outline/hydra 逻辑恢复到 PG18 候选库，核对迁移集合、owner、约束、完整数据摘要、用户/subject、文档、附件引用。PG18 已有同名历史 Outline 库先保留为明确 legacy 名称，禁止覆盖。
5. 停止新 OIDC flow，撤销旧 Docs 登录绑定，使未完成 flow 重新发起；受控更新 Outline integration marker 与 external identity issuer，保留用户、subject、文档、权限和管理员选择。新 issuer 为本地 `http://127.0.0.1:4444/`；旧凭据不冒充新 issuer 凭据。
6. 验证成功后将服务纳入唯一 Compose、切换连接字段和默认端口，执行应用、登录、退出、撤销、附件与协作验收。原 PG18 卷复用；旧 PG16 卷、备份及历史库保留。
7. 切换验收通过后才删除旧入口、四份额外根 Compose、应用服务器 Docker 打包、ExUI 本地链路和对应旧模式专属测试；同步当前文档入口，保留仍有意义的回归。

逻辑恢复方向为 PG16→PG18，不能将 exre 降到 PG16。版本兼容依据是 [PostgreSQL pg_dump 说明](https://www.postgresql.org/docs/18/app-pgdump.html)，实际恢复成功和数据一致性仍需真实验证。

任一数据或身份检查失败均停止切换，恢复原配置与原目标，不向旧目标投递新 issuer 的事件。切换后存在新写入时，不能直接回挂旧备份宣称无损回退；必须先停止写入，核对并恢复切换后的变化。应用代码回退与数据库恢复分别记录。一次性维护清单放忽略的 `.local/`，不成为日常配置来源。

## 验证与风险

| 验证范围     | 必须证明的行为                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 配置与工具   | cwd 无关、进程变量优先、字段真正传递、URL 编码、旧字段冲突拒绝、密钥格式、普通设置变化不依赖 receipt；工具不固定本机历史 Node 路径 |
| 日志诊断     | 连接拒绝、错误密码、缺库/结构分别提示；短及编码密码不泄漏；非 TTY 不清屏；未知警告保留                                             |
| 服务生命周期 | 三个依赖使用默认端口，冲突失败；start 摘要后后台继续运行；stop 不删卷且不误停未知资源                                              |
| watch 与测试 | 前后端更新可见、Ctrl+C 完整清理自己的进程；测试不访问开发库；实际分组和匹配用例可核验；临时资源正确清理                            |
| Build        | 无 Docker/数据库及完整运行秘密仍能构建；全部必要产物存在；前端产物无运行秘密；编译 CLI 不依赖开发入口                              |
| 原生应用     | PM2 online 但健康失败必须非零；项目作用域停止；Outline worker/协作/资源完整；Nginx 同源、HTTPS、内部路由拒绝与 WebSocket           |
| 维护迁移     | PG16→18 真实恢复与失败回退；原 exre/历史库/附件保留；issuer 切换身份关联、重新登录与撤销投递完整                                   |

主要风险是现有数据库和身份目标迁移，不是 Compose 文件数量。通过候选库、备份、停止写入、全量核对及独立验收控制；不能用重复 bootstrap 或 reset 代替迁移。可读密码的风险在旧脱敏器和 URL 构造，须先修正再放宽格式。

服务器运行还涉及 Linux 原生依赖和实际 HTTPS 代理。开发机自动测试不能证明服务器运行；必须分别报告自动检查、本机真实验收、服务器验收。当前仅完成源码审计和文档核对，未执行本 RFC 的实现测试或服务器部署。

测试速度优化暂不作为本轮阻塞条件；没有测量依据前不合并 Outline 测试数据库。旧模式专属断言可删除，数据隔离、归属、身份、Contract 原始 handler 等保护性测试须保留并适配。

## 文档与待核实事实

README 保留首次准备的简短入口和日常命令；`docs/runtime.md` 承载配置说明、显式维护、原生服务器步骤与故障处理。`.ai/` 只记录接受并有实现证据的边界和陷阱，重复事实改为根路径引用；设计、RFC 和历史材料不搬入知识库。设计结论提炼进 `.ai/` 前仍按项目要求征得用户同意。

本 RFC 不新增 Outline 子模块 Markdown，不清理与任务无关的工作区修改。

没有需要重开来源设计的架构决策。服务器操作系统、安装目录、TLS 证书位置、原生 Hydra 可执行路径和用户所选新密码须在真实维护或服务器验收前按实际环境填写；不据此宣称公网可运行。删除闲置依赖前还须核对安装生命周期和最终调用图，避免把 Outline 自用依赖当作根闲置依赖删除。
