import { expect, it } from 'vitest'
import { feedbackSchema, emptyDraft, toFeedbackForm, draftFromForm } from './schema'
const options = {
  fields: [],
  actions: (['add', 'modify', 'delete', 'other'] as const).map((action) => ({
    action,
    available: true,
    reason: null,
  })),
}
it('accepts PHP empty fields for Bug feedback and preserves 64 KiB large-file information', () => {
  const draft = {
    ...emptyDraft(),
    title: '问题',
    description: '问题描述',
    largeFileInfoEnabled: true,
    largeFileInfo: 'x'.repeat(65536),
  }
  expect(feedbackSchema('bug', { ...options, fields: [] }).safeParse(draft).success).toBe(true)
  expect(toFeedbackForm('bug', draft)).not.toHaveProperty('typeOptionId')
})
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
it('accepts Bug details without retired classification fields', () => {
  const draft = { ...emptyDraft(), title: '问题', description: '描述' }
  expect(feedbackSchema('bug', options).safeParse(draft).success).toBe(true)
  expect(toFeedbackForm('bug', draft)).not.toHaveProperty('typeOptionId')
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
    schema.safeParse({ ...draft, largeFileInfoEnabled: true, largeFileInfo: '中'.repeat(22000) })
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
