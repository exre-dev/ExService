// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CodeBlock } from './CodeBlock'
import { ExMessage } from '@exre/exui'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('copies each block original text, without line numbers or other blocks', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const info = vi.spyOn(ExMessage, 'info').mockReturnValue('copied')
  render(
    <>
      <CodeBlock rawCode={'first\n'}>
        <code>decorated first</code>
      </CodeBlock>
      <CodeBlock rawCode="second">
        <code>decorated second</code>
      </CodeBlock>
    </>,
  )
  fireEvent.click(screen.getAllByRole('button', { name: '复制代码' })[1]!)
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('second'))
  expect(info).toHaveBeenCalledWith('代码已复制')
})
it('reports a fixed error when clipboard is unavailable', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  const error = vi.spyOn(ExMessage, 'error').mockReturnValue('failed')
  render(
    <CodeBlock rawCode="example">
      <code>example</code>
    </CodeBlock>,
  )
  fireEvent.click(screen.getByRole('button', { name: '复制代码' }))
  await waitFor(() => expect(error).toHaveBeenCalledWith('无法复制，请手动选择代码'))
})
