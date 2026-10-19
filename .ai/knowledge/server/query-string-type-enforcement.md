# 查询串是文本，Contract 声明的标量类型必须先强制

**结论：Contract 允许把查询参数声明成 `integer` / `number` / `boolean`，但 HTTP 查询串到达 Fastify 时一律是字符串。全局 `coerceTypes: false` 下，这类参数任何合法取值都会 400，而且与「正确拒绝越界取值」长得一模一样。**

_最后更新：2026-10-11_

## 失败模式

`api/openapi.yaml` 里 `listNotifications.limit` 是 `type: integer`
（通知模块引入的标量查询参数；Contract 0.6.0 已删除清理记录入口）。路由 schema 由
`fastify-openapi-glue` 直接取自 Contract，而 `apps/server/src/app.ts` 的 Ajv 关掉了类型强制；缺少归一化 hook 时会出现：

| 请求                                           | 状态                                        |
| ---------------------------------------------- | ------------------------------------------- |
| `GET /api/notifications?view=history`          | 200                                         |
| `GET /api/notifications?view=history&limit=20` | **400** `querystring/limit must be integer` |

客户端恒发 `limit`（`useNotificationsController.ts` 的两个列表入口），因此**通知的 Popup 与历史 Modal 在真实 Server 下全部打不开**，只有走 `/notifications/summary`（无查询参数）的徽标可用。

## 为什么之前没发现

- 浏览器侧验收的 `/api/**` 由 `fixtures.cjs` 在浏览器里拦截，不经过真实校验；
- Contract 测试只断言了越界 `limit=500` → 400，**没有断言合法 `limit` → 200**。
  于是「类型强制缺失」和「正确拒绝越界」在测试上不可区分。

这与 `.ai/knowledge/server/serialization-masks-handler-regressions.md` 是同一类问题：**只看得到拒绝的一侧，缺陷就和正确行为重合。**

## 如何应用

- 修复手段是 `preValidation` 钩子（早于 Fastify 校验）按路由自己的 querystring schema 把标量强制成声明类型，
  实现见 `apps/server/src/http/shared/query-coercion.ts`，由 `apps/server/src/http/shared/request-normalization.ts` 在 Glue 注册前安装。**不复制任何约束**：类型只从 Glue 依 Contract 生成的
  schema 读取，上下界、`enum`、`pattern` 仍由 Ajv 判定。
- 数值只接受 **JSON 数字字面量语法**（`^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$`）。不能用裸
  `Number(value)`：它还接受 `0x10`、`+20`、`.5`、`20.`、前后空白等 JSON 不允许的写法，照单全收等于
  放行了 Contract 语法本该拒绝的值（上下界会把影响限死，但拒绝原因会失真）。
- **`$ref` 声明的查询参数也在覆盖范围内**：`fastify-openapi-glue` 在解析 Contract 时就已把
  `#/components/schemas/*` 展开成内联 schema，`routeOptions.schema.querystring` 里不存在 `$ref`
  （实测 `view` / `scope` / `category` / `cursor` 四个 `$ref` 参数都以内联形式出现，且
  `request.server.getSchemas()` 为空 —— Glue 不向 Fastify 注册组件 schema）。因此不用自己解析 `$ref`；
  若将来换成不走 Glue 的注册方式，这一点必须重新核实。
  这条前提有持久守卫：`tests/contract/glue-querystring-schema.test.ts` 断言路由拿到的 querystring
  schema 不含 `$ref` 且带内联 `type`。缺了它，前提失效时 `apps/server/src/http/shared/query-coercion.test.ts` 里
  「`$ref` 属性原样不动」那条**不会**红 —— 它描述的就是这个跳过行为本身。
- **请求体不受影响**：`coerceTypes: false` 对 body 必须保持，否则数字 QQ 会被转成字符串
  （见 `.notes/archive/auth/rfcs/authentication-rfc.md` 的已接受约束）。不要把 `coerceTypes` 全局放开。
  这条有自动化守卫：`tests/contract/notifications.test.ts` 的
  `never coerces the request body while the query string is coerced`。
- 新增任何 `integer` / `number` / `boolean` 查询参数时，自动受益于该钩子；但仍必须补一条
  **合法取值 → 200** 的 Contract 用例，并保留越界取值 → 400 的反向用例。
- 另一种写法是被既有 `listJoinApplications` 采用的「`type: string` + `pattern`」约定
  （`api/openapi.yaml` 的 `limit` / `offset`）。两条路都能用，但不要混用：现在查询参数可以保留
  语义化的 `integer`，因为强制发生在 Server 侧。

## 证据

- `apps/server/src/http/shared/query-coercion.test.ts`（纯函数边界：空串、非数字、`Infinity`、布尔字面量、
  `type` 数组、重复参数、`$ref` 属性，以及 `0x10` / `+20` / `.5` / `20.` / `007` 这类非 JSON 数字写法）
- `tests/contract/notifications.test.ts` 的 `accepts every legal limit on the notification list`
  （`limit` 取 1 / 20 / 50 全部 200，并用 `limit=1` 翻页证明值真的传到了 service）
- `tests/contract/notifications.test.ts` 的 `never coerces the request body while the query string is coerced`
  （请求体 `expectedRevision: '0'` 与 `readThroughToken: 42` 都仍 400）
- 反向验证：临时摘掉钩子后该用例红，报的正是 `querystring/limit must be integer`。
