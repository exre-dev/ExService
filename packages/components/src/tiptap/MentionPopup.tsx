import { useRef } from 'react'
import { Button, Popover, PopoverAnchor, PopoverContent } from '@exre/exui'
import { exitSuggestion, type SuggestionProps } from '@tiptap/suggestion'
import type { TiptapLifecycle } from './lifecycle'
import type { TiptapMentionItem } from './types'
import styles from './MentionPopup.module.scss'

export function MentionPopup({
  suggestion,
  index,
  runtime,
}: {
  suggestion: SuggestionProps<TiptapMentionItem>
  index: number
  runtime: TiptapLifecycle
}) {
  const editor = suggestion.editor
  const virtualRef = useRef({ getBoundingClientRect: () => new DOMRect() })
  virtualRef.current = {
    getBoundingClientRect: () => {
      if (editor.isDestroyed) return new DOMRect()
      try {
        return suggestion.clientRect?.() ?? editor.view.dom.getBoundingClientRect()
      } catch {
        return editor.view.dom.getBoundingClientRect()
      }
    },
  }
  const close = () => {
    runtime.cancelMention()
    if (!editor.isDestroyed) exitSuggestion(editor.view)
  }
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        glass
        role="listbox"
        aria-label="提及候选"
        className={styles.popup}
        align="start"
        sideOffset={4}
        collisionPadding={8}
        updatePositionStrategy="always"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          if (
            !runtime.composing &&
            !editor.view.composing &&
            !event.isComposing &&
            event.keyCode !== 229
          )
            close()
        }}
      >
        {suggestion.loading ? (
          <p role="status">正在查询…</p>
        ) : suggestion.items.length ? (
          suggestion.items.map((item, itemIndex) => (
            <Button
              key={item.id}
              type="button"
              role="option"
              aria-selected={itemIndex === index}
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => suggestion.command(item)}
            >
              {item.label}
            </Button>
          ))
        ) : (
          <p role="status">{runtime.mentionFailed ? '查询失败，请重试。' : '没有匹配的候选。'}</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
