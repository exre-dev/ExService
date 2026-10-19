// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { createContentStore, type ContentModule } from './store'
import { useContent } from './useContent'
afterEach(cleanup)

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
