// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { TeamDotBackground, TeamMeshBackground } from './TeamBackgrounds'

vi.mock('./TeamShaderComponents', () => ({
  // Model the library's asynchronous initialization: canvas is mounted before
  // readiness, but initialization never sets the public ready marker.
  DotGrid: () => (
    <div>
      <canvas />
    </div>
  ),
  MeshGradient: () => (
    <div>
      <canvas />
    </div>
  ),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
it.each(['dot', 'mesh'])(
  'withdraws an asynchronously failed %s background while retaining its fallback',
  async (kind) => {
    vi.useFakeTimers()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getExtension: () => null,
    } as never)
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const theme = {
      colorBack: '#0868de',
      accent: '#065ed1',
      colorFill: '#ffffff7d',
      colorStroke: '#ffffff',
    }
    const view = render(
      kind === 'dot' ? <TeamDotBackground theme={theme} /> : <TeamMeshBackground theme={theme} />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(3100)
    })
    expect(view.container.querySelector('canvas')).toBeNull()
    expect(view.container.querySelector('[data-team-background]')?.getAttribute('data-state')).toBe(
      'fallback',
    )
  },
)
