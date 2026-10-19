import { describe, expect, it } from 'vitest'
import { coerceQueryStringTypes } from './query-coercion.js'

/**
 * 只覆盖这层强制逻辑本身。「合法 limit 必须 200」的端到端断言在
 * `tests/contract/notifications.test.ts`，那里跑的是真实 Fastify + Contract schema。
 */

const schema = {
  type: 'object',
  required: ['view'],
  properties: {
    view: { type: 'string', enum: ['history'] },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
    cursor: { $ref: '#/components/schemas/NotificationCursor' },
    flag: { type: 'boolean' },
    either: { type: ['number', 'null'] },
  },
}

function coerce(query: Record<string, unknown>): Record<string, unknown> {
  coerceQueryStringTypes(query, schema)
  return query
}

describe('query string type coercion', () => {
  it('turns declared numeric params into numbers and leaves the rest untouched', () => {
    expect(coerce({ view: 'history', limit: '20' })).toEqual({ view: 'history', limit: 20 })
    expect(coerce({ view: 'history', limit: '1' })).toEqual({ view: 'history', limit: 1 })
    expect(coerce({ view: 'history', limit: '50' })).toEqual({ view: 'history', limit: 50 })
    expect(coerce({ view: 'history' })).toEqual({ view: 'history' })
  })

  it('leaves out-of-range and non-numeric text for the contract validator to reject', () => {
    // 上下界由 Ajv 判定：这里不能把拒绝变成接受，也不能把 400 的原因改成错的。
    expect(coerce({ view: 'history', limit: '500' })).toEqual({ view: 'history', limit: 500 })
    expect(coerce({ view: 'history', limit: '20.5' })).toEqual({ view: 'history', limit: 20.5 })
    expect(coerce({ view: 'history', limit: 'abc' })).toEqual({ view: 'history', limit: 'abc' })
    expect(coerce({ view: 'history', limit: '' })).toEqual({ view: 'history', limit: '' })
    expect(coerce({ view: 'history', limit: '   ' })).toEqual({ view: 'history', limit: '   ' })
    expect(coerce({ view: 'history', limit: 'Infinity' })).toEqual({
      view: 'history',
      limit: 'Infinity',
    })
  })

  it('accepts only JSON number syntax, not everything Number() would parse', () => {
    // `Number()` 比 JSON 宽：这些写法 JSON 数字语法都不接受，照单全收会放行 Contract 本该拒绝的值。
    for (const rejected of ['0x10', '+20', '.5', '20.', '007', '1_0', '20 30', '1e', 'NaN', '-']) {
      expect(coerce({ view: 'history', limit: rejected })).toEqual({
        view: 'history',
        limit: rejected,
      })
    }
    // JSON 允许的写法必须仍然通过，收紧不能把合法值一起拒掉。
    for (const [text, parsed] of [
      ['0', 0],
      ['1e3', 1000],
      ['1E+2', 100],
      ['0.5', 0.5],
      ['-12.25', -12.25],
    ] as const) {
      expect(coerce({ view: 'history', limit: text })).toEqual({ view: 'history', limit: parsed })
    }
  })

  it('coerces booleans strictly and accepts union types', () => {
    expect(coerce({ view: 'history', flag: 'true' })).toEqual({ view: 'history', flag: true })
    expect(coerce({ view: 'history', flag: 'false' })).toEqual({ view: 'history', flag: false })
    // `Boolean('yes')` 是 true，会静默接受本该被拒的值，因此只认 true / false 两个字面量。
    expect(coerce({ view: 'history', flag: 'yes' })).toEqual({ view: 'history', flag: 'yes' })
    expect(coerce({ view: 'history', either: '3' })).toEqual({ view: 'history', either: 3 })
  })

  it('never touches undeclared params, $ref params or repeated params', () => {
    expect(coerce({ view: 'history', cursor: '42' })).toEqual({ view: 'history', cursor: '42' })
    expect(coerce({ view: 'history', unknown: '7' })).toEqual({ view: 'history', unknown: '7' })
    expect(coerce({ view: 'history', limit: ['20', '30'] })).toEqual({
      view: 'history',
      limit: ['20', '30'],
    })
  })

  it('does nothing when the route declares no querystring schema', () => {
    const query = { limit: '20' }
    coerceQueryStringTypes(query, undefined)
    expect(query).toEqual({ limit: '20' })
    coerceQueryStringTypes(query, { type: 'object' })
    expect(query).toEqual({ limit: '20' })
  })
})
