// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@exre/exui'
import { FileUploader } from './FileUploader'

afterEach(cleanup)

it('appends and removes accepted files while rejecting MIME and size violations', () => {
  const onChange = vi.fn(),
    onSelectionError = vi.fn()
  const a = new File(['a'], 'one.png', { type: 'image/png' })
  const b = new File(['bb'], 'two.png', { type: 'image/png' })
  const props = {
    maxFiles: 2,
    maxFileSize: 2,
    maxTotalSize: 3,
    acceptedTypes: ['image/*'],
    onChange,
    onSelectionError,
  }
  const view = render(
    <ThemeProvider defaultTheme="light">
      <FileUploader {...props} value={[]} />
    </ThemeProvider>,
  )
  fireEvent.change(screen.getByLabelText(/^附件/), { target: { files: [a] } })
  expect(onChange).toHaveBeenLastCalledWith([a])
  view.rerender(
    <ThemeProvider defaultTheme="light">
      <FileUploader {...props} value={[a]} />
    </ThemeProvider>,
  )
  fireEvent.change(screen.getByLabelText(/^附件/), { target: { files: [b] } })
  expect(onChange).toHaveBeenLastCalledWith([a, b])
  fireEvent.change(screen.getByLabelText(/^附件/), {
    target: { files: [new File(['x'], 'bad.txt', { type: 'text/plain' })] },
  })
  expect(onSelectionError).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText(/^附件/), {
    target: { files: [new File(['xxx'], 'oversize.png', { type: 'image/png' })] },
  })
  expect(onSelectionError).toHaveBeenCalledTimes(2)
  view.rerender(
    <ThemeProvider defaultTheme="light">
      <FileUploader {...props} value={[a, b]} />
    </ThemeProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: '移除附件 one.png' }))
  expect(onChange).toHaveBeenLastCalledWith([b])
})

it('toggles and edits multiline large-file information independently of file selection', () => {
  const enabled = vi.fn(),
    changed = vi.fn()
  const props = {
    value: [],
    onChange: vi.fn(),
    maxFiles: 1,
    maxFileSize: 10,
    maxTotalSize: 10,
    enableLargeFileInfo: true,
    onLargeFileInfoEnabledChange: enabled,
    onLargeFileInfoChange: changed,
  }
  const view = render(
    <ThemeProvider defaultTheme="light">
      <FileUploader {...props} largeFileInfoEnabled={false} />
    </ThemeProvider>,
  )
  fireEvent.click(screen.getByRole('switch', { name: '补充大文件信息' }))
  expect(enabled).toHaveBeenCalledWith(true)
  view.rerender(
    <ThemeProvider defaultTheme="light">
      <FileUploader {...props} largeFileInfoEnabled largeFileInfo="line one" />
    </ThemeProvider>,
  )
  const area = screen.getByLabelText('大文件补充信息') as HTMLTextAreaElement
  expect(area.value).toBe('line one')
  fireEvent.change(area, { target: { value: 'line one\nline two' } })
  expect(changed).toHaveBeenCalledWith('line one\nline two')
})
