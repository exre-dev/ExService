import { useEffect, useState } from 'react'
import type { ContentModule, ContentStore } from './store'

export type ContentState =
  { status: 'loading' } | { status: 'ready'; module: ContentModule } | { status: 'error' }
export function useContent(store: ContentStore, id: string) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ id: string; attempt: number; value: ContentState }>({
    id,
    attempt,
    value: { status: 'loading' },
  })
  useEffect(() => {
    let active = true
    store.load(id).then(
      (module) => {
        if (active) setState({ id, attempt, value: { status: 'ready', module } })
      },
      () => {
        if (active) setState({ id, attempt, value: { status: 'error' } })
      },
    )
    return () => {
      active = false
    }
  }, [store, id, attempt])
  const value: ContentState =
    state.id === id && state.attempt === attempt ? state.value : { status: 'loading' }
  return { ...value, retry: () => setAttempt((value) => value + 1) }
}
