// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { resolveToolbarColor, useToolbarColors } from './colors'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.className = ''
})

function canvasBoundary(rgba: number[]) {
  const context = {
    fillStyle: '',
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    getImageData: () => ({ data: Uint8ClampedArray.from(rgba) }),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  )
  return context
}

it('converts browser CSS color resolution to normalized sRGB hex without entering content', () => {
  const host = document.createElement('div'),
    editor = document.createElement('div')
  editor.contentEditable = 'true'
  host.append(editor)
  document.body.append(host)
  const context = canvasBoundary([26, 128, 255, 255])
  expect(resolveToolbarColor(host, 'rgb(26, 128, 255)')).toBe('#1a80ff')
  expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1, 1)
  expect(host.children).toHaveLength(1)
  expect(editor.children).toHaveLength(0)
  host.remove()
})

it('retains transparency and refuses unavailable tokens or canvas failures', () => {
  const host = document.createElement('div')
  document.body.append(host)
  canvasBoundary([10, 20, 30, 128])
  expect(resolveToolbarColor(host, 'rgba(10,20,30,0.5)')).toBe('#0a141e80')
  expect(resolveToolbarColor(host, 'var(--missing-token)')).toBeNull()
  host.style.setProperty('--invalid-token', 'invalid-color')
  expect(resolveToolbarColor(host, 'var(--invalid-token)')).toBeNull()
  expect(resolveToolbarColor(host, 'invalid-color')).toBeNull()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  expect(resolveToolbarColor(host, '#123456')).toBeNull()
  expect(host.children).toHaveLength(0)
  host.remove()
})

it('caches across ordinary rerenders and refreshes when an ancestor theme changes', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  host.style.setProperty('--exui-text-primary', '#112233')
  // jsdom does not resolve inherited CSS custom properties on color. Only
  // this browser color boundary is substituted; hook lifecycle remains real.
  const getStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = getStyle(element)
    return element.tagName === 'SPAN'
      ? (Object.assign(Object.create(style), { color: 'rgb(17, 34, 51)' }) as CSSStyleDeclaration)
      : style
  })
  const context = canvasBoundary([17, 34, 51, 255]),
    hostRef = { current: host }
  const { result, rerender, unmount } = renderHook(() => useToolbarColors(hostRef))
  expect(result.current.default).toBe('#112233')
  const count = context.fillRect.mock.calls.length
  rerender()
  expect(context.fillRect.mock.calls.length).toBe(count)
  await act(async () => {
    document.documentElement.className = 'dark'
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  expect(context.fillRect.mock.calls.length).toBeGreaterThan(count)
  unmount()
  host.remove()
})

it('removes theme listeners and queued refresh work when unmounted', () => {
  const host = document.createElement('div')
  document.body.append(host)
  const media = new EventTarget()
  vi.stubGlobal('matchMedia', () => media as MediaQueryList)
  const frames = new Map<number, FrameRequestCallback>()
  let next = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++next, callback)
    return next
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  const { unmount } = renderHook(() => useToolbarColors({ current: host }))
  act(() => media.dispatchEvent(new Event('change')))
  expect(frames.size).toBe(1)
  unmount()
  expect(frames.size).toBe(0)
  media.dispatchEvent(new Event('change'))
  expect(frames.size).toBe(0)
  host.remove()
})
