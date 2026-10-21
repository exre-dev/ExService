# 由 Contract 注册路由，并显式声明前缀与 handler 映射

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：已被 PHP 显式路由与 OpenAPI 生成链取代
- 模块：`server`
- 日期：2026-09-16
- 来源：`.notes/archive/backend-sandbox/rfcs/2026-09-16-contract-first-backend-sandbox-scaffold-rfc.md`「Contract 到运行时的映射」

_最后更新：2026-10-08_

## 背景

Fastify 可以手写路由（`app.get('/health', handler)`），也可以由 `fastify-openapi-glue` 从 OpenAPI 文档注册。

另一个问题是前缀：Contract 中路径写作 `/health`，而前端期望请求 `/api/health`；`servers[0].url: /api` 描述的是客户端 base URL。

## 决策

- 用 `fastify-openapi-glue` 注册路由，显式传入三个选项：`specification`（Contract 路径）、`prefix: API_PREFIX`（`/api`）、`serviceHandlers`（`operationId -> handler` 映射）。
- 不在 route 文件中手写 `app.get()`，不从 Fastify schema 反向生成 OpenAPI，也不提供静态 JSON mock 路由。
- `serviceHandlers` 从 `src/app.ts` 导出，供 Contract Test 直接校验 handler 原始返回值。

## 理由

- 方法、路径、输入校验与响应 schema 全部来自 Contract，实现侧无法在不改 Contract 的情况下偷偷成为第二份 API 定义。
- `operationId` 显式映射使文件名与目录结构不参与解析：handler 文件可以重命名、搬移而不影响 Contract。
- `prefix` 只能来自注册配置：Glue 不会把 `servers[].url` 当作路由前缀，把两者混为一谈会导致 `/api/api/health` 或 `/health` 这类偏差。

## 影响

- 新增 operation 必须同时改 Contract 与 `serviceHandlers`，漏登记只在运行时表现为 500。
- `serviceHandlers` 的导出形状是测试的前提，不能改成不导出。
- 前缀被测试固定：未加前缀的 `/health` 必须返回 404。

## 重新审视的条件

- 需要多个前缀或版本化路由（例如 `/api/v2`）时。
- Glue 无法表达 Contract 所需的注册语义，或需要 Fastify 原生能力（如自定义 content-type parser、WebSocket 路由）时。

## 证据

- `apps/server/src/app.ts` 的 `API_PREFIX`、`OPENAPI_PATH`、`serviceHandlers` 与 `createApp()`。
- `tests/contract/health.test.ts` 的 `registers the contract path under the explicit /api prefix`。
- `AGENTS.md` 的「Server 实现约定」。
