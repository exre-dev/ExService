import { expect, it } from 'vitest'
import { feedbackSchema, emptyDraft, toFeedbackForm, draftFromForm } from './schema'
const options = {
  fields: [
    {
      id: '4c3befc0-5146-43a2-8610-86efe4e8124a',
      name: 'Type',
      type: 'drop_down' as const,
      required: false,
      type_config: {
        options: [
          { id: '11111111-1111-4111-8111-111111111111', name: '开发', color: null, orderindex: 0 },
        ],
      },
    },
  ],
  actions: (['add', 'modify', 'delete', 'other'] as const).map((action) => ({
    action,
    available: true,
    reason: null,
  })),
}
it('marks new body values as Markdown without changing frozen legacy forms', () => {
  const draft = { ...emptyDraft(), title: '标题', contentText: '**正文**' }
  expect(toFeedbackForm('campaign', draft)).toMatchObject({
    contentFormat: 'markdown',
    contentText: '**正文**',
  })
  const legacy = {
    kind: 'campaign' as const,
    title: '旧标题',
    contentText: '**字面文本**',
    largeFileInfo: null,
  }
  expect(toFeedbackForm('campaign', draftFromForm(legacy))).toEqual(legacy)
})
it('blocks submission of an older exported body when the live editor cannot export', () => {
  const draft = {
    ...emptyDraft(),
    title: '标题',
    contentText: '旧正文',
    editorErrors: { contentText: '当前内容无法转换，请调整正文。' },
  }
  const result = feedbackSchema('campaign', options).safeParse(draft)
  expect(result.success).toBe(false)
  if (!result.success)
    expect(result.error.issues.some((issue) => issue.path[0] === 'contentText')).toBe(true)
  expect(
    feedbackSchema('campaign', options).safeParse({ ...draft, editorErrors: {} }).success,
  ).toBe(true)
})
it('converts six drafts to closed forms and keeps multiline large-file information', () => {
  const draft = {
    ...emptyDraft(),
    title: ' 标题 ',
    contentText: '**',
    description: '问题',
    largeFileInfoEnabled: true,
    largeFileInfo: '  https://example.com\n    提取码 abc\n',
  }
  for (const kind of ['feature', 'request', 'campaign'] as const) {
    expect(feedbackSchema(kind, options).safeParse(draft).success).toBe(true)
    expect(toFeedbackForm(kind, draft).largeFileInfo).toBe(draft.largeFileInfo)
  }
  expect(toFeedbackForm('bug', draft)).not.toHaveProperty('departmentOptionId')
  expect(toFeedbackForm('campaign', draft)).not.toHaveProperty('typeOptionId')
  expect(toFeedbackForm('request', draft)).not.toHaveProperty('categoryOptionId')
  expect(
    toFeedbackForm('request', { ...draft, largeFileInfoEnabled: false }).largeFileInfo,
  ).toBeNull()
})
it('requires action for Asset and Content and Bug description', () => {
  const draft = { ...emptyDraft(), title: 'a', contentText: 'a' }
  expect(feedbackSchema('asset', options).safeParse(draft).success).toBe(false)
  expect(feedbackSchema('content', options).safeParse({ ...draft, action: 'other' }).success).toBe(
    true,
  )
  expect(feedbackSchema('bug', options).safeParse(draft).success).toBe(false)
  expect(
    feedbackSchema('bug', options).safeParse({
      ...draft,
      description: '问题',
      typeOptionId: '11111111-1111-4111-8111-111111111111',
    }).success,
  ).toBe(true)
})
it('requires a configured problem category for Bug feedback while other categories remain optional', () => {
  const draft = { ...emptyDraft(), title: 'a', contentText: '内容', description: '问题' }
  const schema = feedbackSchema('bug', options)
  const missing = schema.safeParse(draft)
  expect(missing.success).toBe(false)
  if (!missing.success)
    expect(missing.error.issues.some((issue) => issue.path[0] === 'typeOptionId')).toBe(true)
  expect(schema.safeParse({ ...draft, typeOptionId: 'stale-option' }).success).toBe(false)
  expect(
    schema.safeParse({ ...draft, typeOptionId: '11111111-1111-4111-8111-111111111111' }).success,
  ).toBe(true)
  for (const kind of ['feature', 'asset', 'request'] as const)
    expect(feedbackSchema(kind, options).safeParse({ ...draft, action: 'other' }).success).toBe(
      true,
    )
})
it('rejects title, content, large information and attachment overflow', () => {
  const schema = feedbackSchema('request', options)
  const draft = { ...emptyDraft(), title: 'a', contentText: 'a' }
  const file = (size: number) =>
    ({
      size,
      name: 'test.txt',
      type: 'text/plain',
      arrayBuffer: async () => new ArrayBuffer(1),
    }) as File
  expect(schema.safeParse({ ...draft, title: 'line\nline' }).success).toBe(false)
  expect(schema.safeParse({ ...draft, contentText: ' \n' }).success).toBe(false)
  expect(
    schema.safeParse({ ...draft, largeFileInfoEnabled: true, largeFileInfo: '中'.repeat(6000) })
      .success,
  ).toBe(false)
  expect(schema.safeParse({ ...draft, files: [file(0)] }).success).toBe(false)
  expect(schema.safeParse({ ...draft, files: [file(20971520)] }).success).toBe(true)
  expect(schema.safeParse({ ...draft, files: Array(6).fill(file(1)) }).success).toBe(false)
})
it('keeps complaint anonymity in its draft and sends it only for complaints', () => {
  const draft = { ...emptyDraft(), title: ' 投诉标题 ', contentText: '投诉内容', anonymous: true }
  expect(feedbackSchema('complaint', options).safeParse(draft).success).toBe(true)
  expect(toFeedbackForm('complaint', draft)).toEqual({
    contentFormat: 'markdown',
    kind: 'complaint',
    title: '投诉标题',
    contentText: '投诉内容',
    largeFileInfo: null,
    anonymous: true,
  })
  expect(toFeedbackForm('suggestion', draft)).toEqual({
    contentFormat: 'markdown',
    kind: 'suggestion',
    title: '投诉标题',
    contentText: '投诉内容',
    largeFileInfo: null,
  })
  expect(toFeedbackForm('request', draft)).not.toHaveProperty('anonymous')
  expect(emptyDraft().anonymous).toBe(false)
  expect(
    feedbackSchema('complaint', options).safeParse({ ...draft, contentText: ' ' }).success,
  ).toBe(false)
})
