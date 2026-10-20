# 把 Contract schema 限制在 Draft-07 兼容子集

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：已被 PHP 契约生成与验证链取代
- 模块：`api`
- 日期：2026-09-16
- 来源：`.notes/archive/backend-sandbox/specs/2026-09-16-backend-sandbox-scaffold-design.md` §6、`.notes/archive/backend-sandbox/rfcs/2026-09-16-contract-first-backend-sandbox-scaffold-rfc.md`「约束与已作决策」

_最后更新：2026-09-29_

## 背景

同一份 `api/openapi.yaml` 被两处 schema 引擎消费：Fastify（依据 Contract 做输入校验与响应序列化）与 Contract Test（用 Ajv 从 Contract 的 schema 校验响应）。

OpenAPI 3.1 的 schema 语义对齐 JSON Schema 2020-12，而 Fastify 默认的 Ajv 实现是 Draft-07 兼容语义。两者不是同一个规范。

## 决策

Contract 中的 schema 只使用 Draft-07 兼容子集：`type`、`const`、`enum`、`required`、`properties`、`additionalProperties`、数组与 `$ref` 等。

引入 Draft 2020-12 专有语义之前，必须先单独设计并确认 Fastify 的 validator 与 serializer compiler，不能只修改 Contract。

## 理由

只改 Contract 而不改运行时校验配置，会让 schema 在校验或序列化阶段表现出与设计不一致的行为，而且这种偏差不会以显式错误出现：写进 Contract 的关键字被忽略，响应仍然「正常」。这是最难定位的一类问题。

因此宁可把首版限制在确定可用的关键字范围内，把完整 3.1 支持留作独立设计。

## 影响

- 不能使用 `prefixItems`、`unevaluatedProperties` 等 2020-12 关键字。
- Contract Test 的 Ajv 以 `strict: false` 构造，未知关键字不会让测试失败，所以这层约束主要靠「每次创建 Fastify app 时的路由注册」来兜底。
- 将来放宽子集需要同时交付 validator/serializer compiler 配置与对应测试，而不是一次 Contract 改动。

## 重新审视的条件

- 业务确实需要 2020-12 专有语义（例如 `unevaluatedProperties` 的组合语义、`prefixItems` 的元组校验）时。
- Fastify 生态提供了可直接配置的 2020-12 validator/serializer compiler 时。

## 证据

- `api/openapi.yaml` 的 `info.description` 末段。
- `tests/contract/health.test.ts` 中 `toDraft07Definitions()` 与 `new Ajv({ allErrors: true, strict: false })`。
- `.notes/archive/backend-sandbox/rfcs/2026-09-16-contract-first-backend-sandbox-scaffold-rfc.md` 中的「Schema 兼容性」与对应风险行。
