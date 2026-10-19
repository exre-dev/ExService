import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { normalizePrepare } from '@server/src/domains/support/validation'
import { taskInput, TARGET } from '@server/src/domains/support/metadata'

const details = {
  description: '问题',
  reproductionSteps: null,
  expectedResult: null,
  actualResult: null,
  frequency: null,
}
const common = { title: '标题', largeFileInfo: null }
const forms = [
  { ...common, kind: 'bug', typeOptionId: '11111111-1111-4111-8111-111111111111', details },
  { ...common, kind: 'feature', typeOptionId: null, departmentOptionId: null, contentText: '内容' },
  { ...common, kind: 'asset', typeOptionId: null, action: 'add', contentText: '内容' },
  { ...common, kind: 'request', typeOptionId: null, contentText: '内容' },
  { ...common, kind: 'content', action: 'other', contentText: '内容' },
  { ...common, kind: 'campaign', contentText: '内容' },
] as const

describe('six support forms', () => {
  it.each(forms)('normalizes $kind and maps its task type without Category', (form) => {
    const normalized = normalizePrepare({ submissionKey: randomUUID(), form, attachments: [] })
    const task = taskInput(normalized.form, '正文', '昵称', randomUUID())
    expect(task.custom_item_id).toBe(
      (
        {
          bug: 1001,
          feature: 0,
          asset: 1009,
          request: 1005,
          content: 1007,
          campaign: 1008,
        } as const
      )[form.kind],
    )
    expect(task.custom_fields.map((field) => field.id)).not.toContain(
      '4acf848b-2a8d-4404-8cda-36156e0f066d',
    )
    expect(task.custom_fields.map((field) => field.id)).not.toContain(
      TARGET.department === undefined ? '' : TARGET.department,
    )
  })

  it('rejects a Bug department and an Asset without action', () => {
    expect(() =>
      normalizePrepare({
        submissionKey: randomUUID(),
        form: { ...forms[0], departmentOptionId: null },
        attachments: [],
      }),
    ).toThrow()
    const { action: _action, ...asset } = forms[2]
    expect(() =>
      normalizePrepare({ submissionKey: randomUUID(), form: asset, attachments: [] }),
    ).toThrow()
  })
})
