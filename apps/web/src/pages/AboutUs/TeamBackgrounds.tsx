import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import type { TeamTheme } from '../../config/team'

const DotGrid = lazy(() =>
  import('./TeamShaderComponents').then((module) => ({
    default: module.DotGrid,
  })),
)
const MeshGradient = lazy(() =>
  import('./TeamShaderComponents').then((module) => ({
    default: module.MeshGradient,
  })),
)
export function useTeamReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}
class ShaderBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch() {
    this.props.onFailure()
  }
  override render() {
    return this.state.failed ? null : this.props.children
  }
}
function canRenderShaders() {
  try {
    const probe = document.createElement('canvas').getContext('webgl2')
    if (!probe) return false
    probe.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
function Background({ kind, theme }: { kind: 'dot' | 'mesh'; theme: TeamTheme }) {
  const [phase, setPhase] = useState<'checking' | 'initializing' | 'ready' | 'fallback'>('checking')
  const root = useRef<HTMLDivElement>(null)
  const shader = useRef<HTMLElement | null>(null)
  const source = useRef<HTMLDivElement>(null)
  const reduced = useTeamReducedMotion()
  useEffect(() => {
    setPhase(canRenderShaders() ? 'initializing' : 'fallback')
  }, [])
  useEffect(() => {
    const container = root.current
    if (kind !== 'mesh' || !container || !source.current) return
    const scale = () => {
      const box = container.getBoundingClientRect()
      if (source.current)
        source.current.style.transform = `scale(${box.width / 240}, ${box.height / 264})`
    }
    scale()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(scale)
    observer.observe(container, { box: 'border-box' })
    return () => observer.disconnect()
  }, [kind])
  useEffect(() => {
    if (phase !== 'initializing' && phase !== 'ready') return
    const container = root.current!
    let canvas: HTMLCanvasElement | null = null
    const fail = () => setPhase('fallback')
    const check = () => {
      const next = container.querySelector('canvas')
      if (next !== canvas) {
        canvas?.removeEventListener('webglcontextlost', fail)
        canvas = next
        canvas?.addEventListener('webglcontextlost', fail)
      }
      if (
        shader.current?.hasAttribute('data-paper-shader') &&
        'paperShaderMount' in shader.current &&
        shader.current.paperShaderMount &&
        canvas
      )
        setPhase('ready')
    }
    const observer = new MutationObserver(check)
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-paper-shader'],
    })
    check()
    const timeout = phase === 'initializing' ? window.setTimeout(fail, 3000) : undefined
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
      canvas?.removeEventListener('webglcontextlost', fail)
    }
  }, [phase])
  const active = phase === 'initializing' || phase === 'ready'
  return (
    <div
      ref={root}
      data-team-background={kind}
      data-state={phase === 'ready' ? 'ready' : 'fallback'}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background:
          kind === 'mesh'
            ? `linear-gradient(145deg, #fff, ${theme.accent} 40%, ${theme.colorBack})`
            : theme.colorBack,
      }}
    >
      <div
        ref={source}
        style={
          kind === 'mesh'
            ? {
                width: 240,
                height: 264,
                transformOrigin: 'top left',
                opacity: phase === 'ready' ? 1 : 0,
              }
            : {
                width: '100%',
                height: '100%',
                opacity: phase === 'ready' ? 1 : 0,
              }
        }
      >
        {active && (
          <ShaderBoundary onFailure={() => setPhase('fallback')}>
            <Suspense fallback={null}>
              {kind === 'dot' && theme ? (
                <DotGrid
                  ref={(node) => {
                    shader.current = node
                  }}
                  width="100%"
                  height="100%"
                  colorBack={theme.colorBack}
                  colorFill={theme.colorFill}
                  colorStroke={theme.colorStroke}
                  size={2}
                  gapX={32}
                  gapY={32}
                  strokeWidth={0}
                  sizeRange={1}
                  opacityRange={1}
                  shape="circle"
                />
              ) : (
                <MeshGradient
                  ref={(node) => {
                    shader.current = node
                  }}
                  width={240}
                  height={264}
                  colors={['#ffffff', theme.colorBack]}
                  distortion={1}
                  swirl={0.2}
                  grainMixer={0}
                  grainOverlay={0}
                  rotation={90}
                  speed={0.5}
                  minPixelRatio={1}
                  maxPixelCount={64_000}
                />
              )}
            </Suspense>
          </ShaderBoundary>
        )}
      </div>
    </div>
  )
}
export function TeamDotBackground({ theme }: { theme: TeamTheme }) {
  return <Background kind="dot" theme={theme} />
}
export function TeamMeshBackground({ theme }: { theme: TeamTheme }) {
  return <Background kind="mesh" theme={theme} />
}
