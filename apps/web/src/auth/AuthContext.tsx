import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthDisplayState, AuthMode } from '@workspace/components'
import { instance, ExAxiosError } from '@workspace/sdk'
import {
  clearBrowserSession,
  readToken,
  removeMatchingToken,
  sessionScopeRevision,
  startSessionSync,
  subscribeSessionChanges,
  serviceResourceUrl,
} from '@web/src/auth/storage'
import { bindSettingsToken } from '@web/src/settings/settingsConfig'

interface AuthContextValue {
  state: AuthDisplayState
  userId: number | null
  modalMode: AuthMode | null
  openModal: (mode: AuthMode) => void
  closeModal: () => void
  retrySession: () => void
  refreshProfile: () => Promise<void>
  invalidateSession: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthDisplayState>({ status: 'loading' })
  const [userId, setUserId] = useState<number | null>(null)
  const [modalMode, setModalMode] = useState<AuthMode | null>(null)
  const generation = useRef(0)
  const scope = sessionScopeRevision()

  const invalidateSession = useCallback(
    (token: string) => {
      if (scope !== sessionScopeRevision()) return
      try {
        if (readToken(window.localStorage) !== token) return
        removeMatchingToken(window.localStorage, token)
        generation.current += 1
        setUserId(null)
        setState({ status: 'anonymous' })
      } catch {
        setState({ status: 'unavailable', message: '浏览器无法读取登录信息' })
      }
    },
    [scope],
  )

  const restoreSession = useCallback(async (showLoading = true) => {
    const requestScope = sessionScopeRevision()
    const currentGeneration = ++generation.current
    if (showLoading) setState({ status: 'loading' })
    let token: string | null
    try {
      token = readToken(window.localStorage)
    } catch {
      setUserId(null)
      setState({ status: 'unavailable', message: '浏览器无法读取登录信息' })
      return
    }
    if (token === null) {
      setUserId(null)
      setState({ status: 'anonymous' })
      return
    }
    try {
      const { data } = await instance({ url: '/api/auth/me', method: 'GET', alert: false })
      if (currentGeneration !== generation.current || requestScope !== sessionScopeRevision()) {
        return
      }
      if (readToken(window.localStorage) !== token) return
      setUserId(data.id)
      setState({
        status: 'authenticated',
        nickname: data.username,
        initial: firstVisibleCharacter(data.username),
        avatarUrl: serviceResourceUrl(data.avatar),
      })
      return
    } catch (error) {
      if (currentGeneration === generation.current && requestScope === sessionScopeRevision()) {
        const latestToken = readToken(window.localStorage)
        if (latestToken !== null && latestToken !== token) return
        setUserId(null)
        if (error instanceof ExAxiosError && error.status === 401) setState({ status: 'anonymous' })
        else setState({ status: 'unavailable', message: '暂时无法连接认证服务' })
      }
    }
  }, [])

  useEffect(() => {
    void restoreSession()
    const stopSync = startSessionSync()
    const unsubscribe = subscribeSessionChanges(() => void restoreSession())
    return () => {
      generation.current += 1
      unsubscribe()
      stopSync()
    }
  }, [restoreSession])

  const logout = useCallback(() => {
    if (scope !== sessionScopeRevision()) return
    let token: string | null = null
    try {
      token = readToken(window.localStorage)
    } catch {
      /* unavailable storage must not block local logout */
    }
    clearBrowserSession()
    bindSettingsToken(null)
    generation.current += 1
    setUserId(null)
    setModalMode(null)
    setState({ status: 'anonymous' })
    if (token === null) return
    // Keep the captured credential for revocation after clearing the shared HTTP token.
    // Avoid reloading here: it can abort revocation before the server receives it.
    void instance({
      url: '/api/auth/logout',
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      alert: false,
    }).catch(() => {
      /* remote failure cannot undo explicit browser logout */
    })
  }, [scope])

  return (
    <AuthContext.Provider
      value={{
        state,
        userId,
        modalMode,
        openModal: setModalMode,
        closeModal: () => setModalMode(null),
        retrySession: () => void restoreSession(),
        refreshProfile: () => restoreSession(false),
        invalidateSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

function firstVisibleCharacter(value: string): string {
  return Array.from(value.trim())[0] ?? '?'
}
