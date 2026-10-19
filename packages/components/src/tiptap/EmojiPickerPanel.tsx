import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  EmojiPicker,
  EmojiPickerPanel as ExEmojiPickerPanel,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@exre/exui'
import { closeEmojiPicker, currentEmojiAnchor, insertPickedEmoji } from './emoji-trigger'
import { emojiI18n, localEmojiData } from './emoji-data'
import styles from './EmojiPickerPanel.module.scss'

export default function EmojiPickerPanel({
  editor,
  anchor,
  session,
}: {
  editor: Editor
  anchor: { from: number; to: number; session?: object }
  session?: object
}) {
  const expectedSession = session ?? anchor.session
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const virtualRef = useRef({ getBoundingClientRect: () => new DOMRect() })
  virtualRef.current = {
    getBoundingClientRect: () => {
      if (editor.isDestroyed) return new DOMRect()
      try {
        const rect = editor.view.coordsAtPos(anchor.to)
        return new DOMRect(rect.left, rect.top, 0, rect.bottom - rect.top)
      } catch {
        return editor.view.dom.getBoundingClientRect()
      }
    },
  }

  useEffect(() => {
    if (!panel) return
    let focused = false
    const focusReadyList = () => {
      if (
        focused ||
        currentEmojiAnchor(editor)?.session !== expectedSession ||
        document.activeElement !== editor.view.dom
      )
        return
      const list = panel.querySelector<HTMLElement>(
        '[role="listbox"][tabindex="0"]:not([aria-busy="true"])',
      )
      if (list) {
        focused = true
        list.focus({ preventScroll: true })
        observer.disconnect()
      }
    }
    const observer = new MutationObserver(focusReadyList)
    observer.observe(panel, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['tabindex', 'aria-busy'],
    })
    focusReadyList()
    return () => observer.disconnect()
  }, [editor, expectedSession, panel])

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) closeEmojiPicker(editor, expectedSession)
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        glass
        ref={setPanel}
        aria-label="选择 Emoji"
        data-tiptap-emoji-picker=""
        className={styles.panel}
        align="start"
        side="top"
        sideOffset={4}
        collisionPadding={8}
        updatePositionStrategy="always"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (event.isComposing || event.keyCode === 229) {
            event.preventDefault()
            return
          }
          event.preventDefault()
          if (closeEmojiPicker(editor, expectedSession) && !editor.isDestroyed && editor.isEditable)
            editor.view.focus()
        }}
      >
        <EmojiPicker
          value={null}
          hideSearch
          skinTone={0}
          skinToneStorageKey={null}
          recentMode="recent"
          recentStorageKey="exwebsite.emoji.recent.v1"
          locale="zh"
          data={localEmojiData}
          i18n={emojiI18n}
          onEmojiSelect={(selection) => {
            insertPickedEmoji(editor, selection.value, expectedSession)
          }}
        >
          <ExEmojiPickerPanel className={styles.picker} />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  )
}
