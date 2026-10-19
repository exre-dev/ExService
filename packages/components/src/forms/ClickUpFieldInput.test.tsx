// @vitest-environment jsdom
import { useState } from 'react'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@exre/exui'
import { ClickUpFieldInput, type ClickUpFieldDefinition } from './ClickUpFieldInput'

afterEach(cleanup)
const originalScroll = Element.prototype.scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterAll(() => {
  if (originalScroll) Element.prototype.scrollIntoView = originalScroll
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

const base: ClickUpFieldDefinition = {
  id: 'field',
  name: 'Provider field',
  type: 'drop_down',
  required: false,
  type_config: {
    options: [
      { id: 'second', name: 'Second', color: null, orderindex: 2 },
      { id: 'first', name: 'First', color: null, orderindex: 1 },
    ],
  },
}

function mount(definition: ClickUpFieldDefinition | undefined, value = '') {
  const onChange = vi.fn(),
    onBlur = vi.fn(),
    ref = vi.fn()
  render(
    <ThemeProvider defaultTheme="light">
      <ClickUpFieldInput
        definition={definition}
        binding={{ name: 'provider', value, onChange, onBlur, ref }}
        error="Choose a value"
        disabled={false}
      />
    </ThemeProvider>,
  )
  return { onChange, onBlur, ref }
}

it('opens a styled menu in provider order and supports selecting and clearing an optional value', async () => {
  function ControlledField() {
    const [value, setValue] = useState('second')
    return (
      <ThemeProvider defaultTheme="light">
        <ClickUpFieldInput
          definition={base}
          binding={{ name: 'provider', value, onChange: setValue, onBlur: () => {}, ref: () => {} }}
          error="Choose a value"
        />
        <output aria-label="Selected ID">{value || 'empty'}</output>
      </ThemeProvider>
    )
  }
  render(<ControlledField />)
  const select = screen.getByRole('combobox', { name: /Provider field/ })
  expect(select.textContent).toContain('Second')
  expect(select.getAttribute('aria-invalid')).toBe('true')
  fireEvent.keyDown(select, { key: 'ArrowDown' })
  const menu = await screen.findByRole('listbox')
  expect(
    within(menu)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['不选择', 'First', 'Second'])
  fireEvent.click(within(menu).getByRole('option', { name: 'First' }))
  await waitFor(() => expect(screen.getByLabelText('Selected ID').textContent).toBe('first'))
  fireEvent.keyDown(select, { key: 'ArrowDown' })
  fireEvent.click(
    within(await screen.findByRole('listbox')).getByRole('option', { name: '不选择' }),
  )
  await waitFor(() => expect(screen.getByLabelText('Selected ID').textContent).toBe('empty'))
  expect(select.textContent).toContain('请选择')
})

it('renders text controls and degrades malformed definitions to an accessible error', () => {
  const text = mount({ ...base, type: 'text', type_config: { options: [] } }, 'line one')
  const area = screen.getByLabelText(/Provider field/) as HTMLTextAreaElement
  expect(area.value).toBe('line one')
  fireEvent.change(area, { target: { value: 'line two' } })
  expect(text.onChange).toHaveBeenCalledWith('line two')
  cleanup()
  mount({ ...base, type: 'short_text', type_config: { options: [] } }, 'short')
  expect((screen.getByLabelText(/Provider field/) as HTMLInputElement).value).toBe('short')
  cleanup()
  mount({ ...base, type_config: undefined } as unknown as ClickUpFieldDefinition)
  expect(screen.getByRole('alert').textContent).toContain('字段配置不可用')
})
