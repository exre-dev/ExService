// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Button, ExMessageContext, ThemeProvider } from '@exre/exui'
import { StrictMode } from 'react'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { FeedbackProvider, useFeedback } from './FeedbackProvider'
import type { FeedbackSnapshot } from './flow'
import { writeToken } from '../../../auth/storage'

function pasteMarkdown(node: HTMLElement, text: string) {
  fireEvent.paste(node, {
    clipboardData: { files: [], getData: (type: string) => (type === 'text/plain' ? text : '') },
  })
}

const port = vi.hoisted(() => ({
  prepare: vi.fn(),
  get: vi.fn(),
  lookup: vi.fn(),
  upload: vi.fn(),
  advance: vi.fn(),
}))
vi.mock('./api', () => ({
  getFeedbackOptions: async () => ({
    available: true,
    reason: null,
    fields: [],
    actions: [],
    limits: {},
    kinds: ['suggestion', 'complaint'].map((kind) => ({ kind, available: true, reason: null })),
  }),
  feedbackPort: port,
}))
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
beforeAll(async () => {
  await import('./FeedbackModal')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  vi.resetAllMocks()
})

function Entries() {
  const { openFeedback } = useFeedback()
  return (
    <>
      <Button onClick={(event) => openFeedback('community', event.currentTarget)}>
        投诉和建议
      </Button>
      <Button onClick={(event) => openFeedback('development', event.currentTarget)}>
        功能和需求
      </Button>
      <Link to="/elsewhere">离开支持中心</Link>
    </>
  )
}

function mount() {
  localStorage.setItem('exwebsite.auth.token', 'preview-token')
  render(
    <StrictMode>
      <ThemeProvider defaultTheme="light">
        <ExMessageContext />
        <MemoryRouter initialEntries={['/support']}>
          <FeedbackProvider>
            <Routes>
              <Route path="/support" element={<Entries />} />
              <Route
                path="/elsewhere"
                element={
                  <>
                    <h1>其他页面</h1>
                    <Link to="/support">返回支持中心</Link>
                  </>
                }
              />
            </Routes>
          </FeedbackProvider>
        </MemoryRouter>
      </ThemeProvider>
    </StrictMode>,
  )
}

async function start(waitForLoading = true) {
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  fireEvent.click((await screen.findByText('反馈和建议')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '体验建议' } })
  pasteMarkdown(screen.getByLabelText('内容'), '改善提交体验')
  fireEvent.click(screen.getByRole('button', { name: '提交' }))
  if (waitForLoading)
    await waitFor(() => expect(screen.queryByRole('button', { name: '提交中' })).not.toBeNull())
}

function snapshot(
  status: FeedbackSnapshot['status'],
  nextAction: FeedbackSnapshot['nextAction'],
): FeedbackSnapshot {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    submissionKey: '22222222-2222-4222-8222-222222222222',
    revision: 1,
    createdAt: 1,
    receiveExpiresAt: 86400001,
    status,
    nextAction,
    taskId: null,
    taskUrl: null,
    failure: null,
    attachments: [],
    form: {
      kind: 'suggestion',
      title: '体验建议',
      contentText: '改善提交体验',
      largeFileInfo: null,
    },
  }
}

function deferPrepare() {
  let resolve!: (value: FeedbackSnapshot) => void
  port.prepare.mockImplementationOnce(
    () =>
      new Promise<FeedbackSnapshot>((done) => {
        resolve = done
      }),
  )
  return (value: FeedbackSnapshot) =>
    act(async () => {
      resolve(value)
    })
}

it('does not prevent unrelated pages from rendering when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage denied')
  })
  render(
    <MemoryRouter>
      <FeedbackProvider>
        <p>其他页面</p>
      </FeedbackProvider>
    </MemoryRouter>,
  )
  expect(screen.getByText('其他页面')).toBeTruthy()
})

it('shows submission loading only in the original submit button', async () => {
  port.prepare.mockImplementation(() => new Promise(() => {}))
  mount()
  await start()
  expect(screen.queryByText('正在核对原提交')).toBeNull()
  expect(screen.queryByText('正在处理反馈')).toBeNull()
  expect(screen.queryByText(/提交编号/)).toBeNull()
  expect(screen.getByRole('button', { name: '提交中' }).getAttribute('aria-busy')).toBe('true')
})

it('preserves the unsent current draft when SPA navigation hides its modal', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  fireEvent.click((await screen.findByText('反馈和建议')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: '尚未提交的建议' } })
  pasteMarkdown(screen.getByLabelText('内容'), '切换页面后继续填写')
  fireEvent.click(screen.getByText('离开支持中心'))
  expect(screen.getByRole('heading', { name: '其他页面' })).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: '返回支持中心' }))
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  await waitFor(() =>
    expect((screen.queryByLabelText('标题') as HTMLInputElement | null)?.value).toBe(
      '尚未提交的建议',
    ),
  )
  expect(screen.getByLabelText('内容').textContent).toBe('切换页面后继续填写')
})

it('continues after closing and blocks both entrances until the submission finishes', async () => {
  const resolve = deferPrepare()
  port.advance.mockResolvedValueOnce(snapshot('completed', 'done'))
  mount()
  await start()
  fireEvent.click(screen.getByRole('button', { name: '关闭反馈表单' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  for (const name of ['功能和需求', '投诉和建议']) {
    fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('正在上传中，请稍候')).toBeTruthy()
  }
  await resolve(snapshot('ready', 'continue'))
  expect(await screen.findByText('反馈已提交')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  expect(await screen.findByText('反馈和建议')).toBeTruthy()
})

it('keeps advancing and reports completion after navigating to another page', async () => {
  const resolve = deferPrepare()
  port.advance.mockResolvedValueOnce(snapshot('completed', 'done'))
  mount()
  await start()
  fireEvent.click(screen.getByRole('button', { name: '关闭反馈表单' }))
  fireEvent.click(screen.getByRole('link', { name: '离开支持中心' }))
  expect(screen.getByRole('heading', { name: '其他页面' })).toBeTruthy()
  await resolve(snapshot('ready', 'continue'))
  expect(await screen.findByText('反馈已提交')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('offers retry on a known failure without showing the progress block', async () => {
  port.prepare.mockResolvedValueOnce(snapshot('failed', 'retry'))
  mount()
  await start(false)
  expect(await screen.findByRole('button', { name: '重试' })).toBeTruthy()
  expect(screen.queryByText(/提交编号/)).toBeNull()
  expect(screen.queryByText('反馈已提交')).toBeNull()
})

it('leaves an uncertain submission available only for checking', async () => {
  port.prepare.mockRejectedValueOnce(new Error('connection lost'))
  port.lookup.mockRejectedValueOnce({ code: 'NOT_FOUND' })
  mount()
  await start(false)
  expect(await screen.findByRole('button', { name: '核对进度' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '重试' })).toBeNull()
  expect(screen.queryByText('反馈已提交')).toBeNull()
})

it('does not offer another write when advancing and reading both lose their responses', async () => {
  port.prepare.mockResolvedValueOnce(snapshot('ready', 'continue'))
  port.advance.mockRejectedValueOnce(new Error('timeout'))
  port.get.mockRejectedValueOnce(new Error('offline'))
  mount()
  await start(false)
  expect(await screen.findByRole('button', { name: '核对进度' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '继续提交' })).toBeNull()
  expect(screen.queryByRole('button', { name: '重试' })).toBeNull()
})

it('allows retry after reopening confirms that an uncertain submission has failed', async () => {
  port.prepare.mockRejectedValueOnce(new Error('connection lost'))
  port.lookup.mockRejectedValueOnce({ code: 'NOT_FOUND' })
  mount()
  await start(false)
  expect(await screen.findByRole('button', { name: '核对进度' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '关闭反馈表单' }))
  const pointer = JSON.parse(sessionStorage.getItem('exwebsite.feedback.community.v1')!)
  port.lookup.mockResolvedValueOnce({
    ...snapshot('failed', 'retry'),
    submissionKey: pointer.submissionKey,
  })
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  expect(await screen.findByRole('button', { name: '重试' })).toBeTruthy()
})

it('preserves a known prepare rejection when lookup still finds no record after reopening', async () => {
  port.prepare.mockRejectedValueOnce({ status: 429, code: 'FEEDBACK_RATE_LIMITED' })
  port.lookup.mockRejectedValue({ code: 'NOT_FOUND' })
  mount()
  await start(false)
  expect(await screen.findByRole('button', { name: '重试' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '关闭反馈表单' }))
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  await waitFor(() => expect(port.lookup).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(
      (screen.queryByRole('button', { name: '重试' }) as HTMLButtonElement | null)?.disabled,
    ).toBe(false),
  )
})

it('closes the open modal only after successful completion', async () => {
  const resolve = deferPrepare()
  mount()
  await start()
  expect(screen.getByRole('dialog')).toBeTruthy()
  await resolve(snapshot('completed', 'done'))
  expect(await screen.findByText('反馈已提交')).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('reports a failure without reopening a modal the user has closed', async () => {
  const resolve = deferPrepare()
  mount()
  await start()
  fireEvent.click(screen.getByRole('button', { name: '关闭反馈表单' }))
  await resolve(snapshot('failed', 'retry'))
  expect(await screen.findByText('本次提交未完成，请重试。')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  port.get.mockResolvedValue(snapshot('failed', 'retry'))
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  expect(await screen.findByRole('button', { name: '重试' })).toBeTruthy()
  expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('体验建议')
})

it('releases the previous account gate without accepting its late completion', async () => {
  const resolve = deferPrepare()
  mount()
  await start()
  act(() => {
    writeToken(localStorage, 'another-account')
  })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
  await resolve(snapshot('completed', 'done'))
  expect(screen.queryByText('反馈已提交')).toBeNull()
})
