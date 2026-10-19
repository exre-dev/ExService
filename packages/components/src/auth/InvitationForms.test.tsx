// @vitest-environment jsdom
import { createRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  InvitationCodeForm,
  InvitationEmailForm,
  InvitationProfileForm,
} from '@components/src/auth/InvitationForms'
import type { InvitationFormHandle } from '@components/src/auth/invitationFeedback'

class TestResizeObserver {
  observe() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', TestResizeObserver)
Object.defineProperty(document, 'elementFromPoint', {
  configurable: true,
  value: () => document.body,
})
afterEach(cleanup)
function emailForm() {
  const ref = createRef<InvitationFormHandle>(),
    onJoin = vi.fn(),
    onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <InvitationEmailForm
      ref={ref}
      initialEmail="member@example.com"
      busy={false}
      onSubmit={onSubmit}
      onEmailChange={() => {}}
      onLogin={() => {}}
      onJoin={onJoin}
    />,
  )
  return { ref, onJoin, onSubmit }
}

it('renders the semantic application failure after the field and before submit, with the existing join callback', async () => {
  const user = userEvent.setup(),
    { ref, onJoin } = emailForm()
  act(() =>
    ref.current?.setServerErrors({
      form: '未找到该邮箱的申请。',
      formKind: 'application-not-found',
    }),
  )
  const input = screen.getByLabelText('邮箱'),
    panel = screen.getByRole('region', { name: '暂时无法注册' })
  expect(screen.getAllByText('未找到该邮箱的申请。')).toHaveLength(1)
  expect(screen.getByText('请先申请加入，获批后再回来注册。')).toBeTruthy()
  expect(input.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    panel.compareDocumentPosition(screen.getByRole('button', { name: '继续' })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(input.getAttribute('aria-invalid')).toBe('false')
  expect(input.getAttribute('aria-describedby')).toBe(panel.id)
  await user.click(panel.querySelector('button')!)
  expect(onJoin).toHaveBeenCalledTimes(1)
})

it('preserves both email field and panel descriptions and removes their references on clear', () => {
  const { ref } = emailForm()
  act(() =>
    ref.current?.setServerErrors({ email: '字段错误', form: '流程错误', formKind: 'check-failed' }),
  )
  const input = screen.getByLabelText('邮箱'),
    panel = screen.getByRole('region')
  const ids = input.getAttribute('aria-describedby')!.split(' ')
  expect(ids).toContain(panel.id)
  expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual([
    '字段错误',
    '流程错误',
  ])
  act(() => ref.current?.clearServerErrors())
  expect(input.hasAttribute('aria-describedby')).toBe(false)
  expect(input.getAttribute('aria-invalid')).toBe('false')
  expect(screen.queryByRole('region')).toBeNull()
})

it('clears the previous eligibility result as the email is edited and does not use a kind without a message', async () => {
  const user = userEvent.setup(),
    { ref } = emailForm()
  act(() =>
    ref.current?.setServerErrors({
      form: '未找到该邮箱的申请。',
      formKind: 'application-not-found',
    }),
  )
  await user.type(screen.getByLabelText('邮箱'), 'x')
  expect(screen.queryByRole('region')).toBeNull()
  act(() => ref.current?.setServerErrors({ formKind: 'application-not-found' }))
  expect(screen.queryByRole('region')).toBeNull()
})

it('shows an unclassified root error as a generic panel without extra action or description', () => {
  const { ref } = emailForm()
  act(() => ref.current?.setServerErrors({ form: '普通流程错误' }))
  const panel = screen.getByRole('region', { name: '错误信息' })
  expect(panel.textContent).toBe('普通流程错误')
  expect(panel.querySelector('footer')).toBeNull()
})

it('keeps resend failures in the code root without invalidating its input, then clears before the next attempt', async () => {
  const ref = createRef<InvitationFormHandle>(),
    user = userEvent.setup()
  const onResend = vi.fn(async () => false)
  render(
    <InvitationCodeForm
      ref={ref}
      email="member@example.com"
      busy={false}
      retry={false}
      resendSeconds={0}
      lockedSeconds={0}
      onVerify={async () => {}}
      onResend={onResend}
      onBack={() => {}}
    />,
  )
  act(() => ref.current?.setServerErrors({ form: '发送失败，请重试', formKind: 'send-failed' }))
  const code = screen.getByLabelText('6 位验证码'),
    panel = screen.getByRole('region')
  expect(code.getAttribute('aria-invalid')).toBe('false')
  expect(code.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    panel.compareDocumentPosition(screen.getByRole('button', { name: '重新发送验证码' })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '重新发送验证码' }))
  expect(onResend).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('region')).toBeNull()
  act(() => ref.current?.setServerErrors({ code: '验证码无效或已过期，请重新获取' }))
  expect(screen.queryByRole('region')).toBeNull()
  expect(code.getAttribute('aria-invalid')).toBe('true')
})

it('places profile failure after all fields, preserves values, and clears it before a retry', async () => {
  const ref = createRef<InvitationFormHandle>(),
    user = userEvent.setup()
  const onSubmit = vi.fn(async () => {})
  render(
    <InvitationProfileForm
      ref={ref}
      email="member@example.com"
      nickname="成员"
      busy={false}
      onSubmit={onSubmit}
      onBack={() => {}}
    />,
  )
  await user.type(screen.getByLabelText('密码'), 'password-one')
  act(() =>
    ref.current?.setServerErrors({
      form: '验证已过期，请返回邮箱重新验证',
      formKind: 'completion-expired',
    }),
  )
  const panel = screen.getByRole('region'),
    password = screen.getByLabelText('密码') as HTMLInputElement
  expect(password.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    panel.compareDocumentPosition(screen.getByRole('button', { name: '完成注册' })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(password.getAttribute('aria-invalid')).toBe('false')
  expect(password.value).toBe('password-one')
  expect(panel.querySelector('footer')).toBeNull()
  await user.click(screen.getByRole('button', { name: '完成注册' }))
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ nickname: '成员', password: 'password-one' })
  expect(screen.queryByRole('region')).toBeNull()
})
