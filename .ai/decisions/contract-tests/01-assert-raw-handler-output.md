# Contract Test 必须断言 handler 的原始返回值

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：旧 Fastify handler 检查已退役
- 模块：`contract-tests`
- 日期：2026-09-16
- 来源：`apps/server/src/app.ts` 与 `tests/contract/health.test.ts` 中的实测结论

_最后更新：2026-09-29_

## 背景

Fastify 用 Contract 的 response schema 序列化响应。这意味着到达测试的 HTTP 响应已经被 schema 改写过一次，而不是 handler 的真实返回值。

## 决策

Contract Test 除 HTTP 断言外，**必须**同时校验 `serviceHandlers` 中注册的 handler 的**原始返回值**，并用从 Contract 编译出的 schema 校验它。

为此 `apps/server/src/app.ts` 必须导出 `serviceHandlers`。

## 理由

序列化会主动改写 handler 的输出，因此只断言 HTTP 响应体无法覆盖 handler 的回归。被掩盖的具体漂移类型、实测结果与它的边界见 `.ai/knowledge/server/serialization-masks-handler-regressions.md`。

被否决的方案就是「只断言 HTTP 响应体」：它看起来在验证 Contract，实际验证的是序列化后的结果。这层原始返回值断言的存在理由就是补上这个缺口。

## 影响

- `serviceHandlers` 的导出形状成为测试的硬约束，不能在重构中移除。
- 新增 operation 时，除了 HTTP 用例，还必须补一组直接调用 handler 的用例。
- 反向用例（多字段 / 缺必填 / 违反 `const` / 类型错误必须判为不合法）是这层保护的另一半，不能只留正向断言。

## 重新审视的条件

- 响应不再经过 schema 序列化（例如改为手动构造响应体）时，需要重新评估这层断言是否仍然必要。
- 引入能在运行时对比 handler 输出与 schema 的其他机制时。

## 证据

- `tests/contract/health.test.ts` 的 `registered handler output` 与 `contract schema enforcement` 两组用例，以及文件顶部解释这组断言为何必需的注释。
- `apps/server/src/app.ts` 中导出 `serviceHandlers` 及其注释。
- `AGENTS.md` 的「Server 实现约定」中关于「响应序列化会掩盖 handler 回归」的段落。
