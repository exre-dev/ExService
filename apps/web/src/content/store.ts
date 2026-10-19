import type { ComponentType } from 'react'
import type { MDXComponents } from 'mdx/types'

export interface ContentModule {
  default: ComponentType<{ components?: MDXComponents }>
}
export type ContentLoader = () => Promise<ContentModule>
export interface ContentStore {
  load(id: string): Promise<ContentModule>
  clear(): void
}

export function createContentStore(loaders: Record<string, ContentLoader>): ContentStore {
  const pending = new Map<string, Promise<ContentModule>>()
  return {
    load(id) {
      if (!Object.hasOwn(loaders, id)) return Promise.reject(new Error(`Unknown content: ${id}`))
      const existing = pending.get(id)
      if (existing) return existing
      const request = Promise.resolve()
        .then(() => loaders[id]!())
        .catch((error) => {
          if (pending.get(id) === request) pending.delete(id)
          throw error
        })
      pending.set(id, request)
      return request
    },
    clear() {
      pending.clear()
    },
  }
}
