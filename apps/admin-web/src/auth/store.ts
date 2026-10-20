import { create } from 'zustand'
import http from '@admin/src/api'
import type { Payload } from '@admin/src/api/types'
import { clearSession, loadSession, saveSession, type CurrentUser } from './storage'
export type { CurrentUser } from './storage'
export interface MyServer {
  id: number
  name: string
  slug: string
  logo: string | null
  my_role: string
}
interface AuthState {
  token: string | null
  user: CurrentUser | null
  servers: MyServer[]
  serversLoaded: boolean
  setAuth: (token: string, user: CurrentUser) => void
  logout: () => void
  loadServers: () => Promise<void>
}
export function createAuthStore(
  load = () => http.get<Payload<'/api/server/mine'>>('/server/mine'),
) {
  let generation = 0
  return create<AuthState>((set, get) => ({
    ...loadSession(),
    servers: [],
    serversLoaded: false,
    setAuth: (token, user) => {
      saveSession(token, user)
      generation++
      set({ token, user, servers: [], serversLoaded: false })
    },
    logout: () => {
      generation++
      clearSession()
      set({ token: null, user: null, servers: [], serversLoaded: false })
    },
    loadServers: async () => {
      const owner = generation
      if (!get().token) return
      try {
        const data = await load()
        if (owner !== generation) return
        const servers: MyServer[] = []
        for (const server of data.list ?? []) {
          if (
            typeof server.id === 'number' &&
            typeof server.name === 'string' &&
            typeof server.slug === 'string' &&
            typeof server.my_role === 'string'
          )
            servers.push({
              id: server.id,
              name: server.name,
              slug: server.slug,
              my_role: server.my_role,
              logo: server.logo ?? null,
            })
        }
        set({ servers, serversLoaded: true })
      } catch {
        if (owner === generation) set({ serversLoaded: true })
      }
    },
  }))
}
export const useAuth = createAuthStore()
