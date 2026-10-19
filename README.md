# ExWebsite

Website 使用独立 PostgreSQL `exre`；Hydra 提供 OIDC 协议并使用独立 `hydra` 数据库。Docker 运行 PostgreSQL、Hydra，Website 在宿主机开发监听。文档入口现为主站建设中页面。当前为本地开发阶段，不部署上线。

## 日常启动检查单

已有环境按以下顺序执行：

- [ ] Docker Desktop/daemon 已启动：`docker info` 能连接引擎。
- [ ] 根 `.env.local` 已填写现有配置，`RUNTIME_PROFILE=local`。保留原账号、密码、密钥、库和存储路径。
- [ ] 执行 `pnpm service:start`，直到显示“后台依赖已就绪”。
- [ ] 执行 `pnpm service:status`，确认 PostgreSQL、Hydra 都在运行。
- [ ] 执行 `pnpm dev`。启动检查通过后显示网站入口，默认 `http://127.0.0.1:8080/`。

启动失败会直接输出检查项、错误点、相关配置键和下一步。修正该项后重试；不要重复执行初始化或重置来绕过错误。Ctrl+C 结束应用，后台依赖继续运行；`pnpm service:stop` 停止本项目依赖并保留持久数据。

终端提示自动使用颜色；设置 `NO_COLOR=1` 可关闭。重定向输出和保存的日志保持纯文本；`pnpm dev --verbose` 显示完整日志时间。

## 只启动前端预览

安装依赖并执行一次 `pnpm --filter @workspace/sdk build` 生成 SDK 产物后，运行 `pnpm dev:web`，在 `http://127.0.0.1:8090/` 预览并使用热更新。该入口不要求 Docker、数据库或 Hydra 就绪；Ctrl+C 结束预览。端口被占用时会退出，可用 `pnpm dev:web --port 8091` 指定其他端口。

在根 `.env.local` 中设置 `VITE_API_BASE_URL=https://your-service.example/api`，浏览器即可直接请求该服务。进程变量优先；未设置或为空时使用 `/api`，通过 Vite 代理到 `LOCAL_API_PORT` 指定的本地服务，缺省为 `8082`。服务不可用时沿用页面现有错误状态。

远端 Website 服务须通过 `SERVER_CORS_ALLOWED_ORIGINS` 放行预览 origin（默认 `http://127.0.0.1:8090`）。地址包含 API 路径；此配置只放公开地址。Web 在首个请求前通过 SDK 的 `setBaseUrl` 配置 API root，并按该 root 恢复会话；SDK 不自行读取 Vite 环境变量。完整 `pnpm dev` 和 `pnpm build` 继续使用同源 `/api`。

## 首次准备检查单

仅全新环境执行；已有环境跳过已经完成的项。

- [ ] 安装 Node 22.12+、pnpm 11.9.0、Corepack 和 Docker Compose。
- [ ] 安装根依赖：`pnpm install --frozen-lockfile`。
- [ ] 按根 `.env.example` 填写 `.env.local`：Website 与 Hydra 数据库组件字段及原始秘密。库名分别为 `exre`、`hydra`，各自使用独立 owner；应用只读取根配置，进程变量优先。
- [ ] 显式创建独立 Website `exre` 及其 owner，然后执行 `pnpm db:migrate`。
- [ ] 执行 `pnpm infra init`，显式准备 Hydra 数据库及 migration；该命令不会创建 Website `exre`。
- [ ] 执行 `pnpm service:start`。如需接入应用，在 `IDENTITY_CLIENTS_JSON` 配置明确的客户端，再执行 `pnpm infra clients`。默认 `[]` 无需登记，不创建默认应用。
- [ ] 执行 `pnpm dev`。

普通启动只检查就绪状态，不创建库、迁移、重置或登记 client。已有环境切换旧 URL 配置时，先核对原连接目标和凭据，再显式执行 `pnpm infra convert`；它备份配置并保留原值，不迁移数据。更换持久卷、PostgreSQL 版本、issuer 或已有凭据需要独立维护，不属于启动检查单。

旧 Outline 环境的资源清理是独立维护：`node scripts/runtime/retire-outline.mjs --plan` 缺省只读，需要原配置及归属证明。清理前保留原配置和资源记录，不能删除证明或重置 PostgreSQL/Hydra 来绕过核验。维护边界见 `.ai/architectures/runtime/runtime-boundaries.md`。

## 常用命令

| 目的                | 命令                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| 启动/停止后台依赖   | `pnpm service:start` / `pnpm service:stop`                                  |
| 查看状态/日志       | `pnpm service:status` / `pnpm service:logs [postgres\|hydra]`               |
| 开发监听            | `pnpm dev`                                                                  |
| 仅前端热更新预览    | `pnpm dev:web`                                                              |
| Website 显式迁移    | `pnpm db:migrate`                                                           |
| Hydra 显式迁移      | `pnpm infra migrate`                                                        |
| 显式登记身份客户端  | `pnpm infra clients`                                                        |
| 自动测试/监听测试   | `pnpm test` / `pnpm test:watch`                                             |
| 构建                | `pnpm build`                                                                |
| Contract 与类型检查 | `pnpm api:lint` / `pnpm api:generate` / `pnpm api:check` / `pnpm typecheck` |

首次本地测试前先执行 `pnpm exec playwright install chromium`，准备默认测试使用的 Browser SDK Chromium 夹具；Linux 需要系统依赖时使用 `pnpm exec playwright install --with-deps chromium`。日常 runtime 不自动安装浏览器。

测试使用临时数据库，不连接开发库；Build 不连接数据库或启动 Docker。自动测试、本机生命周期、浏览器和部署验收分别报告。

## 提交前格式化

`pnpm install --frozen-lockfile` 会通过 `prepare` 安装当前工作树的 Git Hook；已有依赖时可运行 `pnpm prepare`。Codex 的 `$commit`、CodeBuddy、Claude 和手动 `git commit` 都使用同一提交流程。

提交前由 Husky 调用 lint-staged，只对暂存文件执行 Prettier，格式化结果自动进入本次提交。部分暂存文件的未暂存改动会保留。格式化失败时提交中止，修复错误后重新暂存并提交。

格式规则位于 `.prettierrc.json`，生成文件和输出目录由 `.prettierignore` 排除。手动处理单个文件可执行 `pnpm exec prettier --write <文件路径>`；`pnpm format` 和 `pnpm format:check` 分别格式化、检查全仓库，范围与提交前检查不同。Hook 的隔离验证命令为 `pnpm test:formatting`，安装边界见 `.ai/knowledge/tooling/pre-commit-formatting.md`。

## 工程入口

`api/openapi.yaml` 与 `api/paths/`、`api/schemas/` 是唯一 HTTP Contract 源，统一生成 `api/generated/openapi.json` 和 `packages/sdk/src/generated/schema.d.ts`；`apps/server/` 是唯一 Website Fastify Server；Browser 与 Node 的本站业务 HTTP 调用统一使用 `@workspace/sdk` 的 `instance({...})`，上传使用同包 `storage`。生产启动只读取已有产物。`packages/common/` 通过 `@workspace/common/node/identity-config` 为 Server 与 runtime 提供共享的纯身份配置解析。ExUI 使用 pnpm lockfile 锁定的 registry 包。

根 `pnpm dev`、`pnpm typecheck`、`pnpm test`（含 watch 每轮）和 `pnpm build` 按顺序准备 Contract → SDK 构建，再启动各自消费者；单独 Server 开发入口也先准备。SDK 的公开入口读取 `dist/`，仅运行 `tsc --noEmit` 不会生成可消费产物。

直接运行低层 Web 开发命令前，先依次执行 `pnpm api:generate`、`pnpm --filter @workspace/sdk build`，再执行 `pnpm --filter @workspace/web dev`。该低层入口不自动重建 SDK；修改 Contract 或 SDK 后优先使用根 `pnpm dev`，其监督器会停止应用、串行准备并重新启动，重建失败则保持应用停止，等待下一次源码修改。

同一 checkout 同时只允许一个写入 Contract/SDK 产物的命令。不要并行运行 dev、test/watch、typecheck、build、`api:generate` 或 SDK build；需要独立验证时先停止当前命令，或使用不同 checkout。应用锁不等于跨命令构建锁。

开发规则见 `AGENTS.md`，模块知识从 `.ai/README.md` 查阅，运行与资源边界见 `.ai/architectures/runtime/runtime-boundaries.md`，身份客户端边界见 `.ai/architectures/identity/integration-boundaries.md`。
