/**
 * HTTP 查询串在协议层永远是一段文本，`?limit=20` 到达 Fastify 时是字符串 `"20"`。
 * Contract 允许把查询参数声明成 `integer` / `number` / `boolean`（`limit` 就是 `integer`），
 * 而全局 `ajv.customOptions.coerceTypes` 被显式关掉，于是这类参数**任何合法取值都会 400**。
 *
 * 本模块在校验之前（`preValidation` 早于校验）把标量查询参数强制成 Contract 声明的类型。
 * 它不复制任何约束：类型只从路由自己的 querystring schema 读取，而该 schema 由
 * `fastify-openapi-glue` 从 `api/openapi.yaml` 生成，因此 Contract 仍是唯一来源。
 * 上下界、`enum`、`pattern` 全部继续由 Ajv 判定，这里只做「文本 → JSON 标量」这一步。
 *
 * 请求体不受影响：`coerceTypes: false` 对 body 保持不变，数字 QQ 不会被转成字符串。
 */

/** Contract 允许声明、而文本无法直接满足的标量类型。其余类型（`string`、对象、`$ref`）一律不动。 */
const COERCIBLE_SCALARS = new Set(['integer', 'number', 'boolean'])

/**
 * JSON 数字字面量语法（`RFC 8259` number）。
 *
 * 不能直接用 `Number(value)`：`Number` 还接受 `0x10`、`+20`、`.5`、`20.`、前后空白等
 * JSON 不允许的写法，照单全收等于放行了 Contract 语法本该拒绝的值。
 */
const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

function declaredTypes(schema: unknown): string[] {
  if (typeof schema !== 'object' || schema === null) return []
  const type = (schema as { type?: unknown }).type
  if (typeof type === 'string') return [type]
  if (Array.isArray(type)) return type.filter((entry): entry is string => typeof entry === 'string')
  return []
}

function coerceText(value: string, types: readonly string[]): unknown {
  if (types.includes('integer') || types.includes('number')) {
    // 不是 JSON 数字字面量的文本（含空串与 `Infinity`）保持原样：让 Contract 的 `type` 给出 400，
    // 而不是换成 0 / NaN / 16 使拒绝原因失真或被静默放行。
    if (!JSON_NUMBER.test(value)) return value
    return Number(value)
  }
  if (types.includes('boolean')) {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return value
}

/**
 * 按 `querystringSchema` 声明的标量类型原地强制 `query` 的值。
 *
 * 只处理**声明了**标量类型、且当前值确实是单个字符串的属性；重复参数（Fastify 解析成数组）
 * 与其他类型原样保留，由校验决定接受或拒绝。
 */
export function coerceQueryStringTypes(
  query: Record<string, unknown>,
  querystringSchema: unknown,
): void {
  const properties = (querystringSchema as { properties?: unknown } | null | undefined)?.properties
  if (typeof properties !== 'object' || properties === null) return
  for (const [name, declared] of Object.entries(properties as Record<string, unknown>)) {
    const coercible = declaredTypes(declared).filter((type) => COERCIBLE_SCALARS.has(type))
    if (coercible.length === 0) continue
    const value = query[name]
    if (typeof value !== 'string') continue
    query[name] = coerceText(value, coercible)
  }
}
