import { describe, expect, it } from 'vitest'
import { belongsToArea, kindsForArea, ruleForKind, type FeedbackKind } from './kind-rules'

describe('feedback kind rules', () => {
  it.each([
    ['bug', 'development', 'bug', false, false],
    ['feature', 'development', 'text', false, false],
    ['asset', 'development', 'text', true, false],
    ['request', 'development', 'text', false, false],
    ['content', 'development', 'text', true, false],
    ['campaign', 'development', 'text', false, false],
    ['suggestion', 'community', 'text', false, false],
    ['complaint', 'community', 'text', false, true],
  ] as const)('%s exposes its accepted entry and fields', (kind, area, body, action, anonymous) => {
    expect(ruleForKind(kind)).toMatchObject({
      area,
      body,
      action,
      anonymous,
    })
    expect(belongsToArea(kind, area)).toBe(true)
    expect(belongsToArea(kind, area === 'community' ? 'development' : 'community')).toBe(false)
  })
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
