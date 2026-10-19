// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { ThemeProvider } from '@exre/exui'
import { FeedbackMarkdownField } from './FeedbackMarkdownField'

afterEach(cleanup)
function Harness() {
  const [value, setValue] = useState('')
  return (
    <ThemeProvider defaultTheme="light">
      <FeedbackMarkdownField
        id="body"
        label="内容"
        value={value}
        contentFormat="markdown"
        placeholder="填写正文"
        onChange={setValue}
        onBlur={() => {}}
        onValidationChange={() => {}}
      />
      <output aria-label="Markdown">{value}</output>
      <button onClick={() => setValue('# 重置正文')}>重置</button>
    </ThemeProvider>
  )
}
function paste(node: HTMLElement, text: string, html = '') {
  fireEvent.paste(node, {
    clipboardData: { files: [], getData: (type: string) => (type === 'text/html' ? html : text) },
  })
}
it('exports formatted Markdown and silently downgrades pasted rich text without a toolbar', async () => {
  render(<Harness />)
  const body = screen.getByRole('textbox', { name: '内容' })
  paste(body, '加粗', '<p><span style="color:red"><strong>加粗</strong></span></p>')
  await waitFor(() => expect(screen.getByLabelText('Markdown').textContent).toBe('**加粗**'))
  expect(body.querySelector('strong')?.textContent).toBe('加粗')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('toolbar')).toBeNull()
  expect(screen.queryByText(/降级|纯文本|简化不兼容/)).toBeNull()
})
it('replaces content on an external draft reset instead of keeping the preceding draft', async () => {
  render(<Harness />)
  paste(screen.getByRole('textbox', { name: '内容' }), '**旧正文**')
  await waitFor(() => expect(screen.getByLabelText('Markdown').textContent).toBe('**旧正文**'))
  fireEvent.click(screen.getByRole('button', { name: '重置' }))
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: '内容' }).querySelector('h1')?.textContent).toBe(
      '重置正文',
    ),
  )
  expect(screen.queryByText('旧正文')).toBeNull()
})
it('shows frozen legacy bodies literally and preserves their original form value', async () => {
  const change = vi.fn(),
    validity = vi.fn()
  render(
    <ThemeProvider defaultTheme="light">
      <FeedbackMarkdownField
        id="legacy"
        label="旧正文"
        value="**字面正文**"
        disabled
        onChange={change}
        onBlur={() => {}}
        onValidationChange={validity}
      />
    </ThemeProvider>,
  )
  const body = screen.getByRole('textbox', { name: '旧正文' })
  expect(body.textContent).toBe('**字面正文**')
  expect(body.querySelector('strong')).toBeNull()
  expect(body.getAttribute('contenteditable')).toBe('false')
  await waitFor(() => expect(validity).toHaveBeenCalledWith(null))
  expect(change).not.toHaveBeenCalled()
})
it('displays every line of a valid legacy snapshot beyond the editor node budget', () => {
  const value = Array(6001).fill('x').join('\n')
  render(
    <ThemeProvider defaultTheme="light">
      <FeedbackMarkdownField
        id="long-legacy"
        label="历史正文"
        value={value}
        disabled
        onChange={vi.fn()}
        onBlur={() => {}}
        onValidationChange={() => {}}
      />
    </ThemeProvider>,
  )
  expect(screen.getByRole('textbox', { name: '历史正文' }).textContent).toBe(value)
  expect(screen.queryByRole('alert')).toBeNull()
})
