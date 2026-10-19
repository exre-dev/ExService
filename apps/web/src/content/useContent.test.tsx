// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createContentStore, type ContentModule } from './store'
import { useContent } from './useContent'
afterEach(cleanup)

it('retains the original load error and discards it when retry succeeds', async () => {
  const failure = new Error('Original MDX import failure')
  let attempts = 0
  const store = createContentStore({
    a: async () => {
      if (++attempts === 1) throw failure
      return { default: () => <p>Recovered body</p> }
    },
  })
  let observed: unknown
  function Body() {
    const state = useContent(store, 'a')
    if (state.status === 'error') observed = state.error
    return state.status === 'ready' ? (
      <state.module.default />
    ) : (
      <button onClick={state.retry}>{state.status}</button>
    )
  }
  render(<Body />)
  fireEvent.click(await screen.findByText('error'))
  expect(observed).toBe(failure)
  await screen.findByText('Recovered body')
  expect(attempts).toBe(2)
})

it('never shows a stale body while switching or after an old request resolves', async () => {
  let finishA!: (module: ContentModule) => void
  const store = createContentStore({
    a: () =>
      new Promise((resolve) => {
        finishA = resolve
      }),
    b: async () => ({ default: () => <p>Body B</p> }),
  })
  function Body({ id }: { id: string }) {
    const state = useContent(store, id)
    return state.status === 'ready' ? <state.module.default /> : <p>{state.status}</p>
  }
  const view = render(<Body id="a" />)
  await act(async () => {
    await Promise.resolve()
  })
  view.rerender(<Body id="b" />)
  expect(screen.queryByText('Body A')).toBeNull()
  await screen.findByText('Body B')
  await act(async () => {
    finishA({ default: () => <p>Body A</p> })
    await Promise.resolve()
  })
  expect(screen.queryByText('Body A')).toBeNull()
  expect(screen.getByText('Body B')).toBeTruthy()
})
