import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

// Survives leaving the lazy About route and returning through browser history.
const readingPositions = new Map<string, number>()

export function useReadingPosition(
  ready: boolean,
  title: string,
  description: string,
  entryFocus = 'h1',
  options: { focusHashTarget?: boolean } = {},
) {
  const focusHashTarget = options.focusHashTarget ?? false
  const location = useLocation()
  const navigation = useNavigationType()
  const restored = useRef<{ key: string; hash: string } | undefined>(undefined)
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = previous
    }
  }, [])
  useEffect(() => {
    const previousTitle = document.title
    const original = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousDescription = original?.content
    const meta = original ?? document.createElement('meta')
    if (!original) {
      meta.name = 'description'
      document.head.append(meta)
    }
    document.title = `${title} · Exre`
    meta.content = description
    return () => {
      document.title = previousTitle
      if (original) meta.content = previousDescription ?? ''
      else meta.remove()
    }
  }, [title, description])
  useLayoutEffect(() => {
    const key = location.key
    const save = () => {
      if (restored.current?.key !== key) return
      readingPositions.set(key, window.scrollY)
      if (readingPositions.size > 100)
        readingPositions.delete(readingPositions.keys().next().value!)
    }
    window.addEventListener('scroll', save, { passive: true })
    // Route DOM mutations can clamp scrollY before layout-effect cleanup runs.
    // Keep the position captured by the last scroll event instead of overwriting it.
    return () => {
      window.removeEventListener('scroll', save)
    }
  }, [location.key])
  useLayoutEffect(() => {
    if (restored.current?.key !== location.key) restored.current = undefined
    if (
      !ready ||
      !main.current ||
      (restored.current?.key === location.key && restored.current.hash === location.hash)
    )
      return
    let hash: string
    try {
      hash = decodeURIComponent(location.hash.slice(1))
    } catch {
      hash = ''
    }
    const targetY = navigation === 'POP' && !hash ? (readingPositions.get(location.key) ?? 0) : 0
    const restore = () => {
      const anchor = hash ? document.getElementById(hash) : null
      if (hash && !anchor) return false
      if (!anchor && document.documentElement.scrollHeight - window.innerHeight < targetY)
        return false
      if (anchor && focusHashTarget) anchor.focus({ preventScroll: true })
      else if (navigation !== 'POP')
        main.current?.querySelector<HTMLElement>(entryFocus)?.focus({ preventScroll: true })
      if (anchor) anchor.scrollIntoView({ block: 'start', behavior: 'instant' })
      else window.scrollTo({ top: targetY, behavior: 'instant' })
      restored.current = { key: location.key, hash: location.hash }
      return true
    }
    if (restore()) return
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (restore()) observer.disconnect()
    })
    observer.observe(main.current)
    return () => observer.disconnect()
  }, [ready, location.key, location.hash, navigation, entryFocus, focusHashTarget])
  return main
}
