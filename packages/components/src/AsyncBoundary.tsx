import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { AsyncFailure, AsyncPending, type FeedbackProps } from './AsyncBoundaryFeedback'

interface BoundaryOptions extends FeedbackProps {
  /** Change when the content identity changes. Loader identity alone does not reload. */
  resetKey?: string | number
  onRetry?: () => void
}

export type AsyncBoundaryProps<T = void> = BoundaryOptions &
  (
    | {
        loader: (signal: AbortSignal) => Promise<T>
        children: ReactNode | ((data: T) => ReactNode)
        loading?: never
        error?: never
      }
    | {
        loader?: never
        children?: ReactNode
        loading?: boolean
        error?: unknown
      }
  )

interface RenderBoundaryProps {
  children: ReactNode
  resetToken: object
  feedback: FeedbackProps
  retry: () => void
}
interface RenderBoundaryState {
  resetToken: object
  failed: boolean
  error?: unknown
  componentStack?: string
}

class RenderBoundary extends Component<RenderBoundaryProps, RenderBoundaryState> {
  override state: RenderBoundaryState = { resetToken: this.props.resetToken, failed: false }

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error }
  }

  static getDerivedStateFromProps(props: RenderBoundaryProps, state: RenderBoundaryState) {
    return props.resetToken !== state.resetToken
      ? { resetToken: props.resetToken, failed: false, error: undefined, componentStack: undefined }
      : null
  }

  override componentDidCatch(_error: unknown, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? undefined })
  }

  override render() {
    return this.state.failed ? (
      <AsyncFailure
        {...this.props.feedback}
        kind="render"
        error={this.state.error}
        componentStack={this.state.componentStack}
        onRetry={this.props.retry}
      />
    ) : (
      this.props.children
    )
  }
}

type LoadState<T> = { token: object } & (
  { status: 'pending' } | { status: 'ready'; data: T } | { status: 'failed'; error: unknown }
)

function ManagedContent<T>({
  loader,
  children,
  token,
  feedback,
  retry,
}: {
  loader: (signal: AbortSignal) => Promise<T>
  children: ReactNode | ((data: T) => ReactNode)
  token: object
  feedback: FeedbackProps
  retry: () => void
}) {
  const currentLoader = useRef(loader)
  useLayoutEffect(() => {
    currentLoader.current = loader
  }, [loader])
  const [state, setState] = useState<LoadState<T>>({ token, status: 'pending' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ token, status: 'pending' })
    async function load() {
      try {
        const data = await currentLoader.current(controller.signal)
        if (active) setState({ token, status: 'ready', data })
      } catch (error) {
        if (active) setState({ token, status: 'failed', error })
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
    }
  }, [token])

  if (state.token !== token || state.status === 'pending') return <AsyncPending {...feedback} />
  if (state.status === 'failed') {
    return <AsyncFailure {...feedback} kind="load" error={state.error} onRetry={retry} />
  }
  // This call executes below RenderBoundary, so render-function errors are captured too.
  return typeof children === 'function' ? children(state.data) : children
}

/** Owns loading feedback and descendant render recovery for pages or large content regions. */
export function AsyncBoundary<T = void>(props: AsyncBoundaryProps<T>) {
  const { resetKey, onRetry, children, loader, loading, error, ...feedback } = props
  const [attempt, setAttempt] = useState(0)
  const resetToken = useMemo(() => ({}), [resetKey, attempt, loading, error])
  const retry = () => {
    onRetry?.()
    setAttempt((value) => value + 1)
  }

  return (
    <RenderBoundary resetToken={resetToken} feedback={feedback} retry={retry}>
      <Suspense fallback={<AsyncPending {...feedback} />}>
        {loader ? (
          <ManagedContent loader={loader} token={resetToken} feedback={feedback} retry={retry}>
            {children}
          </ManagedContent>
        ) : loading ? (
          <AsyncPending {...feedback} />
        ) : error != null ? (
          <AsyncFailure {...feedback} kind="load" error={error} onRetry={retry} />
        ) : (
          (children as ReactNode)
        )}
      </Suspense>
    </RenderBoundary>
  )
}
