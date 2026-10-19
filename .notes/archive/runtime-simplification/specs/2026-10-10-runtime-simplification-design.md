# 本地开发、构建与服务器运行简化设计

日期：2026-10-10。模块：`runtime-simplification`。状态：待用户审阅。

## 目标与已确认原则

Docker 仅为本地开发和隔离自动测试提供后台依赖。Website 和 Outline 在宿主机 watch 运行；服务器使用原生后台服务和 PM2，不依赖 Docker。连接地址、账号密码、密钥、端口和存储设置集中在根 `.env.local`，`.env.example` 仅说明字段。

旧 dev/full 和 Docker production 运行模式退役。Build 与开发预览、自动化测试分开。根 `pnpm build` 构建 Website 前端、后端及完整定制 Outline；根 `pnpm start` 用 PM2 运行构建产物。

普通密码允许可读明文；签名和加密密钥保留既有格式与原值。默认输出使用中文摘要、服务名和明确错误原因。`service:start` 在实际就绪后打印摘要并退出；服务继续在后台运行。

本设计提供服务器可运行的配置与产物契约，不执行公网部署，不把本地验证当作服务器生产验收。

## 运行结构

| 组件         | 本地开发                | 服务器                                                  |
| ------------ | ----------------------- | ------------------------------------------------------- |
| Website 前端 | Vite 热更新             | Nginx 提供 Build 后的静态文件                           |
| Website 后端 | Node watch              | PM2 单实例运行编译入口                                  |
| Outline      | 独立 Yarn 前后端 watch  | PM2 单实例运行编译入口，含 SSR、静态资源、协作和 worker |
| PostgreSQL   | 一个 PostgreSQL 18 容器 | 原生安装或已有 PostgreSQL 服务                          |
| Redis        | 一个 Redis 容器         | 原生安装或已有 Redis 服务                               |
| Hydra        | 一个 Hydra 容器         | 原生 Hydra 二进制，由 PM2 管理                          |
| 对外入口     | 当前同源开发代理        | 原生 Nginx：静态前端、`/api`、`/docs` 和 Hydra public   |

本地只保留一份根 `compose.yaml`，服务为 PostgreSQL、Redis、Hydra。默认 PostgreSQL `5432`、Redis `6379`、Hydra public `4444`、admin `4445`；端口冲突明确失败，不自动递增或选用备用端口。Docker 只绑定回环地址。

同一 PostgreSQL 实例可以承载独立的 `exre`、`outline`、`hydra` 数据库，各自保持独立 owner 和应用连接。Website 仍只访问 `exre`；不接管 Outline API 或跨库读写。需移除现有文档基础设施对同实例存在 `exre` 的拒绝条件，同时保留数据库身份和 Outline/Hydra owner 检查。业务表职责、关系和数据规则不因实例合并改变。

Website 与 Outline 的应用端口继续显式配置；默认 Website 公共入口 `8080`、Vite `8081`、API `8082`、Outline 后端 `3102`、Vite `3101`。上述应用端口与后台依赖默认端口不混用。部署可在根环境配置中指定应用监听地址与端口。

## 单一配置来源

所有运行入口都通过同一个配置适配器读取根 `.env.local`，明确支持的进程变量优先。Outline 的独立应用配置由适配器注入，避免 cwd 改变后另读子目录环境文件。PM2 和 Compose 只定义进程与服务结构，不保存第二份连接设置或秘密。Nginx 的环境相关地址、域名、证书和静态目录从同一配置渲染到运行模板。

配置按运行模式、公开入口、三个数据库、Redis/Hydra、应用端口、账号密码、应用密钥、存储、日志分组。保留 `RUNTIME_PROFILE=local|deployment`；删除普通启动对手工版本号、配置 hash receipt 和旧模式 journal 的依赖。

数据库使用各自的 host、port、database、user、password 字段；密码原样存储，适配器正确编码后生成应用所需 URL。Website 的 user/password 字段须真正参与连接，不能继续保留被忽略的 `DATABASE_USER`、`DATABASE_PASSWORD`。数据库名校验仍要求 Website 为 `exre`、Outline 为 `outline`、Hydra 为 `hydra`。服务器允许三库使用不同的 PostgreSQL 地址，不强制共用实例。

一次显式转换将现有 root URL 拆为相应字段并核对已有 user/password；冲突时列出键名并停止，不猜测优先级或覆盖密码。转换完成后每个设置只有一个来源，不长期同时维护 URL 和组件字段。

普通数据库密码与 OIDC client secret 不再统一要求 64 位 hex，仍校验非空与消费者的实际约束。`AUTH_CODE_HMAC_KEY`、`OUTLINE_SECRET_KEY`、身份 flow/integration/delivery 密钥、可选上传 HMAC 等保持实际密码学格式。已有随机字符串是原始明文值，转换配置不会替用户轮换密码或密钥。密码变更须先由用户填入所选新值，再通过显式维护操作同步数据库角色或 OIDC client；失败不能留下文件与服务密码不一致的状态。

前端保持同源 `/api` 和 `/docs`，公开 origin 与身份设置由后端运行时注入。服务器更换域名或数据库地址不要求重新 Build；改变前端编译功能或公开挂载路径仍需重新 Build。后端秘密不得进入前端环境或产物。

## 命令与日常流程

| 命令                                          | 职责                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm service:start` / `pnpm service:stop`    | 启停本地三个依赖；不删除持久卷，不隐式准备数据库或身份                 |
| `pnpm service:status` / `pnpm service:logs`   | 查询真实状态、追踪依赖日志；退出日志查看不停止服务                     |
| `pnpm dev`                                    | 检查真实依赖与准备状态，watch 运行 Website、Outline；Ctrl+C 只结束应用 |
| `pnpm test` / `pnpm test:watch`               | 一次或持续运行自动化验证；与开发预览和 Build 分开                      |
| `pnpm build`                                  | 构建 Website 前端、后端、SDK 和 Outline 前后端及静态资源               |
| `pnpm start` / `pnpm stop`                    | 通过 PM2 启停服务器应用；不启停数据库或删除数据                        |
| `pnpm logs`                                   | 按应用追踪日志                                                         |
| `pnpm db:migrate`                             | 显式迁移已有 Website `exre`                                            |
| `pnpm infra init` / `pnpm infra migrate`      | 显式准备或迁移 Outline/Hydra；不创建 Website 数据库                    |
| `pnpm infra bootstrap --admin-user-id <UUID>` | 核验用户明确选择的已有 active Website 账号，准备文档管理员与 client    |

已有环境日常只需 `service:start`、`dev`；服务器完成首次准备后只需更新环境设置并 `start`。普通启动只验证当前配置、数据库结构、身份 marker 和 client，不创建账号、授予管理员、迁移或 reset。初始化、迁移、管理员和密码维护保持显式，但不再要求额外 configure 才能读取一次普通设置变化。

自动化验证统一入口需包含 Website、runtime 脚本和项目定制 Outline 用例，输出各自范围。Outline 自有 Yarn 测试项目不并入 pnpm workspace；其后端验证以指定文件的定制用例清单为边界，不默认运行整个上游 suite。真实生命周期与浏览器验收单独显式执行。具体测试清单在 RFC 中按修改影响确定，不能把跳过的测试计为通过。

## Build 与服务器产物

Build 不连接数据库、不启动 Docker、不自动运行测试、不修改秘密或准备状态。Website 与 Outline 依赖分别按 pnpm/Yarn lockfile 安装，产物包含运行代码、Contract、migration、Outline public/plugins/locale 等运行资源和 PM2 入口。沿用现有产物路径，避免再增加一层重复构建目录。

服务器安装 Node、PM2、Nginx 和原生后台服务，并在目标操作系统按 lockfile 安装运行依赖；Windows 的 `node_modules` 不直接复制到 Linux。PM2 入口消费同一配置适配器，运行编译入口；不依赖 `tsx` 或开发 watcher。Hydra 指定版本的原生二进制路径从环境配置读取。PM2 仅管理本项目应用，停止不能作用于其他项目。

应用启动成功后执行真实健康检查。Website schema、Outline 集成 marker、Hydra client/discovery 都必须符合当前环境。PM2 显示 online 不等于应用就绪。Nginx 保留同源请求、身份路由、`/docs` 挂载、WebSocket、内部路径拒绝与正确 HTTPS 转发；本机 HTTP 与服务器 HTTPS 使用同一业务和身份验证逻辑。

## 输出与错误

统一输出为启动标题、阶段状态、完成摘要和运行事件。`service:start` 列出三个依赖的地址和就绪结果，提示下一步、状态、日志和停止命令。`dev` 全部就绪后显示网站和文档入口，随后只显示更新、重启、警告和错误。`build` 按 Website 前端、后端、Outline 显示阶段、耗时、警告摘要和产物；失败立即展开该阶段文件/行号/必要上下文。`start` 显示 PM2 进程、PID、健康和访问入口。

TTY 可用颜色与简单进度；重定向、CI 和 `NO_COLOR` 使用稳定纯文本，不清屏。运行日志统一时间、级别、服务和消息，多行错误连续显示；详细输出通过 `--verbose`，默认不丢弃错误或未知警告。服务器保留结构化应用日志，终端格式化展示；日志保留量在配置中有界设置。

错误包含失败服务、阶段、脱敏目标、相关配置键、错误码与对应下一步。分别处理配置缺失、Docker 不可用、端口占用、DNS/连接拒绝/超时、密码错误、数据库不存在、migration 不完整和身份不匹配。连接失败不能统一翻译为 schema 缺失；`ECONNREFUSED` 不能单凭错误码断定本项目容器未启动，需结合真实 inventory。

默认与 verbose 都不能输出密码、秘密、Bearer、完整连接串或原始 SQL；新支持的短明文密码和 URL 编码密码同样覆盖脱敏。HTTP 对外错误 envelope 继续遵守原 Contract，不因 CLI 诊断增强而回显底层异常。

## 既有环境的切换

切换前停止应用写入并核对依赖、库、owner、卷及附件；保存完整备份、恢复清单与原环境文件。一次性维护记录保存在忽略的 `.local/`，不成为日常运行配置来源，也不进入持久 `.ai/` 叙事。

保留当前 PostgreSQL 18 的 `exre` 和原 volume。将 PostgreSQL 16 的最新 `outline`、`hydra` 用逻辑导出恢复到 PostgreSQL 18 的新候选库，验证迁移集合、owner、约束、关键表数量与数据摘要、账号、文档和附件引用。PostgreSQL 18 中同名的历史 Outline 数据库先以明确 legacy 名称保留，禁止直接覆盖或清空。校验成功后才切换数据库名及应用配置。备份与旧 PostgreSQL 16 卷保留以供回退。

固定后台默认端口意味着 Hydra issuer 从旧本地地址变为 `http://127.0.0.1:4444/`，这是身份迁移。保留 Website 账号、Outline 用户、subject 映射、文档、权限和管理员选择；先通过原目标完成已有 pending 撤销投递，停止新 OIDC flow，撤销旧文档登录绑定并使未完成 flow 重新发起，然后在受控迁移中同步 Outline integration marker 和 external identity 的 issuer。已保存旧登录凭据不假装在新 issuer 下有效，迁移后文档登录需重新建立。不能清空用户/文档或用重复 bootstrap 恢复已撤销的管理员权限。

迁移中的 client、identity marker 和 outbox 处理必须保留原来源校验与可重试边界；正常 `dev/start` 不承担迁移。切换失败时恢复原环境和服务目标，不使用新 issuer 向旧目标投递。切换成功并验收后才退役旧依赖容器及跨模式恢复代码；不删除备份卷。

## 验收与文档

验收覆盖：后台默认端口与失败提示；单一环境配置与密码格式；watch 更新与 Ctrl+C；Build 无后台服务仍可成功；构建产物的 PM2 启动与健康；真实 PostgreSQL 16→18 恢复及回退；旧 issuer→新 issuer 的重新登录、身份映射和撤销投递；前端与 Outline 文档、图片附件、协作和退出行为。每项分别报告自动测试、真实本机验收和未执行的服务器验收。

数据库自动测试继续使用临时 PostgreSQL/Redis，与开发库隔离。关键新增回归包含密码错误与连接拒绝的区别、普通设置变化不受旧 receipt 阻断、短密码与编码密码脱敏、端口冲突不自动换端口、构建不误加载运行秘密、PM2 online 但健康失败不报成功，以及迁移失败不丢失既有库或身份关联。

同步 `README.md`、`docs/runtime.md`、相关 `.ai/` 模块边界和根贡献说明中的旧入口；运行边界只保留一个事实来源。正式设计和 RFC 留在本模块目录。设计认可后再判断是否提炼长期知识，遵守项目对设计结论进入 `.ai/` 的审批要求。不创建 Outline 子模块内的新 Markdown。

## 证据与取舍

源码依据：`package.json`、`scripts/runtime/`、`scripts/docs-integration/`、`compose.local-dev.yaml`、`apps/server/src/db/client.ts`、`apps/server/src/identity/`、`apps/outline/server/env.ts`、`apps/outline/server/identity/`、`apps/outline/vite.config.ts`、`.ai/databases/data-model.md`。

采用单一用途的本地 Compose 与原生服务器运行，避免将已退役模式重新合并进 profiles。采用摘要加日志的输出，避免新增完整终端 dashboard。保留 PostgreSQL 18 并向上恢复文档库，避免把 Website 数据从 18 降到 16。[PostgreSQL pg_dump 的版本说明](https://www.postgresql.org/docs/18/app-pgdump.html)明确不保证导出结果可恢复到较旧主版本，因此采用旧库到现有较新版本的逻辑恢复，并以真实验证为准。

输出参考 [Turborepo 的构建日志控制](https://turborepo.dev/docs/reference/run#--output-logs-option)、[Docker Compose 就绪等待](https://docs.docker.com/reference/cli/docker/compose/up/)、[Vite logger 与清屏配置](https://vite.dev/config/shared-options#customlogger)和 [PM2 日志管理](https://pm2.keymetrics.io/docs/usage/log-management/)。这些是交互和生命周期参考，不要求额外引入整套构建或日志平台。

假设目标服务器为 Linux，服务和工具由操作者安装；当前未提供服务器环境或连接，不能确认真实服务器安装与公网运行。运行模型保持单实例。既有账号、秘密、存储、附件和 unrelated 工作区修改均需保留。
