// @vitest-environment jsdom
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({ userId: 1, state: { status: 'authenticated' } }),
}))
import { FEEDBACK_LIMITS } from './schema'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Button, Toaster, ThemeProvider } from '@exre/exui'
import { MemoryRouter } from 'react-router'
import { FeedbackProvider, useFeedback } from './FeedbackProvider'
import type { FeedbackSnapshot } from './flow'
import {
  AUTH_TOKEN_KEY,
  clearLegacySessionStorage,
  feedbackStorageKey,
  writeToken,
} from '../../../auth/storage'

function pasteMarkdown(node: HTMLElement, text: string) {
  fireEvent.paste(node, {
    clipboardData: { files: [], getData: (type: string) => (type === 'text/plain' ? text : '') },
  })
}

const { options, lookup, get, prepare } = vi.hoisted(() => ({
  options: vi.fn(),
  lookup: vi.fn(),
  get: vi.fn(),
  prepare: vi.fn(),
}))
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
vi.stubGlobal('matchMedia', (media: string) => ({
  media,
  matches: false,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))
const originalScroll = Element.prototype.scrollIntoView
const rangeGeometry = ['getClientRects', 'getBoundingClientRect'] as const
const originalRangeGeometry = rangeGeometry.map((name) =>
  Object.getOwnPropertyDescriptor(Range.prototype, name),
)
beforeAll(async () => {
  Element.prototype.scrollIntoView = vi.fn()
  // RHF focuses the visible invalid editor; jsdom does not implement Range layout.
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  })
  await import('./FeedbackModal')
})
afterAll(() => {
  if (originalScroll) Element.prototype.scrollIntoView = originalScroll
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  rangeGeometry.forEach((name, index) => {
    const original = originalRangeGeometry[index]
    if (original) Object.defineProperty(Range.prototype, name, original)
    else Reflect.deleteProperty(Range.prototype, name)
  })
})
vi.mock('./api', () => ({
  getFeedbackOptions: options,
  feedbackPort: { get, lookup, prepare, upload: vi.fn(), advance: vi.fn() },
}))
const kinds = (['bug', 'feature', 'asset', 'request', 'content', 'campaign'] as const).map(
  (kind) => ({ kind, available: true, reason: null }),
)
const actions = (['add', 'modify', 'delete', 'other'] as const).map((action) => ({
  action,
  available: true,
  reason: null,
}))
const fields: string[] = []
const good = { available: true, reason: null, fields, kinds, actions, limits: FEEDBACK_LIMITS }
function Entries() {
  const { openFeedback } = useFeedback()
  return (
    <>
      <Button onClick={(event) => openFeedback('development', event.currentTarget)}>
        功能和需求
      </Button>
      <Button onClick={(event) => openFeedback('community', event.currentTarget)}>
        投诉和建议
      </Button>
    </>
  )
}
function mount(area: 'development' | 'community' = 'development') {
  clearLegacySessionStorage()
  localStorage.setItem(AUTH_TOKEN_KEY, 'test-token')
  render(
    <ThemeProvider defaultTheme="light">
      <Toaster />
      <MemoryRouter>
        <FeedbackProvider>
          <Entries />
        </FeedbackProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
  fireEvent.click(
    screen.getByRole('button', { name: area === 'community' ? '投诉和建议' : '功能和需求' }),
  )
}
function mountCommunity() {
  mount('community')
}

it('keeps the form in a direct scrolling dialog body and submits through its fixed footer', async () => {
  options.mockResolvedValue(good)
  mount()
  fireEvent.click((await screen.findByText('需求')).closest('button')!)
  const dialog = screen.getByRole('dialog', { name: '需求' })
  const body = dialog.querySelector('[data-slot="dialog-body"]')
  const footer = dialog.querySelector('[data-slot="dialog-footer"]')
  const form = screen.getByRole('textbox', { name: '标题' }).closest('form')
  expect(body?.parentElement).toBe(dialog)
  expect(footer?.parentElement).toBe(dialog)
  expect(body?.contains(form)).toBe(true)
  expect(footer?.querySelector('button[type="submit"]')?.getAttribute('form')).toBe(form?.id)
})

it('routes Escape through discard confirmation without losing the draft', async () => {
  options.mockResolvedValue(good)
  mount()
  fireEvent.click((await screen.findByText('需求')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '暂存标题' } })
  fireEvent.keyDown(document, { key: 'Escape' })
  const confirmation = await screen.findByRole('dialog', { name: '放弃未提交内容？' })
  expect(confirmation.getAttribute('aria-describedby')).toBeNull()
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '放弃未提交内容？' })).toBeNull())
  expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('暂存标题')
})

it('submits formatted editor content as Markdown and keeps rich paste downgrade silent', async () => {
  options.mockResolvedValue({
    ...good,
    kinds: [{ kind: 'suggestion', available: true, reason: null }],
    actions: [],
  })
  prepare.mockImplementationOnce(() => new Promise(() => {}))
  mountCommunity()
  fireEvent.click((await screen.findByText('反馈和建议')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'Markdown 建议' } })
  const content = screen.getByRole('textbox', { name: '内容' })
  fireEvent.paste(content, {
    clipboardData: {
      files: [],
      getData: (type: string) =>
        type === 'text/html'
          ? '<p><span style="color:red"><strong>加粗正文</strong></span></p>'
          : '加粗正文',
    },
  })
  expect(content.querySelector('strong')?.textContent).toBe('加粗正文')
  expect(screen.queryByText(/降级|粘贴为纯文本|简化不兼容/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '提交' }))
  await waitFor(() => expect(prepare).toHaveBeenCalledOnce())
  expect(prepare.mock.calls[0]?.[0].form).toEqual({
    kind: 'suggestion',
    title: 'Markdown 建议',
    contentText: '**加粗正文**',
    contentFormat: 'markdown',
    largeFileInfo: null,
  })
  expect(content.getAttribute('contenteditable')).toBe('false')
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  localStorage.clear()
  vi.clearAllMocks()
})

it('shows the community cards and keeps anonymity only in the complaint draft', async () => {
  options.mockResolvedValue({
    ...good,
    kinds: [
      { kind: 'suggestion', available: true, reason: null },
      { kind: 'complaint', available: true, reason: null },
    ],
    actions: [],
  })
  mountCommunity()
  await waitFor(() => expect(options).toHaveBeenCalledWith('community'))
  const suggestion = (await screen.findByText('反馈和建议')).closest('button')!
  const complaint = screen.getByText('投诉').closest('button')!
  expect(suggestion.querySelector('img')?.getAttribute('src')).toBe('/3d-icons/Message.png')
  expect(complaint.querySelector('img')?.getAttribute('src')).toBe('/3d-icons/Danger.png')
  expect(screen.queryByText('Bug 反馈')).toBeNull()
  fireEvent.click(complaint)
  const anonymous = screen.getByRole('switch', { name: '匿名提交' })
  expect(anonymous.getAttribute('aria-checked')).toBe('false')
  fireEvent.click(anonymous)
  expect(anonymous.getAttribute('aria-checked')).toBe('true')
  pasteMarkdown(screen.getByLabelText('内容'), '投诉正文')
  fireEvent.click(screen.getByRole('button', { name: '返回选择类型' }))
  fireEvent.click(screen.getByText('反馈和建议').closest('button')!)
  expect(screen.queryByRole('switch', { name: '匿名提交' })).toBeNull()
  expect(screen.getByLabelText('内容').textContent).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '返回选择类型' }))
  fireEvent.click(screen.getByText('投诉').closest('button')!)
  expect(screen.getByRole('switch', { name: '匿名提交' }).getAttribute('aria-checked')).toBe('true')
  expect(screen.getByLabelText('内容').textContent).toBe('投诉正文')
})
it('confirms discarding an anonymous-only complaint draft and resets the switch', async () => {
  options.mockResolvedValue({
    ...good,
    kinds: [
      { kind: 'suggestion', available: true, reason: null },
      { kind: 'complaint', available: true, reason: null },
    ],
    actions: [],
  })
  mountCommunity()
  fireEvent.click((await screen.findByText('投诉')).closest('button')!)
  fireEvent.click(screen.getByRole('switch', { name: '匿名提交' }))
  fireEvent.click(screen.getByRole('button', { name: '返回选择类型' }))
  fireEvent.click(screen.getByText('反馈和建议').closest('button')!)
  fireEvent.click(screen.getByRole('button', { name: '关闭反馈表单' }))
  expect(await screen.findByText('放弃未提交内容？')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '放弃内容' }))
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  fireEvent.click((await screen.findByText('投诉')).closest('button')!)
  expect(screen.getByRole('switch', { name: '匿名提交' }).getAttribute('aria-checked')).toBe(
    'false',
  )
})
it('restores a frozen anonymous complaint only from the community pointer', async () => {
  const key = '22222222-2222-4222-8222-222222222222'
  const submissionId = '11111111-1111-4111-8111-111111111111'
  sessionStorage.setItem(
    feedbackStorageKey(1, 'community'),
    JSON.stringify({ submissionKey: key, submissionId }),
  )
  sessionStorage.setItem(
    feedbackStorageKey(1, 'development'),
    JSON.stringify({ submissionKey: '33333333-3333-4333-8333-333333333333' }),
  )
  options.mockRejectedValueOnce(new Error('offline'))
  get.mockResolvedValueOnce({
    id: submissionId,
    submissionKey: key,
    revision: 1,
    createdAt: 1,
    receiveExpiresAt: 86401,
    status: 'receiving',
    nextAction: 'continue',
    taskId: null,
    taskUrl: null,
    failure: null,
    attachments: [],
    form: {
      kind: 'complaint',
      title: '投诉标题',
      contentText: '投诉正文',
      largeFileInfo: null,
      anonymous: true,
    },
  } satisfies FeedbackSnapshot)
  mountCommunity()
  expect(await screen.findByRole('switch', { name: '匿名提交' })).toBeTruthy()
  expect(screen.getByRole('switch', { name: '匿名提交' }).getAttribute('aria-checked')).toBe('true')
  expect((screen.getByRole('switch', { name: '匿名提交' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect(sessionStorage.getItem(feedbackStorageKey(1, 'development'))).toContain(
    '33333333-3333-4333-8333-333333333333',
  )
})
it('freezes complaint anonymity when submit begins and preserves it in prepare payload', async () => {
  options.mockResolvedValue({
    ...good,
    kinds: [
      { kind: 'suggestion', available: true, reason: null },
      { kind: 'complaint', available: true, reason: null },
    ],
    actions: [],
  })
  prepare.mockImplementation(() => new Promise(() => {}))
  mountCommunity()
  fireEvent.click((await screen.findByText('投诉')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '投诉标题' } })
  pasteMarkdown(screen.getByLabelText('内容'), '投诉正文')
  fireEvent.click(screen.getByRole('switch', { name: '匿名提交' }))
  fireEvent.click(screen.getByRole('button', { name: '提交' }))
  await waitFor(() => expect(prepare).toHaveBeenCalledOnce())
  expect(prepare.mock.calls[0]?.[0].form).toEqual({
    contentFormat: 'markdown',
    kind: 'complaint',
    title: '投诉标题',
    contentText: '投诉正文',
    largeFileInfo: null,
    anonymous: true,
  })
  expect((screen.getByRole('switch', { name: '匿名提交' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect(sessionStorage.getItem(feedbackStorageKey(1, 'community'))).toContain('submissionKey')
  expect(sessionStorage.getItem(feedbackStorageKey(1, 'development'))).toBeNull()
})
it('sends a suggestion without an anonymous property', async () => {
  options.mockResolvedValue({
    ...good,
    kinds: [
      { kind: 'suggestion', available: true, reason: null },
      { kind: 'complaint', available: true, reason: null },
    ],
    actions: [],
  })
  prepare.mockImplementation(() => new Promise(() => {}))
  mountCommunity()
  fireEvent.click((await screen.findByText('反馈和建议')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '服务建议' } })
  pasteMarkdown(screen.getByLabelText('内容'), '可以增加说明')
  fireEvent.click(screen.getByRole('button', { name: '提交' }))
  await waitFor(() => expect(prepare).toHaveBeenCalledOnce())
  expect(prepare.mock.calls[0]?.[0].form).toEqual({
    contentFormat: 'markdown',
    kind: 'suggestion',
    title: '服务建议',
    contentText: '可以增加说明',
    largeFileInfo: null,
  })
  expect(screen.queryByRole('switch', { name: '匿名提交' })).toBeNull()
})
it('does not offer the previous account frozen complaint for replay after a session switch', async () => {
  options.mockResolvedValue({
    ...good,
    kinds: [
      { kind: 'suggestion', available: true, reason: null },
      { kind: 'complaint', available: true, reason: null },
    ],
    actions: [],
  })
  prepare.mockRejectedValueOnce(new Error('offline'))
  lookup.mockRejectedValueOnce({ code: 'NOT_FOUND' }).mockRejectedValueOnce({ code: 'NOT_FOUND' })
  mountCommunity()
  fireEvent.click((await screen.findByText('投诉')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'A 的投诉' } })
  pasteMarkdown(screen.getByLabelText('内容'), 'A 的私密正文')
  fireEvent.click(screen.getByRole('switch', { name: '匿名提交' }))
  fireEvent.click(screen.getByRole('button', { name: '提交' }))
  await waitFor(() => expect(lookup).toHaveBeenCalledOnce())
  expect(await screen.findByRole('button', { name: '核对进度' })).toBeTruthy()
  writeToken(localStorage, 'next-account-token')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('button', { name: '继续原提交' })).toBeNull()
  expect(screen.queryByText('A 的私密正文')).toBeNull()
  expect(prepare).toHaveBeenCalledOnce()
})

it('shows a loading skeleton instead of disabled type choices until options are ready', async () => {
  let resolveOptions!: (value: typeof good) => void
  options.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOptions = resolve
      }),
  )
  mount()
  expect(screen.getByRole('status', { name: '正在读取反馈选项' })).toBeTruthy()
  expect(screen.queryByText('Bug 反馈')).toBeNull()
  resolveOptions(good)
  await waitFor(() =>
    expect((screen.getByText('Bug 反馈').closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    ),
  )
  expect(screen.queryByRole('status', { name: '正在读取反馈选项' })).toBeNull()
})

it('stops showing the loading skeleton when reading options fails', async () => {
  options.mockRejectedValueOnce(new Error('offline'))
  mount()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByRole('status', { name: '正在读取反馈选项' })).toBeNull()
})

it('can reselect a missing attachment after recovering a submission even when options fail', async () => {
  const key = '22222222-2222-4222-8222-222222222222'
  const submissionId = '11111111-1111-4111-8111-111111111111'
  sessionStorage.setItem(
    feedbackStorageKey(1, 'development'),
    JSON.stringify({ submissionKey: key, submissionId }),
  )
  options.mockRejectedValueOnce(new Error('offline'))
  get.mockResolvedValueOnce({
    id: submissionId,
    submissionKey: key,
    revision: 0,
    createdAt: 1,
    receiveExpiresAt: 86401,
    status: 'receiving',
    nextAction: 'upload',
    taskId: null,
    taskUrl: null,
    failure: null,
    attachments: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        ordinal: 0,
        originalName: 'evidence.txt',
        byteLength: 1,
        sha256: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
        contentType: 'text/plain',
        status: 'expected',
        remoteAttachmentId: null,
      },
    ],
    form: {
      kind: 'request',
      title: '原标题',
      contentText: '原正文',
      typeOptionId: null,
      largeFileInfo: null,
    },
  } satisfies FeedbackSnapshot)
  mount()
  const input = await screen.findByLabelText(/^附件/)
  await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false))
  fireEvent.change(input, {
    target: { files: [new File(['a'], 'evidence.txt', { type: 'text/plain' })] },
  })
  expect(await screen.findByRole('button', { name: '移除附件 evidence.txt' })).toBeTruthy()
  expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('原标题')
  expect(screen.queryByRole('status', { name: '正在读取反馈选项' })).toBeNull()
})

it('shows six types, isolates drafts and confirms closing', async () => {
  options.mockResolvedValue(good)
  mount()
  const request = (await screen.findByText('需求')).closest('button')!
  expect(screen.getByText('Bug 反馈').closest('button')).toBeTruthy()
  fireEvent.click(request)
  const content = screen.getByLabelText('内容')
  pasteMarkdown(content, '# 标题草稿')
  const back = screen.getByRole('button', { name: '返回选择类型' })
  expect(back.closest('[data-slot="dialog-header"]')).not.toBeNull()
  expect(back.closest('form')).toBeNull()
  fireEvent.click(back)
  expect(screen.queryByRole('button', { name: '返回选择类型' })).toBeNull()
  fireEvent.click(screen.getByText('Bug 反馈').closest('button')!)
  expect(screen.queryByLabelText('部门')).toBeNull()
  expect(screen.getByLabelText('问题描述')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '关闭' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '返回选择类型' }))
  fireEvent.click(screen.getByText('需求').closest('button')!)
  expect(screen.getByLabelText('内容').textContent).toBe('标题草稿')
  fireEvent.click(screen.getByRole('button', { name: '关闭反馈表单' }))
  expect(await screen.findByText('放弃未提交内容？')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '返回选择类型' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '继续填写' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '放弃未提交内容？' })).toBeNull())
  expect(screen.getByLabelText('内容').textContent).toBe('标题草稿')
  fireEvent.click(screen.getByRole('button', { name: '关闭反馈表单' }))
  fireEvent.click(screen.getByRole('button', { name: '放弃内容' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '功能和需求' }))
  fireEvent.click((await screen.findByText('需求')).closest('button')!)
  expect(screen.getByLabelText('内容').textContent).toBe('')
})
it('renders a Bug form with empty PHP fields and no ClickUp classification controls', async () => {
  options.mockResolvedValue(good)
  mount()
  fireEvent.click((await screen.findByText('Bug 反馈')).closest('button')!)
  expect(screen.queryByRole('combobox', { name: '问题分类' })).toBeNull()
  expect(screen.queryByLabelText('部门')).toBeNull()
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '问题' } })
  pasteMarkdown(screen.getByRole('textbox', { name: '问题描述' }), '复现描述')
  prepare.mockReturnValue(new Promise(() => {}))
  fireEvent.click(screen.getByRole('button', { name: '提交' }))
  await waitFor(() => expect(prepare).toHaveBeenCalledOnce())
  expect(prepare.mock.calls[0]![0].form).toMatchObject({ kind: 'bug', title: '问题' })
  expect(prepare.mock.calls[0]![0].form).not.toHaveProperty('typeOptionId')
})
it('shows a Bug total JSON limit error and submits after the user shortens valid supplemental content', async () => {
  options.mockResolvedValue(good)
  prepare.mockReturnValue(new Promise(() => {}))
  mount()
  fireEvent.click((await screen.findByText('Bug 反馈')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'Bug' } })
  const description = screen.getByRole('textbox', { name: '问题描述' })
  pasteMarkdown(description, 'Valid description')
  fireEvent.click(screen.getByRole('switch', { name: '补充大文件信息' }))
  const supplemental = screen.getByRole('textbox', { name: '大文件补充信息' })
  const withinIndividualLimit = '中'.repeat(21845)
  expect(new TextEncoder().encode(withinIndividualLimit).byteLength).toBe(65535)
  fireEvent.change(supplemental, { target: { value: withinIndividualLimit } })
  fireEvent.click(screen.getByRole('button', { name: '提交' }))
  const error = await screen.findByText('表单内容过大，请缩短内容')
  expect(description.getAttribute('aria-describedby')?.split(' ')).toContain(error.id)
  expect(description.getAttribute('aria-invalid')).toBe('true')
  expect(supplemental.getAttribute('aria-invalid')).toBe('false')
  expect(prepare).not.toHaveBeenCalled()

  fireEvent.change(supplemental, { target: { value: 'Short supplemental note' } })
  fireEvent.click(screen.getByRole('button', { name: '提交' }))
  await waitFor(() => expect(prepare).toHaveBeenCalledOnce())
  expect(screen.queryByText('表单内容过大，请缩短内容')).toBeNull()
  expect(prepare.mock.calls[0]![0].form).toMatchObject({
    kind: 'bug',
    title: 'Bug',
    details: { description: 'Valid description' },
    largeFileInfo: 'Short supplemental note',
  })
})
it('disables only unavailable kinds and actions', async () => {
  options.mockResolvedValue({
    ...good,
    kinds: kinds.map((entry) =>
      entry.kind === 'asset'
        ? { ...entry, available: false, reason: 'configuration_invalid' }
        : entry,
    ),
    actions: actions.map((entry) =>
      entry.action === 'add' ? { ...entry, available: false, reason: 'tag_missing' } : entry,
    ),
  })
  mount()
  expect(((await screen.findByText('资源')).closest('button') as HTMLButtonElement).disabled).toBe(
    true,
  )
  fireEvent.click(screen.getByText('文档和内容').closest('button')!)
  fireEvent.keyDown(screen.getByRole('combobox', { name: '操作' }), { key: 'ArrowDown' })
  expect((await screen.findByRole('option', { name: '新增' })).getAttribute('aria-disabled')).toBe(
    'true',
  )
  expect(screen.getByRole('option', { name: '其他' }).getAttribute('aria-disabled')).not.toBe(
    'true',
  )
})
it('keeps a selected frequency in its Bug draft and can clear it after returning', async () => {
  options.mockResolvedValue(good)
  mount()
  fireEvent.click((await screen.findByText('Bug 反馈')).closest('button')!)
  fireEvent.keyDown(screen.getByRole('combobox', { name: /发生频率/ }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: '偶尔' }))
  fireEvent.click(screen.getByRole('button', { name: '返回选择类型' }))
  fireEvent.click(screen.getByText('需求').closest('button')!)
  expect(screen.queryByRole('combobox', { name: /发生频率/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '返回选择类型' }))
  fireEvent.click(screen.getByText('Bug 反馈').closest('button')!)
  const frequency = screen.getByRole('combobox', { name: /发生频率/ })
  expect(frequency.textContent).toContain('偶尔')
  fireEvent.keyDown(frequency, { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: '不选择' }))
  expect(frequency.textContent).toContain('请选择')
})
it('ignores old recovery pointers and accepts a new key-only lookup', async () => {
  const key = '22222222-2222-4222-8222-222222222222'
  options.mockResolvedValue(good)
  sessionStorage.setItem('exwebsite.feedback.v1.request', JSON.stringify({ submissionKey: key }))
  sessionStorage.setItem(
    feedbackStorageKey(1, 'development'),
    JSON.stringify({ submissionKey: key }),
  )
  lookup.mockRejectedValueOnce({ code: 'NOT_FOUND' }).mockResolvedValueOnce({
    id: '11111111-1111-4111-8111-111111111111',
    submissionKey: key,
    revision: 0,
    createdAt: 1,
    receiveExpiresAt: 86401,
    status: 'receiving',
    nextAction: 'upload',
    taskId: null,
    taskUrl: null,
    failure: null,
    attachments: [],
    form: {
      kind: 'request',
      title: '原标题',
      contentText: '原正文',
      typeOptionId: null,
      largeFileInfo: null,
    },
  })
  mount()
  expect(await screen.findByRole('button', { name: '核对进度' })).toBeTruthy()
  expect(screen.queryByText(/提交编号/)).toBeNull()
  expect(sessionStorage.getItem('exwebsite.feedback.v1.request')).toBeNull()
  const recheck = await screen.findByRole('button', { name: '核对进度' })
  await waitFor(() => expect((recheck as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(recheck)
  await waitFor(() =>
    expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('原标题'),
  )
  expect(lookup).toHaveBeenCalledWith(key)
})
