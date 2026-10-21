# 跨模块架构总览

当前 Website 使用独立 PHP/Webman 子模块提供 HTTP，主仓库提供 React Web、TypeScript SDK 与仅前端开发工具。HTTP 定义和生成/消费责任见 `.ai/architectures/api/contract-layout.md`；数据模型见 `.ai/databases/data-model.md`。

_最后更新：2026-10-20_

## 请求与模块

`apps/php-server/app/route.php` 注册 PHP 路由。Controller 的 OpenAPI Attributes 和 `apps/php-server/app/common/openapi/` 定义两版互斥契约；PHP CLI 生成模块化与完整 YAML。主仓库 `scripts/api/` 从完整内部 YAML 生成 SDK 类型和 operation policy，包括管理端 operation；`apps/web/` 经 `@workspace/sdk` 调用完整 `/api/...` 路径。PHP 自有 HTML 与后台的原生请求继续遵守 PHP 仓库规则，无须改走本站 TypeScript SDK；公开契约的 operation 不进入该 SDK。

| 路径                   | 当前职责                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/php-server/`     | 独立 Composer/Webman 服务、数据库、Redis、文件、身份、PHP 自有页面和生成的 API 文档。             |
| `scripts/api/`         | PHP Contract 的主仓库消费与 SDK 产物核对。                                                        |
| `packages/sdk/`        | Browser/Node 本站 HTTP 单例与 file 上传。                                                         |
| `apps/admin-web/`      | Ant Design 管理端，独立请求 PHP；边界见 `.ai/architectures/admin-web/application-boundaries.md`。 |
| `apps/web/`            | React 页面、会话适配、Vite 代理与主题。                                                           |
| `packages/components/` | ExUI 共享 UI，不访问 API。                                                                        |
| `packages/common/`     | 共享纯逻辑，现有反馈内容子入口。                                                                  |
| `scripts/runtime/`     | 前端构建、监听、测试准备与可证明归属的子进程回收。                                                |

PHP 配置和持久数据归 PHP 所有。根 `pnpm dev` 与 `pnpm dev:web` 启动 Website（默认 8080）与管理端（默认 5173）；开发代理把 `/api`、精确 `/oauth/authorize` 和 `/oauth/device` 交给 PHP 8787，保留原路径。生产代理和 PHP 部署需独立配置与验证。`/docs`、`/docs/` 保留主站建设中页面，旧主站深路径仍用 404；PHP 自有 `/api/docs` 属另一服务入口。

## 构建与边界

主仓库根命令在消费方前串行准备 PHP Contract → SDK 类型/策略 → SDK 构建。`pnpm build` 构建 Website 与管理端，`pnpm typecheck` 检查 TypeScript 消费方；PHP 用 Composer 自己生成、测试和运行。`VITE_API_BASE_URL` 指服务根，默认 `/`；SDK operation 自带 `/api`。SDK 的成功响应保留 PHP `{msg,data}` 信封，错误按 HTTP 状态处理。会话和文件细节见 `.ai/architectures/sdk/client-boundaries.md`、`.ai/architectures/web/authentication-flow.md` 与 `.ai/knowledge/storage/lifecycle-traps.md`。

主仓库源码移除旧 Fastify/Hydra 编排，不意味着旧数据库、卷、client、头像或其他现场资源已经迁移或删除。当前测试和外部验收的证据层次见 `.ai/architectures/contract-tests/test-layers.md`。
