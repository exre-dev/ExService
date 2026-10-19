import { describe, expect, it } from 'vitest'
import { createContentStore } from './store'

describe('content module store', () => {
  it('shares an in-flight import and caches successful modules', async () => {
    const module = { default: () => null }
    let calls = 0
    const store = createContentStore({
      page: async () => {
        calls++
        return module
      },
    })
    const first = store.load('page')
    expect(store.load('page')).toBe(first)
    await expect(first).resolves.toBe(module)
    await expect(store.load('page')).resolves.toBe(module)
    expect(calls).toBe(1)
  })
  it('evicts failed imports to allow retry', async () => {
    const module = { default: () => null }
    let calls = 0
    const store = createContentStore({
      page: async () => {
        if (++calls === 1) throw new Error('offline')
        return module
      },
    })
    await expect(store.load('page')).rejects.toThrow('offline')
    await expect(store.load('page')).resolves.toBe(module)
    expect(calls).toBe(2)
  })
  it('does not resolve inherited object keys as a document', async () => {
    const store = createContentStore({ page: async () => ({ default: () => null }) })
    await expect(store.load('constructor')).rejects.toThrow(/Unknown/)
  })
})
