# API Contract 的结构与消费路径

`api/openapi.yaml` 是唯一 HTTP API Contract 入口，按路径和 schema 拆分源文件；Server、SDK 类型生成、测试和运行工具消费统一生成的 `api/generated/openapi.json`。选择理由见 `.ai/decisions/api/01-openapi-as-single-contract.md`。

_最后更新：2026-10-19_

## 源文件与生成物

`api/openapi.yaml` 声明顶层结构并引用 `api/paths/` 和 `api/schemas/`；`scripts/api/generate.mjs` 将它们打包成单份 JSON：

| 段落                         | 作用                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `openapi` / `info`           | 规范版本与 Contract 适用范围。                                                 |
| `servers[].url: /api`        | 描述客户端 API base URL；服务端路由前缀另由 Glue 注册。                        |
| `tags`                       | operation 的归类。                                                             |
| `paths`                      | 引用 `api/paths/` 中的 HTTP 方法、`operationId`、请求、响应与逐操作 security。 |
| `components.securitySchemes` | 声明 HTTP Bearer `bearerAuth`；受保护操作显式引用它。                          |
| `components.headers`         | 复用 `Cache-Control` 与 `Retry-After` header 规则。                            |
| `components.responses`       | 复用普通安全错误与带重试延迟的错误响应。                                       |
| `components.schemas`         | 引用 `api/schemas/` 中的共享 schema。                                          |

每个 operation 都以 `operationId` 绑定 Server handler；缺失或重复会破坏映射。部分公开操作显式写 `security: []`，受保护操作声明 `bearerAuth`。当前没有 API 版本策略或兼容层；破坏性 Contract 变更须单独评审。

`api/generated/openapi.json` 和 `packages/sdk/src/generated/schema.d.ts` 都是生成物，禁止手改或从 Server 实现反向生成。生成流程先校验引用与 operation，内容未变化时不重写。OpenAPI 3.1 schema 保持 Draft-07 兼容子集，原因见 `.ai/decisions/api/02-draft07-compatible-schema-subset.md`。

类型入口 `@workspace/sdk/types` 只公开 Contract 生成声明（包括 `paths`、`operations` 与 `components`），没有运行时 JavaScript；应用与 Server 用 `import type` 消费。运行时对象 API 的方法、路径与类型均从这些声明推导，公开入口及消费前的 SDK 构建要求见 `.ai/architectures/sdk/client-boundaries.md`。

## 错误响应

`components.responses.ErrorResponse` 和 `RetryableErrorResponse` 都引用同一份 `components.schemas.ErrorEnvelope`。后者额外要求 `Retry-After`，供需要告知等待时间的失败响应使用。operation 可显式声明 4xx/5xx，并以 `default` 覆盖其他失败；不能把早期“只有一份 response、没有显式 4xx”的描述当作当前 Contract。`ErrorEnvelope.error.code` 在 Contract 中仅约束为字符串，具体码值由 Server 实现维护。

## 消费路径

| 消费者                                         | 使用方式                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm api:lint`                                | 用 Redocly 检查源入口、引用和项目规则。                                         |
| `pnpm api:bundle` / `pnpm api:generate`        | 生成统一 JSON；后者还用 `openapi-typescript` 生成 SDK 类型。                    |
| `pnpm api:check`                               | 无写入核对 JSON 与 SDK 类型是否与源一致。                                       |
| `apps/server/src/contract/document.ts`         | 无副作用读取 JSON，解析内部 JSON Pointer 与 path item 引用，枚举 operation。    |
| `apps/server/src/http/plugin.ts`               | 检查 handler 覆盖后注册一次带 `/api` 前缀的 Glue。                              |
| `tests/helpers/contract.ts`、`tests/contract/` | 复用 reader，从 JSON 提取 schema，检查路由、原始输出和双向 `operationId` 覆盖。 |

`apps/server/src/domains/join/applications/form-validation.ts`、`apps/server/src/http/cors.ts` 与 `scripts/runtime/nginx.mjs` 也读取统一 JSON。`redocly.yaml` 的规则开关属于仓库 lint 配置，不改变 Contract 中已存在的 Bearer scheme、显式错误响应或 schema。
