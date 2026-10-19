// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileEditor } from '@components/src/ProfileEditor'
import { qqSchema } from '@components/src/profileValidation'

afterEach(cleanup)

it.each([
  ['', true],
  ['1', true],
  ['12345678901234567890', true],
  ['123456789012345678901', false],
  ['12345a', false],
])('accepts QQ value %j only when it is empty or 1 to 20 digits', (value, valid) => {
  expect(qqSchema.safeParse(value).success).toBe(valid)
})

it('validates profile fields and submits only changed values', async () => {
  const onSave = vi.fn(async () => undefined)
  const user = userEvent.setup()
  render(
    <ProfileEditor
      initial={{ nickname: 'First', qq: '000001', fivemId: '' }}
      avatarUrl={null}
      onSave={onSave}
      onUpload={vi.fn()}
      onRemoveAvatar={vi.fn()}
    />,
  )

  await user.clear(screen.getByRole('textbox', { name: 'QQ' }))
  await user.type(screen.getByRole('textbox', { name: 'QQ' }), 'invalid')
  await user.click(screen.getByRole('button', { name: '保存资料' }))
  expect(await screen.findByText('QQ 须为 1 至 20 位数字')).toBeTruthy()
  expect(onSave).not.toHaveBeenCalled()

  await user.clear(screen.getByRole('textbox', { name: 'QQ' }))
  await user.type(screen.getByRole('textbox', { name: 'QQ' }), '000007')
  await user.click(screen.getByRole('button', { name: '保存资料' }))
  expect(onSave).toHaveBeenCalledWith({ qq: '000007' })
})

it('shows a rejected save through the form error state', async () => {
  const user = userEvent.setup()
  render(
    <ProfileEditor
      initial={{ nickname: 'First', qq: '', fivemId: '' }}
      avatarUrl={null}
      onSave={async () => {
        throw new Error('保存暂时失败')
      }}
      onUpload={vi.fn()}
      onRemoveAvatar={vi.fn()}
    />,
  )
  await user.type(screen.getByRole('textbox', { name: 'QQ' }), '123456')
  await user.click(screen.getByRole('button', { name: '保存资料' }))
  expect((await screen.findByText('保存暂时失败')).closest('[role="alert"]')).toBeTruthy()
})
