// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { toast } from '@exre/exui'
import { InvitationRegistrationFlow } from '@web/src/invitations/InvitationRegistrationFlow'
import { ExAxiosError } from '@workspace/sdk'

const post = vi.hoisted(() => vi.fn())
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { POST: post }
    return handlers[(config.method ?? 'GET') as keyof typeof handlers](config)
  },
}))
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', TestResizeObserver)
Object.defineProperty(document, 'elementFromPoint', {
  configurable: true,
  value: () => document.body,
})
afterEach(() => {
  cleanup()
  post.mockReset()
  vi.restoreAllMocks()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})
beforeEach(() => {
  vi.spyOn(toast, 'info').mockReturnValue('info')
  vi.spyOn(toast, 'error').mockReturnValue('error')
})

const eligible = {
  status: 'eligible',
  email: 'member@example.com',
  serverTime: 1000,
  resendAvailableAt: 1000,
}
const verified = {
  status: 'verified',
  email: 'member@example.com',
  nickname: '成员',
  completionToken: 't'.repeat(43),
  serverTime: 1000,
  completionExpiresAt: 100000,
}
function failure(status: number, code: string, retryAfter?: string) {
  return new ExAxiosError('http', code, 'safe', {
    status,
    retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
  })
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
async function enterCode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '继续' }))
  return screen.findByLabelText('6 位验证码') as Promise<HTMLInputElement>
}
function Location() {
  const location = useLocation()
  return (
    <output aria-label="导航结果">
      {location.pathname}:{(location.state as { email?: string } | null)?.email ?? ''}
    </output>
  )
}

it('checks eligibility before mounting an empty OTP and never sends a code implicitly', async () => {
  const user = userEvent.setup()
  post.mockResolvedValue(eligible)
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  expect(post).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('密码')).toBeNull()
  await user.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByLabelText('6 位验证码')).toBeTruthy()
  expect(post).toHaveBeenCalledExactlyOnceWith({
    url: '/auth/invitations/check',
    method: 'POST',
    data: { email: 'member@example.com' },
    alert: false,
  })
  expect(screen.queryByText(/验证码已发送/)).toBeNull()
})

it('sanitizes every code while preserving history state and subscribes once to the StrictMode automatic chain', async () => {
  const first = deferred<typeof eligible>()
  window.history.replaceState(
    { key: 'keep', usr: { other: true } },
    '',
    '/register?email=member%40example.com&code=001234',
  )
  post.mockReturnValueOnce(first.promise).mockResolvedValueOnce(verified)
  render(
    <StrictMode>
      <MemoryRouter>
        <InvitationRegistrationFlow presentation="page" />
      </MemoryRouter>
    </StrictMode>,
  )
  expect(window.location.search).toBe('?email=member%40example.com')
  expect(window.history.state).toEqual({ key: 'keep', usr: { other: true } })
  expect(post).toHaveBeenCalledTimes(1)
  await act(async () => {
    first.resolve(eligible)
  })
  expect(await screen.findByRole('heading', { name: '完善账号' })).toBeTruthy()
  expect(post.mock.calls.map(([config]) => config.url)).toEqual([
    '/auth/invitations/check',
    '/auth/invitations/verify',
  ])
  expect(post).toHaveBeenLastCalledWith({
    url: '/auth/invitations/verify',
    method: 'POST',
    data: { email: 'member@example.com', code: '001234' },
    alert: false,
  })
  expect(screen.queryByLabelText('邮箱')).toBeNull()
})

it.each([
  '?code=001234',
  '?email=bad&code=001234',
  '?email=member@example.com&email=other@example.com&code=001234',
  '?email=member@example.com&code=001234&code=654321',
  '?email=member@example.com&code=bad',
])('clears malformed entry %s without checking or verifying', (search) => {
  window.history.replaceState({ key: 'keep' }, '', `/register${search}`)
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="page" />
    </MemoryRouter>,
  )
  expect(new URLSearchParams(window.location.search).has('code')).toBe(false)
  expect(screen.getByText('注册入口参数无效，请重新填写邮箱')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()
})

it('prefills a legal URL email and waits for an explicit eligibility check', () => {
  window.history.replaceState(null, '', '/register?email=member@example.com')
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="page" />
    </MemoryRouter>,
  )
  expect((screen.getByLabelText('邮箱') as HTMLInputElement).value).toBe('member@example.com')
  expect(post).not.toHaveBeenCalled()
})

it.each([
  [404, 'INVITATION_APPLICATION_NOT_FOUND', '未找到该邮箱的申请。'],
  [409, 'INVITATION_NOT_ELIGIBLE', '该邮箱暂不符合注册条件，请确认申请已通过且邀请仍有效'],
])(
  'does not verify after automatic check %s and shows one persistent failure under StrictMode',
  async (status, code, message) => {
    const notify = vi.spyOn(toast, 'error')
    window.history.replaceState(null, '', '/register?email=member@example.com&code=001234')
    post.mockRejectedValue(failure(status as number, code as string))
    render(
      <StrictMode>
        <MemoryRouter>
          <InvitationRegistrationFlow presentation="page" />
        </MemoryRouter>
      </StrictMode>,
    )
    await waitFor(() => expect(screen.getAllByText(message as string)).toHaveLength(1))
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(notify).not.toHaveBeenCalled()
    expect(post).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText('6 位验证码')).toBeNull()
  },
)

it('retains the six-digit leading-zero code after a network error and retries only explicitly', async () => {
  const user = userEvent.setup()
  post
    .mockResolvedValueOnce(eligible)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(verified)
  const rendered = render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  const code = await enterCode(user)
  await user.click(code)
  await user.paste('001234')
  expect(await screen.findByRole('button', { name: '重试验证' })).toBeTruthy()
  expect(code.value).toBe('001234')
  rendered.rerender(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  expect(post).toHaveBeenCalledTimes(2)
  await user.click(screen.getByRole('button', { name: '重试验证' }))
  expect(await screen.findByRole('heading', { name: '完善账号' })).toBeTruthy()
  expect(post).toHaveBeenCalledTimes(3)
})

it('clears a captured URL code when automatic verification fails and exposes a field error', async () => {
  window.history.replaceState(null, '', '/register?email=member@example.com&code=001234')
  post
    .mockResolvedValueOnce(eligible)
    .mockRejectedValueOnce(failure(400, 'INVITATION_CODE_INVALID'))
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="page" />
    </MemoryRouter>,
  )
  const code = (await screen.findByLabelText('6 位验证码')) as HTMLInputElement
  expect(code.value).toBe('')
  await waitFor(() => expect(code.getAttribute('aria-invalid')).toBe('true'))
})

it('keeps a code after resend network failure and clears it only after 202 with the response cooldown', async () => {
  const user = userEvent.setup(),
    notify = vi.spyOn(toast, 'info')
  post
    .mockResolvedValueOnce(eligible)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ status: 'accepted', serverTime: 5000, resendAvailableAt: 65000 })
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  const code = await enterCode(user)
  await user.type(code, '001')
  await user.click(screen.getByRole('button', { name: '重新发送验证码' }))
  expect(code.value).toBe('001')
  await user.click(screen.getByRole('button', { name: '重新发送验证码' }))
  expect(code.value).toBe('')
  expect((screen.getByRole('button', { name: '60 秒后重发' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect(notify).toHaveBeenCalledExactlyOnceWith('如邮箱符合邀请条件，将发送验证码')
})

it('prevents resend from bypassing a verification lock and enables explicit retry when it expires', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  const user = userEvent.setup()
  post
    .mockResolvedValueOnce(eligible)
    .mockRejectedValueOnce(failure(429, 'INVITATION_CODE_LOCKED', '2'))
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: '继续' }))
  const code = screen.getByLabelText('6 位验证码')
  await user.type(code, '001234')
  expect((screen.getByRole('button', { name: '重试验证' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect(
    (screen.getByRole('button', { name: '重新发送验证码' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
  expect((screen.getByRole('button', { name: '重试验证' }) as HTMLButtonElement).disabled).toBe(
    false,
  )
  expect(
    (screen.getByRole('button', { name: '重新发送验证码' }) as HTMLButtonElement).disabled,
  ).toBe(false)
  expect(post).toHaveBeenCalledTimes(2)
})

it('rejects an old email check after the email changes without sending a notification', async () => {
  const user = userEvent.setup(),
    next = deferred<typeof eligible>(),
    notify = vi.spyOn(toast, 'error')
  post.mockReturnValue(next.promise)
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: '继续' }))
  await user.clear(screen.getByLabelText('邮箱'))
  await user.type(screen.getByLabelText('邮箱'), 'other@example.com')
  await act(async () => {
    next.reject(failure(404, 'INVITATION_APPLICATION_NOT_FOUND'))
  })
  expect(notify).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('6 位验证码')).toBeNull()
})

it('back cancels late verification and requires the new email to be checked again', async () => {
  const user = userEvent.setup(),
    next = deferred<typeof verified>()
  post
    .mockResolvedValueOnce(eligible)
    .mockReturnValueOnce(next.promise)
    .mockResolvedValueOnce({ ...eligible, email: 'other@example.com' })
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  await user.type(await enterCode(user), '001234')
  await user.click(screen.getByRole('button', { name: '返回修改邮箱' }))
  await act(async () => {
    next.resolve(verified)
  })
  expect(screen.queryByRole('heading', { name: '完善账号' })).toBeNull()
  await user.clear(screen.getByLabelText('邮箱'))
  await user.type(screen.getByLabelText('邮箱'), 'other@example.com')
  await user.click(screen.getByRole('button', { name: '继续' }))
  expect(post).toHaveBeenLastCalledWith({
    url: '/auth/invitations/check',
    method: 'POST',
    data: { email: 'other@example.com' },
    alert: false,
  })
})

it('unmount during the automatic check prevents verification and late notifications', async () => {
  const next = deferred<typeof eligible>(),
    notify = vi.spyOn(toast, 'error')
  window.history.replaceState(null, '', '/register?email=member@example.com&code=001234')
  post.mockReturnValue(next.promise)
  const rendered = render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="page" />
    </MemoryRouter>,
  )
  rendered.unmount()
  await act(async () => {
    next.resolve(eligible)
  })
  expect(post).toHaveBeenCalledTimes(1)
  expect(notify).not.toHaveBeenCalled()
})

it.each(['modal', 'page'] as const)(
  'completes %s without a session, clears sensitive inputs, and manually enters ordinary login once',
  async (presentation) => {
    const user = userEvent.setup(),
      onLogin = vi.fn(),
      notify = vi.spyOn(toast, 'info')
    post
      .mockResolvedValueOnce(eligible)
      .mockResolvedValueOnce(verified)
      .mockResolvedValueOnce({ status: 'registered', email: 'member@example.com' })
    render(
      <MemoryRouter>
        <InvitationRegistrationFlow
          presentation={presentation}
          initialEmail="member@example.com"
          onLogin={onLogin}
        />
        <Location />
      </MemoryRouter>,
    )
    await user.type(await enterCode(user), '001234')
    const password = await screen.findByLabelText('密码')
    await user.type(password, ' password-one ')
    await user.click(screen.getByRole('button', { name: '完成注册' }))
    expect(post).toHaveBeenLastCalledWith({
      url: '/auth/invitations/complete',
      method: 'POST',
      data: {
        completionToken: verified.completionToken,
        nickname: '成员',
        password: ' password-one ',
      },
      alert: false,
    })
    expect(screen.queryByLabelText('密码')).toBeNull()
    expect(notify).toHaveBeenCalledExactlyOnceWith('注册成功，请前往登录')
    await user.click(screen.getByRole('button', { name: '前往登录' }))
    if (presentation === 'modal')
      expect(onLogin).toHaveBeenCalledExactlyOnceWith('member@example.com')
    else expect(screen.getByLabelText('导航结果').textContent).toBe('/login:member@example.com')
    expect(post).toHaveBeenCalledTimes(3)
  },
)

it.each(['modal', 'page'] as const)(
  'automatically enters ordinary login after 1.5 seconds exactly once for %s',
  async (presentation) => {
    const user = userEvent.setup(),
      onLogin = vi.fn()
    post
      .mockResolvedValueOnce(eligible)
      .mockResolvedValueOnce(verified)
      .mockResolvedValueOnce({ status: 'registered', email: 'member@example.com' })
    render(
      <MemoryRouter>
        <InvitationRegistrationFlow
          presentation={presentation}
          initialEmail="member@example.com"
          onLogin={onLogin}
        />
        <Location />
      </MemoryRouter>,
    )
    await user.type(await enterCode(user), '001234')
    await user.type(await screen.findByLabelText('密码'), 'password-one')
    const start = Date.now()
    await user.click(screen.getByRole('button', { name: '完成注册' }))
    expect(onLogin).not.toHaveBeenCalled()
    await waitFor(
      () => {
        if (presentation === 'modal')
          expect(onLogin).toHaveBeenCalledExactlyOnceWith('member@example.com')
        else expect(screen.getByLabelText('导航结果').textContent).toBe('/login:member@example.com')
      },
      { timeout: 2200 },
    )
    expect(Date.now() - start).toBeGreaterThanOrEqual(1450)
    await user.click(screen.getByRole('button', { name: '前往登录' }))
    if (presentation === 'modal') expect(onLogin).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(3)
  },
)

it('clears the success timer on close and never switches the closed modal to login', async () => {
  const user = userEvent.setup(),
    onLogin = vi.fn()
  post
    .mockResolvedValueOnce(eligible)
    .mockResolvedValueOnce(verified)
    .mockResolvedValueOnce({ status: 'registered', email: 'member@example.com' })
  const rendered = render(
    <MemoryRouter>
      <InvitationRegistrationFlow
        presentation="modal"
        initialEmail="member@example.com"
        onLogin={onLogin}
      />
    </MemoryRouter>,
  )
  await user.type(await enterCode(user), '001234')
  await user.type(await screen.findByLabelText('密码'), 'password-one')
  await user.click(screen.getByRole('button', { name: '完成注册' }))
  rendered.unmount()
  await new Promise((resolve) => setTimeout(resolve, 1600))
  expect(onLogin).not.toHaveBeenCalled()
})

const checkCases = [
  { status: 400, code: 'VALIDATION_ERROR', message: '请输入有效的邮箱地址', panel: false },
  {
    status: 404,
    code: 'INVITATION_APPLICATION_NOT_FOUND',
    message: '未找到该邮箱的申请。',
    panel: true,
  },
  {
    status: 409,
    code: 'INVITATION_NOT_ELIGIBLE',
    message: '该邮箱暂不符合注册条件，请确认申请已通过且邀请仍有效',
    panel: true,
  },
  {
    status: 429,
    code: 'RATE_LIMITED',
    retryAfter: '2',
    message: '检查失败，请在 2 秒后重试',
    panel: true,
  },
  { status: undefined, code: '', message: '检查失败，请重试', panel: true },
]
for (const presentation of ['page', 'modal'] as const) {
  it.each(checkCases)(
    `shows one manual ${presentation} check failure for $status in its owning form`,
    async ({ status, code, retryAfter, message, panel }) => {
      const user = userEvent.setup()
      post.mockRejectedValue(
        status === undefined ? new Error('private stack') : failure(status, code, retryAfter),
      )
      render(
        <MemoryRouter>
          <InvitationRegistrationFlow
            presentation={presentation}
            initialEmail="member@example.com"
          />
        </MemoryRouter>,
      )
      await user.click(screen.getByRole('button', { name: '继续' }))
      expect(await screen.findAllByText(message)).toHaveLength(1)
      expect(screen.queryAllByRole('region')).toHaveLength(panel ? 1 : 0)
      expect(toast.error).not.toHaveBeenCalled()
      expect(screen.queryByText('private stack')).toBeNull()
      expect(screen.getByLabelText('邮箱').getAttribute('aria-invalid')).toBe(
        panel ? 'false' : 'true',
      )
      await user.type(screen.getByLabelText('邮箱'), 'x')
      expect(screen.queryByText(message)).toBeNull()
    },
  )
}

it.each([undefined, '0', '-1', 'NaN', 'Infinity'])(
  'falls back to a safe rate-limit message for wait %s',
  async (retryAfter) => {
    const user = userEvent.setup()
    post.mockRejectedValue(failure(429, 'RATE_LIMITED', retryAfter))
    render(
      <MemoryRouter>
        <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findAllByText('检查失败，请稍后重试')).toHaveLength(1)
    expect(toast.error).not.toHaveBeenCalled()
  },
)

it.each(checkCases)(
  'shares the manual check mapping with automatic $status failures under StrictMode',
  async ({ status, code, retryAfter, message, panel }) => {
    window.history.replaceState(null, '', '/register?email=member@example.com&code=001234')
    post.mockRejectedValue(
      status === undefined ? new Error('offline') : failure(status, code, retryAfter),
    )
    render(
      <StrictMode>
        <MemoryRouter>
          <InvitationRegistrationFlow presentation="page" />
        </MemoryRouter>
      </StrictMode>,
    )
    expect(await screen.findAllByText(message)).toHaveLength(1)
    expect(screen.queryAllByRole('region')).toHaveLength(panel ? 1 : 0)
    expect(screen.getByLabelText('邮箱').getAttribute('aria-invalid')).toBe(
      panel ? 'false' : 'true',
    )
    expect(post).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
  },
)

it('clears a failed check panel while retrying, then uses the existing panel join callback', async () => {
  const user = userEvent.setup(),
    next = deferred<typeof eligible>(),
    onJoin = vi.fn()
  post.mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(next.promise)
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow
        presentation="modal"
        initialEmail="member@example.com"
        onJoin={onJoin}
      />
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByRole('region')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '继续' }))
  expect(screen.queryByRole('region')).toBeNull()
  await act(async () => {
    next.reject(failure(404, 'INVITATION_APPLICATION_NOT_FOUND'))
  })
  const panel = await screen.findByRole('region', { name: '暂时无法注册' })
  await user.click(panel.querySelector('button')!)
  expect(onJoin).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('region')).toBeNull()
})

it('delivers automatic locked verification to the mounted code field once under StrictMode', async () => {
  window.history.replaceState(null, '', '/register?email=member@example.com&code=001234')
  post
    .mockResolvedValueOnce(eligible)
    .mockRejectedValueOnce(failure(429, 'INVITATION_CODE_LOCKED', '2'))
  render(
    <StrictMode>
      <MemoryRouter>
        <InvitationRegistrationFlow presentation="page" />
      </MemoryRouter>
    </StrictMode>,
  )
  const code = (await screen.findByLabelText('6 位验证码')) as HTMLInputElement
  await waitFor(() => expect(code.getAttribute('aria-invalid')).toBe('true'))
  expect(code.value).toBe('')
  expect(screen.getAllByText('验证暂时锁定，请稍后重试')).toHaveLength(1)
  expect(screen.queryByRole('region')).toBeNull()
  expect((screen.getByRole('button', { name: '重试验证' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect(
    (screen.getByRole('button', { name: '重新发送验证码' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  expect(post).toHaveBeenCalledTimes(2)
})

it('keeps manual verification failure in the field alone and does not loop on countdown renders', async () => {
  const user = userEvent.setup()
  post
    .mockResolvedValueOnce(eligible)
    .mockRejectedValueOnce(failure(400, 'INVITATION_CODE_INVALID'))
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  await user.type(await enterCode(user), '001234')
  expect(await screen.findAllByText('验证码无效或已过期，请重新获取')).toHaveLength(1)
  expect(screen.queryByRole('region')).toBeNull()
  expect(toast.error).not.toHaveBeenCalled()
})

it('puts resend failure in one code-form panel without a field error and clears it before retrying', async () => {
  const user = userEvent.setup(),
    next = deferred<{ status: string; serverTime: number; resendAvailableAt: number }>()
  post
    .mockResolvedValueOnce(eligible)
    .mockRejectedValueOnce(new Error('offline'))
    .mockReturnValueOnce(next.promise)
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  const code = await enterCode(user)
  await user.type(code, '001')
  await user.click(screen.getByRole('button', { name: '重新发送验证码' }))
  expect(await screen.findAllByText('发送失败，请重试')).toHaveLength(1)
  expect(screen.getAllByRole('region')).toHaveLength(1)
  expect(code.getAttribute('aria-invalid')).toBe('false')
  expect(code.value).toBe('001')
  await user.click(screen.getByRole('button', { name: '重新发送验证码' }))
  expect(screen.queryByRole('region')).toBeNull()
  await act(async () => {
    next.resolve({ status: 'accepted', serverTime: 1000, resendAvailableAt: 1000 })
  })
  expect(code.value).toBe('')
  expect(toast.info).toHaveBeenCalledExactlyOnceWith('如邮箱符合邀请条件，将发送验证码')
  expect(toast.error).not.toHaveBeenCalled()
})

it.each([
  ['COMPLETION_GRANT_INVALID', '验证已过期，请返回邮箱重新验证'],
  ['OTHER', '注册失败，请重试'],
])('shows one profile failure for %s and clears it before retrying', async (code, message) => {
  const user = userEvent.setup(),
    next = deferred<{ status: string; email: string }>()
  post
    .mockResolvedValueOnce(eligible)
    .mockResolvedValueOnce(verified)
    .mockRejectedValueOnce(failure(400, code))
    .mockReturnValueOnce(next.promise)
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  await user.type(await enterCode(user), '001234')
  await user.type(await screen.findByLabelText('密码'), 'password-one')
  await user.click(screen.getByRole('button', { name: '完成注册' }))
  expect(await screen.findAllByText(message)).toHaveLength(1)
  expect(screen.getAllByRole('region')).toHaveLength(1)
  expect(screen.getByLabelText('密码').getAttribute('aria-invalid')).toBe('false')
  await user.click(screen.getByRole('button', { name: '完成注册' }))
  expect(screen.queryByRole('region')).toBeNull()
  await user.click(screen.getByRole('button', { name: '返回修改邮箱' }))
  await act(async () => {
    next.reject(failure(400, code))
  })
  expect(screen.queryByText(message)).toBeNull()
  expect(screen.queryByRole('region')).toBeNull()
  expect(toast.error).not.toHaveBeenCalled()
})

it('rejects late automatic verification errors after changing the email', async () => {
  const user = userEvent.setup(),
    next = deferred<typeof verified>()
  window.history.replaceState(null, '', '/register?email=member@example.com&code=001234')
  post.mockResolvedValueOnce(eligible).mockReturnValueOnce(next.promise)
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="page" />
    </MemoryRouter>,
  )
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  await user.type(screen.getByLabelText('邮箱'), 'x')
  await act(async () => {
    next.reject(failure(400, 'INVITATION_CODE_INVALID'))
  })
  expect(screen.queryByLabelText('6 位验证码')).toBeNull()
  expect(screen.queryByText('验证码无效或已过期，请重新获取')).toBeNull()
})

it('rejects a late resend error after returning to email', async () => {
  const user = userEvent.setup(),
    next = deferred<typeof eligible>()
  post.mockResolvedValueOnce(eligible).mockReturnValueOnce(next.promise)
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="member@example.com" />
    </MemoryRouter>,
  )
  await enterCode(user)
  await user.click(screen.getByRole('button', { name: '重新发送验证码' }))
  await user.click(screen.getByRole('button', { name: '返回修改邮箱' }))
  await act(async () => {
    next.reject(new Error('offline'))
  })
  expect(screen.queryByText('发送失败，请重试')).toBeNull()
  expect(screen.queryByRole('region')).toBeNull()
})
