# 管理端应用边界

`apps/admin-web/` 是主仓库维护的独立 React SPA，包名为 `@workspace/admin-web`。它参考 Website 的严格 TypeScript、模块分层、CSS Modules 和邻近行为测试约定，保留原管理端的 Ant Design、路由与业务交互。Website 的 ExUI、表单和通知规则不要求替换管理端界面。

_最后更新：2026-10-20_

## 请求与类型

管理端消费 PHP 内部 Contract `apps/php-server/api/internal/openapi.yaml` 及其引用模块。Website 的 `api/openapi.yaml`、Fastify、Hydra 与 `@workspace/sdk` 不承担这些请求。浏览器保持同源 `/api`，管理端 Vite 单独代理到 PHP origin；具体公开配置、过滤与进程归属见 `.ai/architectures/runtime/runtime-boundaries.md`。

`apps/admin-web/src/api/` 隔离 Axios 传输、应用通知/跳转接线与无需会话的初始化 fetch。业务请求的成功结果是 PHP 信封的 `data`，不能将它声明为 `AxiosResponse`。初始化接口在会话与缓存尚未就绪时也须独立可用，提交保留 `X-Setup-Request` 和原有强制初始化确认语义。

PHP 类型生成物为 `apps/admin-web/src/api/schema.d.ts`，由 `apps/admin-web/scripts/schema.mjs` 从 PHP Contract 生成；包脚本 `api:generate` 显式生成，`api:check` 校验一致性，禁止手改产物。包级 build/typecheck 只读取已提交类型，不读取 PHP 来源或触发契约生成。PHP 契约变化由后端负责人协调后显式刷新管理端类型，Website SDK 的生成流程保持独立。

## 页面与会话

`apps/admin-web/src/main.tsx` 只提供一次 BrowserRouter，`apps/admin-web/src/App.tsx` 声明路由；初始化检查、错误恢复和未安装导航由 `apps/admin-web/src/routes/` 的门禁承担。`apps/admin-web/src/auth/` 管理会话和持久化，页面不负责创建另一套请求/会话管线。路由保持独立站点根路径，包括 `/login`、`/install` 与空间深链接，不增加 `/admin/` basename。静态服务须提供 SPA fallback。

会话保留原有 `exre_token`、`exre_user` 存储键，管理端与 Website 的 origin、持久化和鉴权边界独立。迁移不复制登录态，也不将旧 `localhost` origin 的会话搬到 `127.0.0.1`。

## 源码归属与证据

日常运行和构建使用 `apps/admin-web/`，不读取 PHP 中的旧前端目录。PHP 子模块拥有后端源码、数据、配置和测试；其旧管理端目录及旧脚本的清理由后端负责人协调。本工程不建立双向源码同步。

轻量 API、会话和路由测试随根 Vitest 执行。初始化 mock 浏览器验收的显式入口、截图目录和测试层次集中在 `TESTING.md`。管理端页面就绪、前端编译和 mock 成功均不证明真实 PHP 登录、安装、平台/空间操作、跨应用 SSO 或部署已验收。
