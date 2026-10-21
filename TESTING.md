# 测试

本文件是主仓库测试流程、用例归类和执行范围的唯一规则来源。PHP 子模块按 `apps/php-server/TESTING.md` 独立执行 Composer/PHP 测试；结构与证据层次见 `.ai/architectures/contract-tests/test-layers.md`。

## 开发阶段

开发时只按当前变更执行相关定向 test，用于复现、实现和回归。除非用户明确要求，不自动运行整仓测试或整套检查：`pnpm test`、`pnpm test:watch`、`pnpm test:full`、`pnpm typecheck`、`pnpm build`、`pnpm api:check` 和 `pnpm format:check` 都不是固定收尾步骤。定向验证所需的 Contract 生成与 SDK 构建可按需执行。

PHP 源码或契约变化由 PHP 仓库规则决定语法、工具和行为测试；主仓库的 TypeScript 检查不覆盖 PHP。修改两端接线时分别执行受影响测试，并说明每项实际运行结果。

## 本地提交与 PR

本地 Commit 不自动执行整仓测试。Git Hook 只格式化暂存文件，不运行测试、类型检查或 Build。创建代码 PR 前集中运行 `pnpm test`，按影响补 Contract 检查、类型检查或 Build；纯文档变更只核对内容、路径与格式。报告未运行或被阻塞的检查项。

## 轻量与完整范围

`pnpm test` 在串行准备 PHP Contract 消费产物与 SDK 后，执行 `vitest.quick.config.ts` 的 Web/共享包/SDK 轻量测试，以及 `scripts/runtime/tests.mjs` 登记的轻量 Node 测试；不要求 Docker 或 Chromium。`pnpm test:watch` 重复同一轻量范围。

`pnpm test:full` 使用 `vitest.config.ts` 和全部登记的 Node 测试，包括真实 SDK HTTP、公开包 Chromium、Vite 打包、开发代理与进程/锁清理等夹具。该范围不包含 PHP 子模块的 Composer 测试，不需为已退役的 Node Server 配置 PostgreSQL/Nginx 测试容器。本地运行完整范围前按需安装 `pnpm exec playwright install chromium`；Linux 若缺系统依赖使用 `pnpm exec playwright install --with-deps chromium`。`pnpm test:full --watch` 为显式完整监听。

根 CI 工作流配置递归检出 PHP 子模块、`pnpm api:check`、`pnpm typecheck`、`pnpm build` 与 `pnpm test:full`。它与 PHP 仓库自身 CI 分属不同配置；工作流内容不证明远端 CI 已通过。

## 用例选择与命令

- 前端纯逻辑、jsdom、mock 交互进入轻量范围；真实浏览器、打包、实际 HTTP 与进程清理夹具保留在完整范围。Node 文件在 `scripts/runtime/tests.mjs` 登记，依赖完整环境的文件标记 `fullOnly`。
- SDK 类型、操作策略、上传、401 失效与 Web 持久凭据竞争要按真实 PHP 路径、`{msg,data}` 信封和 HTTP 状态断言；PHP HTTP 业务副作用与响应由子模块测试验证。
- 定向 Vitest 可执行 `pnpm exec vitest run --config vitest.quick.config.ts <文件>` 或 `pnpm exec vitest run --config vitest.config.ts <文件> --maxWorkers 2`；直接运行前须有与当前 PHP Contract/SDK 一致的已构建产物。Node 用例可用 `node --test <文件>`。
- 同一 checkout 的根 dev、test/watch、typecheck、build、Contract 生成及 SDK build 应串行，避免共享生成物竞争，详见 `.ai/architectures/runtime/runtime-boundaries.md`。

管理端的 API、鉴权和路由行为测试位于 `apps/admin-web/src/`，进入根 Vitest 轻量和完整范围。可用 `pnpm exec vitest run --config vitest.quick.config.ts apps/admin-web/src` 定向运行。管理端独立类型检查和构建分别使用 `pnpm --filter @workspace/admin-web typecheck`、`pnpm --filter @workspace/admin-web build`。

## PHP HTTP 与浏览器证据

PHP `tests/website_http.php` 用真实 Webman 路由、全局/局部中间件和控制器，通过进程内捕获传输执行请求；使用临时 PostgreSQL schema、Redis 前缀、私有文件根与录制邮件替身。它验证响应、状态和副作用，但不验证监听 socket、Workerman 报文限制、反向代理、SMTP 或页面浏览器。具体环境变量和清理规则见 `apps/php-server/TESTING.md`。

页面浏览器验收按需独立运行：仅在用户明确要求或操作者显式选择相关脚本时执行。`tests/browser/` 的页面布局、弹窗、焦点、主题和导航脚本不由 `pnpm test` 自动追加；完整范围中的 SDK Chromium 夹具不等于整站页面验收。交付时分别说明轻量测试、完整集成、PHP 进程内 HTTP、真实浏览器、外部服务及部署的实际证据。

管理端初始化向导的显式 mock 浏览器入口为 `node tests/browser/admin-web-installation.mjs`，截图写入已忽略的 `output/admin-web/`。该入口拦截 API，不初始化真实 PHP 或数据库，不进入轻量自动执行范围。真实 PHP 登录、平台/空间操作和跨应用 SSO 另行验收。
