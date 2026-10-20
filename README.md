# ExWebsite

ExWebsite 的 React 前端位于 `apps/web/`，本站 HTTP 服务由独立 PHP/Webman 子模块 `apps/php-server/` 提供。主仓库使用 PHP 内部 OpenAPI 生成 TypeScript SDK；PHP 自行管理 Composer、PostgreSQL、Redis、配置与运行数据。当前文档说明本地开发接线，不代表部署验收。

## 开发入口

1. 安装 Node 22.12+、pnpm 11.9.0，并执行 `pnpm install --frozen-lockfile`。
2. 在 `apps/php-server/` 按该仓库 `apps/php-server/README.md` 和 `apps/php-server/TESTING.md` 准备兼容 Composer lock 的 PHP、依赖、配置与服务；PHP 现有 `apps/php-server/.env`、`apps/php-server/install.lock` 和数据应由 PHP 自身管理。PHP API 默认 origin 为 `http://127.0.0.1:8787`。
3. PHP API 定义变化时，在子模块执行 `composer api:generate`、`composer api:lint`、`composer api:check`。主仓库随后执行 `pnpm api:generate`，生成 SDK 类型和 operation policy。
4. 执行 `pnpm dev` 或 `pnpm dev:web`。两个命令都是前端入口，默认监听 `http://127.0.0.1:8080/`；启动前串行准备 SDK，Vite HTML readiness 通过后报告就绪。端口冲突会失败，可用 `pnpm dev --port 8081` 显式改端口。

主仓库的开发命令不启动、初始化或停止 PHP、PostgreSQL、Redis，也不接管 PHP 数据。更换前端端口时同步核对 PHP 的 `USER_WEB_URL`；子模块公开示例默认 `http://127.0.0.1:8080`。

前端配置可写入根 `.env.local`，模板见 `.env.example`；已有配置保留原值，不用模板覆盖。受支持的进程变量优先。PHP 的 `apps/php-server/.env` 和安装状态属于子模块，不由根配置替代。

## 管理端

管理端保留 Ant Design，使用自己的 Axios/初始化 fetch 和 PHP 内部 Contract 类型，不接入 Website SDK。边界见 `.ai/architectures/admin-web/application-boundaries.md`。`pnpm dev:admin` 只启动管理端，无需准备 Website SDK。根入口读取 `LOCAL_ADMIN_WEB_PORT`（默认 `5173`）和 `ADMIN_API_PROXY_TARGET`（默认 `http://127.0.0.1:8787`）；进程变量优先，`--admin-port` 覆盖后台端口。管理端代理目标只接受纯 HTTP(S) origin，与 Website 的公开服务根和 PHP 代理配置互相独立。

根 `pnpm dev`、`pnpm dev:web` 同时启动两个前端，分别检查 HTML 就绪状态；端口重复或被占用时失败，任一前端意外退出会回收整组。`pnpm dev --port 8081 --admin-port 5174` 分别覆盖两个前端端口。

PHP Contract 更新后运行 `pnpm --filter @workspace/admin-web api:generate` 和 `pnpm --filter @workspace/admin-web api:check`；独立 build/typecheck 不生成 Website SDK 或连接数据库。

## 请求与代理

`VITE_API_BASE_URL` 是**服务根**，默认 `/`；完整 PHP operation 路径包含 `/api`。例如服务根 `https://example.test/backend` 与 `/api/auth/me` 合成 `https://example.test/backend/api/auth/me`。可设置绝对 HTTP(S) 服务根和部署前缀；旧值 `/api` 不是有效服务根。`PHP_SERVER_ORIGIN` 只用于开发代理，默认 `http://127.0.0.1:8787`，必须是纯 origin。

Vite 将 `/api` 路径边界以及 `/oauth/authorize`、`/oauth/device` 两个 PHP HTML 路径转发到 PHP，保留路径和查询参数。登录、注册、SSO 成功页与其他 SPA 路径由 Web 处理。PHP `/oauth/device` 对未登录访问仍返回 401；页面代理不表示该上游行为已改变。跨 origin 直连仍需 PHP 允许实际浏览器 origin。请求、token 与上传边界见 `.ai/architectures/sdk/client-boundaries.md` 和 `.ai/architectures/web/authentication-flow.md`。

## 常用命令

| 目的               | 主仓库命令                                                        |
| ------------------ | ----------------------------------------------------------------- |
| 前端开发           | `pnpm dev` 或 `pnpm dev:web`                                      |
| PHP 契约消费检查   | `pnpm api:lint`、`pnpm api:check`                                 |
| 更新 SDK 生成物    | `pnpm api:generate`                                               |
| 定向/轻量/完整测试 | 按 `TESTING.md` 选用；`pnpm test` 为轻量，`pnpm test:full` 为完整 |
| 类型与 Web 构建    | `pnpm typecheck`、`pnpm build`                                    |
| 前端端口           | `pnpm dev --port <port>`                                          |

`pnpm api:lint` 验证 PHP 两版模块化入口；`pnpm api:generate` 从完整内部 YAML 的单一快照生成 `packages/sdk/src/generated/schema.d.ts` 和 `packages/sdk/src/generated/operation-policy.ts`；`pnpm api:check` 只读比较这两项产物。它们不替代 PHP 自身的路由覆盖、业务测试或 Composer 命令。公开和内部 Contract 的归属见 `.ai/architectures/api/contract-layout.md`。

根 `pnpm dev`、`pnpm test`、`pnpm typecheck` 和 `pnpm build` 按顺序准备 SDK；SDK 公开入口消费构建产物。直接运行底层 Web 命令前，先串行执行 `pnpm api:generate`、`pnpm --filter @workspace/sdk build`。同一 checkout 的生成、构建和监听命令应串行，避免共享产物竞争。根 `pnpm build` 依次构建 Website 和管理端；`pnpm typecheck` 检查两个前端、组件、SDK 和类型夹具，不编译 PHP。

本地开发按影响执行定向测试；不自动运行整套根测试或检查。`TESTING.md` 定义快速、完整和页面浏览器验收的边界；PHP 测试由 `apps/php-server/TESTING.md` 独立管理。主 CI 工作流配置了 PHP 子模块递归检出与主仓库检查，工作流存在不表示远端 CI 已运行。

## 工程边界

`apps/php-server/api/public/` 与 `apps/php-server/api/internal/` 是 PHP 生成的模块化 OpenAPI，`apps/php-server/api/generated/` 提供完整单文件。主仓库 `@workspace/sdk` 只消费内部契约；Website 业务 HTTP 调用经 SDK 的 `instance({...})`，上传经同包 `storage`。PHP 自有 HTML 页面、后台与第三方接线遵守 PHP 仓库边界。`packages/common/` 提供跨应用纯逻辑；`packages/components/` 提供共享 UI。ExUI 使用 lockfile 固定的 registry 包。

提交前 Hook 仅格式化暂存文件。`pnpm format` 与 `pnpm format:check` 使用根 Prettier 范围，排除 PHP 子模块；PHP 文档遵守子模块自己的格式规则。开发规则见 `AGENTS.md`，持久知识索引见 `.ai/README.md`，运行和资源边界见 `.ai/architectures/runtime/runtime-boundaries.md`。
