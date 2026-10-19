import { describe, expect, it } from 'vitest'
import { belongsToArea, kindsForArea, ruleForKind, type FeedbackKind } from './kind-rules'

describe('feedback kind rules', () => {
  it.each([
    ['bug', 'development', 'bug', 'required', false, false, false],
    ['feature', 'development', 'text', 'optional', true, false, false],
    ['asset', 'development', 'text', 'optional', false, true, false],
    ['request', 'development', 'text', 'optional', false, false, false],
    ['content', 'development', 'text', 'none', false, true, false],
    ['campaign', 'development', 'text', 'none', false, false, false],
    ['suggestion', 'community', 'text', 'none', false, false, false],
    ['complaint', 'community', 'text', 'none', false, false, true],
  ] as const)(
    '%s exposes its accepted entry and fields',
    (kind, area, body, typeField, department, action, anonymous) => {
      expect(ruleForKind(kind)).toMatchObject({
        area,
        body,
        typeField,
        department,
        action,
        anonymous,
      })
      expect(belongsToArea(kind, area)).toBe(true)
      expect(belongsToArea(kind, area === 'community' ? 'development' : 'community')).toBe(false)
    },
  )
  it('lists the six development and two community entries without an unknown fallback', () => {
    expect(kindsForArea('development').map((rule) => rule.kind)).toEqual([
      'bug',
      'feature',
      'asset',
      'request',
      'content',
      'campaign',
    ])
    expect(kindsForArea('community').map((rule) => rule.kind)).toEqual(['suggestion', 'complaint'])
    expect(belongsToArea('unexpected' as FeedbackKind, 'development')).toBe(false)
    expect(belongsToArea('unexpected' as FeedbackKind, 'community')).toBe(false)
    expect(() => ruleForKind('unexpected' as FeedbackKind)).toThrow('未知反馈类型')
  })
})
