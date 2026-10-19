import { useEffect, type RefObject } from 'react'
import { useLocation } from 'react-router'

function hashTarget(root: HTMLElement, hash: string): HTMLElement | null {
  if (!hash) return null
  let id: string
  try {
    id = decodeURIComponent(hash.slice(1))
  } catch {
    return null
  }
  const target = document.getElementById(id)
  return target && root.contains(target) ? target : null
}
function focusTarget(target: HTMLElement) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'start' })
}

export function useSupportFocus(root: RefObject<HTMLElement | null>, ready = true) {
  const { key, hash } = useLocation()
  useEffect(() => {
    if (!root.current) return
    const target = hashTarget(root.current, hash)
    if (target) focusTarget(target)
    else {
      const heading = root.current.querySelector<HTMLHeadingElement>('h1')
      if (heading) focusTarget(heading)
    }
  }, [root, key, hash])
  useEffect(() => {
    if (!ready || !root.current) return
    const target = hashTarget(root.current, hash)
    if (target) focusTarget(target)
  }, [root, ready, hash, key])
}
