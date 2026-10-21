# 序列化会掩盖 handler 回归

> 已退役：历史 Node/Fastify 实现记录。文中路径、命令和行为仅用于理解当时选择；现行 PHP/Webman 边界见 `.ai/architectures/overview.md`、`.ai/architectures/api/contract-layout.md` 与 `apps/php-server/TESTING.md`。

**结论：对 Server 的 Contract 断言，只校验 HTTP 响应体是不够的，必须同时校验 `serviceHandlers` 中注册的 handler 的原始返回值。**

_最后更新：2026-10-11_

## 失败模式

Fastify 用 Contract 的 response schema 序列化响应，这个过程会主动改写 handler 的输出：

- **未声明的字段被静默丢弃**：handler 返回 `{ status: 'ok', secret: 'x' }`，线上响应仍是 `{"status":"ok"}`。
- **`const` 声明被强制写入**：handler 返回 `{ status: 'down' }`，线上响应仍是 `{"status":"ok"}`。
- **类型被 schema 归一**：handler 返回 `{ status: 42 }`，线上响应仍是 `{"status":"ok"}`。

只有「缺少必填字段」这一种漂移会让序列化失败并变成 500，从而能被 HTTP 断言抓到。多字段、错误常量值、错误类型这三类漂移在 HTTP 层完全不可见。

## 为什么必须这样断言

这意味着 Server 可以长期返回与 handler 真实行为不符的响应，而所有 HTTP 断言保持绿色。handler 的回归只能通过直接调用它、在序列化之前校验返回值来发现。

## 如何应用

- 断言 handler 原始返回值时，使用 `apps/server/src/http/service-handlers.ts` 汇总、由 `apps/server/src/app.ts` 转出的 `serviceHandlers`，不要再绕一层 HTTP。
- 新增 operation 时，除 HTTP 断言外必须补一组原始返回值断言，并让返回值通过从 Contract 编译出的 schema 校验。
- 反向用例（多字段 / 缺必填 / 违反 `const` / 类型错误都必须判为不合法）用于证明校验真的在生效，而不是恰好没有反例。
- 不要为了「让测试更好写」而在 handler 里放宽返回类型或删掉 `additionalProperties: false`：被放宽的正是这层唯一的保护。

## 证据

- `tests/contract/health.test.ts` 的 `registered handler output` 与 `contract schema enforcement` 两组用例，以及文件顶部说明这组断言为何必需的注释（含上述三类实测结果）。
- `apps/server/src/http/service-handlers.ts` 的映射与 `apps/server/src/app.ts` 的转出。
