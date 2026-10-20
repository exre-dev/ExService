import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router'
import { toast } from '@exre/exui'
import { readToken, sessionScopeRevision, subscribeSessionChanges } from '../../../auth/storage'
import type { FeedbackArea } from './flow'
import { useAuth } from '../../../auth/AuthContext'

const FeedbackModal = lazy(() =>
  import('./FeedbackModal').then((module) => ({ default: module.FeedbackModal })),
)
const FeedbackContext = createContext<{
  openFeedback: (area: FeedbackArea, trigger?: HTMLElement) => void
  claimSubmission: () => (() => void) | null
} | null>(null)

function currentToken(): string | null {
  try {
    return readToken(window.localStorage)
  } catch {
    return null
  }
}

/** Keep opened feedback forms alive across route changes, including their in-flight commands. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { userId, state } = useAuth()
  const authScope = sessionScopeRevision()
  const authToken = currentToken()
  const [areas, setAreas] = useState<FeedbackArea[]>([])
  const [openArea, setOpenArea] = useState<FeedbackArea | null>(null)
  const running = useRef<symbol | null>(null)
  const sessionToken = useRef(currentToken())
  const sessionScope = useRef(sessionScopeRevision())
  const triggers = useRef<Partial<Record<FeedbackArea, HTMLElement>>>({})
  const location = useLocation()

  useEffect(() => {
    setOpenArea(null)
  }, [location.key])
  useEffect(
    () =>
      subscribeSessionChanges(() => {
        const nextToken = currentToken()
        const nextScope = sessionScopeRevision()
        if (nextToken === sessionToken.current && nextScope === sessionScope.current) return
        sessionToken.current = nextToken
        sessionScope.current = nextScope
        running.current = null
        setOpenArea(null)
        setAreas([])
        triggers.current = {}
      }),
    [],
  )

  const openFeedback = useCallback(
    (area: FeedbackArea, trigger?: HTMLElement) => {
      if (
        userId === null ||
        state.status !== 'authenticated' ||
        authScope !== sessionScopeRevision() ||
        authToken !== currentToken()
      )
        return
      if (running.current) {
        toast.info('正在上传中，请稍候')
        return
      }
      if (trigger) triggers.current[area] = trigger
      setAreas((current) => (current.includes(area) ? current : [...current, area]))
      setOpenArea(area)
    },
    [userId, state.status, authScope, authToken],
  )
  const claimSubmission = useCallback(() => {
    if (running.current) return null
    const command = Symbol()
    running.current = command
    return () => {
      if (running.current === command) running.current = null
    }
  }, [])

  return (
    <FeedbackContext value={{ openFeedback, claimSubmission }}>
      {children}
      <Suspense fallback={null}>
        {areas.map((area) => (
          <FeedbackModal
            key={`${sessionScope.current}:${area}`}
            area={area}
            open={openArea === area}
            onOpenChange={(next) =>
              setOpenArea((current) => (next ? area : current === area ? null : current))
            }
            returnFocus={triggers.current[area]}
          />
        ))}
      </Suspense>
    </FeedbackContext>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (!context) throw new Error('FeedbackProvider is required')
  return context
}
