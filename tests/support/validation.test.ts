import { describe, expect, it } from 'vitest'
import {
  normalizePrepare,
  normalizeStoredPrepare,
  normalizeAdvance,
} from '@server/src/domains/support/validation.js'

const key = '11111111-1111-4111-8111-111111111111'
const form = {
  kind: 'request',
  title: '  中文  ',
  contentText: '# ordinary',
  typeOptionId: null,
  largeFileInfo: null,
}
describe('support closed form and semantic validation', () => {
  it('keeps advance commands closed and revisions safe', () => {
    expect(normalizeAdvance({ expectedRevision: 0, intent: 'continue' })).toEqual({
      expectedRevision: 0,
      intent: 'continue',
    })
    for (const value of [
      { expectedRevision: -1, intent: 'continue' },
      { expectedRevision: 0, intent: 'continue', taskId: 'override' },
      { expectedRevision: Number.MAX_SAFE_INTEGER + 1, intent: 'retry' },
    ])
      expect(() => normalizeAdvance(value)).toThrow()
  })
  it('normalizes stable fields and preserves literal content', () => {
    expect(normalizePrepare({ submissionKey: key, form, attachments: [] }).form).toEqual({
      ...form,
      title: '中文',
    })
  })
  it('rejects a new Bug without a problem category and keeps request categories optional', () => {
    const bug = {
      kind: 'bug',
      title: '问题',
      typeOptionId: null,
      largeFileInfo: null,
      details: {
        description: '问题',
        reproductionSteps: null,
        expectedResult: null,
        actualResult: null,
        frequency: null,
      },
    }
    expect(() => normalizePrepare({ submissionKey: key, form: bug, attachments: [] })).toThrow()
    expect(
      normalizePrepare({ submissionKey: key, form: { ...bug, typeOptionId: key }, attachments: [] })
        .form,
    ).toMatchObject({ typeOptionId: key })
    expect(normalizePrepare({ submissionKey: key, form, attachments: [] }).form).toMatchObject({
      typeOptionId: null,
    })
  })
  it('keeps previously frozen Bug forms readable without relaxing stored shape validation', () => {
    const input = {
      submissionKey: key,
      form: {
        kind: 'bug',
        title: '问题',
        typeOptionId: null,
        largeFileInfo: null,
        details: {
          description: '问题',
          reproductionSteps: null,
          expectedResult: null,
          actualResult: null,
          frequency: null,
        },
      },
      attachments: [],
    }
    expect(normalizeStoredPrepare(input)).toEqual(input)
    expect(() =>
      normalizeStoredPrepare({ ...input, form: { ...input.form, departmentOptionId: null } }),
    ).toThrow()
    expect(() =>
      normalizeStoredPrepare({ ...input, form: { ...input.form, typeOptionId: 'invalid-id' } }),
    ).toThrow()
  })
  it('preserves nonblank multiline large-file information byte-for-byte', () => {
    const largeFileInfo = '  first link\n    indented note\n'
    expect(
      normalizePrepare({ submissionKey: key, form: { ...form, largeFileInfo }, attachments: [] })
        .form.largeFileInfo,
    ).toBe(largeFileInfo)
    expect(
      normalizePrepare({
        submissionKey: key,
        form: { ...form, largeFileInfo: ' \n ' },
        attachments: [],
      }).form.largeFileInfo,
    ).toBeNull()
  })
  it('rejects unknown fields and Bug department injection', () => {
    expect(() =>
      normalizePrepare({ submissionKey: key, form: { ...form, userId: key }, attachments: [] }),
    ).toThrow()
    expect(() =>
      normalizePrepare({
        submissionKey: key,
        form: {
          kind: 'bug',
          title: 'a',
          typeOptionId: null,
          departmentOptionId: null,
          largeFileInfo: null,
          details: {
            description: 'a',
            reproductionSteps: null,
            expectedResult: null,
            actualResult: null,
            frequency: null,
          },
        },
        attachments: [],
      }),
    ).toThrow()
  })
  it('rejects Unicode title and UTF8 content overflow and duplicate attachments', () => {
    for (const changes of [
      { title: '😀'.repeat(201) },
      { contentText: '中'.repeat(22000) },
      { largeFileInfo: '中'.repeat(6000) },
    ])
      expect(() =>
        normalizePrepare({ submissionKey: key, form: { ...form, ...changes }, attachments: [] }),
      ).toThrow()
    const a = {
      id: key,
      originalName: 'a',
      contentType: 'invalid',
      byteLength: 1,
      sha256: '0'.repeat(64),
    }
    expect(() => normalizePrepare({ submissionKey: key, form, attachments: [a, a] })).toThrow()
  })
})
