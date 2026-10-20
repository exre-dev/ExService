# 所有错误共用同一个 envelope

> 已被 PHP 接管取代：以下正文保存当时决定与理由，旧路径、命令、schema 和测试不再指导现行实现。当前边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 和 `.ai/databases/data-model.md`。

- 状态：已被 PHP 响应与 HTTP 错误边界取代
- 模块：`api`
- 日期：2026-09-16
- 来源：`.notes/archive/backend-sandbox/specs/2026-09-16-backend-sandbox-scaffold-design.md` §6.2、`redocly.yaml`

_最后更新：2026-09-29_

## 背景

Server 需要对外表达多种失败：未声明路径、请求校验失败、未捕获异常。同时这些失败的原始信息可能包含堆栈、SQL、PostgreSQL 连接信息或原始异常内容。

Web 和唯一 Server 需要一条稳定的错误解析路径。

## 决策

- Contract 中只有一份错误结构：每个 operation 的 `default` 响应引用 `components/responses/ErrorResponse`，它指向 `components/schemas/ErrorEnvelope`。
- `ErrorEnvelope.error.code` 只被约束为 `string`；**具体错误码取值属于实现侧的约定**，新增取值不需要改 Contract。
- Redocly 的 `operation-4xx-response` 规则被显式关闭，避免额外声明 4xx response 而引入第二份错误定义。
- 后续业务 operation 必须引用该 response；想返回另一种错误格式，必须先在 Contract 中定义、评审并版本化。

## 理由

- 单一错误结构让 Web 和 Server 只有一种解析方式。
- 把 `code` 保持为 `string` 使实现可以自由新增错误码，不必为每个新错误码走一次 Contract 变更。
- 关闭 lint 规则时要带上理由（`redocly.yaml` 中每条被关闭的规则都有注释），否则后人无法区分「有意为之」与「顺手忽略」。

## 影响

- 错误码不再是 Contract 的一部分，调用方不能依赖 Contract 来枚举它们；取值集中在 `apps/server/src/errors.ts`。
- 调试信息只能进服务端日志，不能进响应体。
- 新增 operation 时若忘记引用 `default` 响应，会破坏这条唯一性，但当前没有 lint 规则会报错。

## 重新审视的条件

- 出现需要机器可读、可枚举错误码的调用方时（应把 code 的取值域写进 Contract 并版本化）。
- 需要区分多种错误结构（例如采用 RFC 9457 的问题详情格式）时。

## 证据

- `api/openapi.yaml` 的 `components.responses.ErrorResponse`、`components.schemas.ErrorEnvelope`。
- `redocly.yaml` 中 `operation-4xx-response` 的关闭及其理由注释。
- `apps/server/src/errors.ts` 的 `ErrorCode` 联合类型与注释。
- `tests/contract/health.test.ts` 的 `undeclared routes` 一组用例。
