import { useEffect } from 'react'
import { useOfficialIntegration } from '../integration'

/** Scope upstream optional shortcuts to this editor, excluding forms and other editors. */
export function useHotkeys(
  keys: string,
  callback: (event: KeyboardEvent) => void,
  options: { enabled: boolean; enableOnContentEditable?: boolean; enableOnFormTags?: boolean },
) {
  const { editor } = useOfficialIntegration()
  useEffect(() => {
    if (!options.enabled || editor.isDestroyed) return
    const key = keys.split('+').at(-1)
    const handler = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !editor.isEditable ||
        editor.isDestroyed ||
        !editor.view.dom.contains(event.target as Node)
      )
        return
      if (
        event.key.toLowerCase() === key &&
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey === keys.includes('shift') &&
        !event.altKey
      )
        callback(event)
    }
    const dom = editor.view.dom
    dom.addEventListener('keydown', handler)
    return () => dom.removeEventListener('keydown', handler)
  }, [editor, keys, callback, options.enabled])
}
