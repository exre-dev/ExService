# 前端运行、配置与资源边界

根 `pnpm dev` 和 `pnpm dev:web` 运行 `scripts/runtime/frontend.mjs`：串行准备 PHP Contract 消费生成物及 SDK，启动 Website 与管理端 Vite，分别确认 HTML readiness 后报告就绪；Website 默认回环端口 8080，`--port` 显式覆盖。根 runtime 不启动或停止 PHP、PostgreSQL、Redis，不初始化 PHP 数据库或客户端。PHP 的服务、配置、数据与持久文件由 `apps/php-server/` 自行管理；步骤见 `apps/php-server/README.md`。

_最后更新：2026-10-20_

## 配置与开发代理

根普通 runtime 读取根 `.env.local`，受支持的进程变量优先；PHP 的 `apps/php-server/.env`、`apps/php-server/install.lock` 和持久文件由子模块独立管理。已有值须保留，不以示例配置覆盖。

`VITE_API_BASE_URL` 缺省 `/`，代表服务根。允许完整 HTTP(S) URL 及部署前缀，拒绝带凭据/query/hash 的地址与旧相对 `/api`。`PHP_SERVER_ORIGIN` 缺省 `http://127.0.0.1:8787`，只接受纯 origin，供开发代理使用。前端公开 origin 改动须核对 PHP `USER_WEB_URL`；PHP 示例缺省 `http://127.0.0.1:8080`。根配置只投影公开前端设置及操作系统/工具白名单，不将数据库、Redis、JWT 或任意 `VITE_*` 值传给前端子进程。

Vite 只代理 `/api` 路径边界及精确 `/oauth/authorize`、`/oauth/device` HTML 路径，保留前缀/query。`apps/web/dev-entry.ts` 保留回环、canonical Host、可信 forwarding、内部路径规范化拒绝、WebSocket 拒绝与 `no-referrer`；PHP 需独立验证实际 socket、代理和部署。

## 管理端

管理端保留 Ant Design，使用自己的 Axios/初始化 fetch 和 PHP 内部 Contract 类型，不接入 Website SDK。边界见 `.ai/architectures/admin-web/application-boundaries.md`。`pnpm dev:admin` 只启动管理端，无需准备 Website SDK。根入口读取 `LOCAL_ADMIN_WEB_PORT`（默认 `5173`）和 `ADMIN_API_PROXY_TARGET`（默认 `http://127.0.0.1:8787`）；进程变量优先，`--admin-port` 覆盖后台端口。管理端代理目标只接受纯 HTTP(S) origin，与 Website 的公开服务根和 PHP 代理配置互相独立。

两个前端端口必须不同，启动前检查占用；成功状态在全部前端 HTML 检查完成后报告。Ctrl+C 或任一前端退出会等待整组回收。

## 产物和进程

根 dev/test/typecheck/build 在消费者前串行调用 PHP Contract 消费生成器、SDK Vite bundle 与声明构建。watcher 监听 PHP 完整内部生成 YAML、SDK 源码和构建配置，排除 SDK 生成物与 dist。变更先停止旧前端，再串行准备；失败保持停止并等待后续变更。锁位于 `.local/runtime/frontend`，只接管证明已停止且无活跃子进程的前端记录；停止仅回收本轮可证明归属的进程。Windows JobObject 和回环 readiness 夹具验证该行为，不能据 PID 清理其他服务。

`pnpm build` 构建 Website 与管理端；`pnpm typecheck` 覆盖两个前端、组件、SDK 与 SDK 类型夹具。`pnpm test` 与 `pnpm test:full` 的边界见 `TESTING.md`。主仓库的源码退役不证明旧 PostgreSQL/Hydra 卷、client 或其他现场资源已经清理；任何已有环境迁移仍需另行核对现场对象和数据。

## 开发接入陷阱

`apps/web/vite.config.ts` 的 PHP 代理缺省目标为 127.0.0.1:8787，Server 必须保留 `/api` 前缀；剥除前缀会改变 PHP 路由。前端 origin 不共享浏览器 localStorage，别名 Host 的 307 跳转不会迁移旧 token。Vite HTML 200 只证明前端入口就绪；PHP HTTP、OAuth、SMTP、外部 provider 和部署验收各需独立证据。更具体的排查见 `.ai/knowledge/web/api-base-url-and-proxy-traps.md`。
