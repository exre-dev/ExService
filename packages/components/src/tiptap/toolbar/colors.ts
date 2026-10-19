import { useEffect, useState, type RefObject } from 'react'
import { normalizeColor } from '../conversion/policy'

export const TOOLBAR_COLOR_PRESETS = [
  { id: 'default', label: '默认文字', token: '--exui-text-primary' },
  { id: 'link', label: '链接', token: '--exui-text-link' },
  { id: 'success', label: '成功', token: '--exui-feedback-success' },
  { id: 'warning', label: '警告', token: '--exui-feedback-warning' },
  { id: 'danger', label: '危险', token: '--exui-feedback-danger' },
] as const
export type ToolbarColorId = (typeof TOOLBAR_COLOR_PRESETS)[number]['id']
export type ToolbarColors = Record<ToolbarColorId, string | null>
export type ToolbarColorPalette = ToolbarColors
const emptyColors = (): ToolbarColors => ({
  default: null,
  link: null,
  success: null,
  warning: null,
  danger: null,
})

export function resolveToolbarColor(host: HTMLElement, cssColor: string): string | null {
  const doc = host.ownerDocument,
    view = doc.defaultView
  if (!view || !host.isConnected || host.closest('[contenteditable="true"]')) return null
  const probe = doc.createElement('span'),
    sample = doc.createElement('span')
  try {
    const variable = cssColor.match(/^var\(\s*(--[\w-]+)\s*\)$/)
    if (variable && !view.getComputedStyle(host).getPropertyValue(variable[1]!).trim()) return null
    sample.style.color = cssColor
    if (!sample.style.color) return null
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.setAttribute('aria-hidden', 'true')
    probe.style.color = '#010203'
    probe.append(sample)
    host.append(probe)
    const color = view.getComputedStyle(sample).color
    if (!color || color.includes('var(')) return null
    // Invalid-at-computed-value CSS variables inherit color. A second inherited
    // color reveals that failure instead of silently saving the host's text color.
    probe.style.color = '#040506'
    if (view.getComputedStyle(sample).color !== color) return null
    const canvas = doc.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })
    if (!context) return null
    // Invalid CSS assignments preserve fillStyle. Two sentinels distinguish an
    // invalid assignment from a valid color that happens to match one sentinel.
    context.fillStyle = '#010203'
    context.fillStyle = color
    const first = context.fillStyle
    context.fillStyle = '#040506'
    context.fillStyle = color
    if (context.fillStyle !== first) return null
    context.clearRect(0, 0, 1, 1)
    context.fillRect(0, 0, 1, 1)
    const rgba = context.getImageData(0, 0, 1, 1).data
    const hex =
      '#' +
      Array.from(rgba.slice(0, rgba[3] === 255 ? 3 : 4))
        .map((channel) => channel.toString(16).padStart(2, '0'))
        .join('')
    return normalizeColor(hex)
  } catch {
    return null
  } finally {
    probe.remove()
  }
}

export function useToolbarColors(hostRef: RefObject<HTMLElement | null>): ToolbarColors {
  const [colors, setColors] = useState<ToolbarColors>(emptyColors)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const view = host.ownerDocument.defaultView!
    let active = true,
      frame: number | null = null
    const refresh = () => {
      frame = null
      if (!active) return
      const next = Object.fromEntries(
        TOOLBAR_COLOR_PRESETS.map((preset) => [
          preset.id,
          resolveToolbarColor(host, `var(${preset.token})`),
        ]),
      ) as ToolbarColors
      setColors((previous) =>
        TOOLBAR_COLOR_PRESETS.every((preset) => previous[preset.id] === next[preset.id])
          ? previous
          : next,
      )
    }
    const schedule = () => {
      if (active && frame === null) frame = view.requestAnimationFrame(refresh)
    }
    const mutations = new MutationObserver(schedule)
    for (let ancestor: HTMLElement | null = host; ancestor; ancestor = ancestor.parentElement)
      mutations.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style'] })
    const media = view.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener('change', schedule)
    refresh()
    return () => {
      active = false
      mutations.disconnect()
      media?.removeEventListener('change', schedule)
      if (frame !== null) view.cancelAnimationFrame(frame)
    }
  }, [hostRef])
  return colors
}
