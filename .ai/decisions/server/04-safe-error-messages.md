# 只对外回显安全的错误消息

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：已被 PHP 错误响应边界取代
- 模块：`server`
- 日期：2026-09-16
- 来源：`.notes/archive/backend-sandbox/rfcs/2026-09-16-contract-first-backend-sandbox-scaffold-rfc.md`「安全与运行边界」

_最后更新：2026-10-08_

## 背景

未捕获异常的 `message` 可能包含 SQL 语句、PostgreSQL 连接信息、堆栈或原始异常内容。当前 Server 的响应会被浏览器与日志消费，即使尚未公网部署也必须避免泄漏。

## 决策

对外错误消息只允许两种来源：

1. Fastify 依据 Contract schema 生成的校验错误（`error.validation`）—— 它由 Contract 产生，不携带内部实现细节；
2. 固定文案。

其他异常（包括应用代码主动抛出的 4xx）一律不回显 `error.message`。另外：

- `error.statusCode` 先被规范到 `[400, 600)`，超出范围一律按 500 处理，避免异常状态码原样透出；
- 已知业务错误使用 `apps/server/src/modules/auth/errors.ts` 的固定分类与文案；其他异常按状态码推导（404 → `NOT_FOUND`，≥500 → `INTERNAL_ERROR`，其余 → `BAD_REQUEST`）；
- Fastify request ID 同时用于响应中的 `requestId` 与日志关联；5xx 写 `error` 日志，4xx 写 `warn` 日志。

邀请注册的哈希、投递和数据库异常可能带有提交秘密，因此 HTTP 异常日志只记录安全 code/status 分类，不序列化原始 Error、message 或堆栈。本地模拟邮件终端输出是显式投递适配器行为，不是普通请求异常日志。

## 理由

- 当前开发环境也必须避免泄漏内部状态，否则前端会依赖不安全的错误信息。
- 把状态码规范到合理区间，避免上游库传入的异常值（如 0 或 6xx）被原样发回。
- 校验错误是唯一有价值的安全回显，因为它直接告诉调用方 Contract 要求什么。
- 固定业务分类使调用方可处理重试或失效；保留原始异常日志会绕过响应已做的保密约束，因此不能把服务端日志当作任意秘密输出入口。

## 影响

- 调试依赖 request ID、安全分类和本地受控复现，不能从 HTTP 响应或普通异常日志读取原始异常细节。
- 业务错误必须来自固定的 AuthError 文案；未知 Error 无论是否带 4xx 都不回显其 message。
- 错误码取值集中在 `ErrorCode` 联合类型中；新增取值不需要改 Contract，但要保持 envelope 构造只在 `src/errors.ts` 一处。

## 重新审视的条件

- 需要向调用方返回结构化、可编程处理的业务错误细节时（应先在 Contract 中定义并评审）。
- 服务被部署到共享或非本地环境时。

## 证据

- `apps/server/src/errors.ts` 全文，尤其是 `resolvePublicMessage()` 与 `codeForStatus()`。
- `tests/contract/health.test.ts` 的 `does not leak internal details`。
- `api/openapi.yaml` 中 `ErrorEnvelope.error.message` 的 description。
- `.notes/archive/join-registration/rfcs/join-registration-rfc.md` 的错误语义及敏感日志边界。
