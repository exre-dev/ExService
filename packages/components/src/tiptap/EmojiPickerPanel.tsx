import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Popover, PopoverAnchor, PopoverContent } from '@exre/exui'
import EmojiPicker, {
  EmojiStyle,
  Theme,
  SuggestionMode,
  SkinTonePickerLocation,
} from 'emoji-picker-react'
import emojiData from 'emoji-picker-react/data/emojis-zh'
import { closeEmojiPicker, insertPickedEmoji } from './emoji-trigger'
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
  const [dark, setDark] = useState(() => !!editor.view.dom.closest('.dark'))
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
    const theme = new MutationObserver(() => setDark(!!editor.view.dom.closest('.dark')))
    theme.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
    })
    return () => theme.disconnect()
  }, [editor])
  useEffect(() => {
    // With no search field, focus the first rendered emoji without scrolling
    // the page away from the caret. The real grid may appear after measurement.
    let focused = false
    const focus = () => {
      const cell = panel?.querySelector<HTMLButtonElement>('[role="gridcell"]')
      if (!focused && cell) {
        focused = true
        cell.focus({ preventScroll: true })
        observer.disconnect()
      }
    }
    const observer = new MutationObserver(focus)
    if (panel) observer.observe(panel, { childList: true, subtree: true })
    focus()
    return () => observer.disconnect()
  }, [panel])

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
          emojiData={emojiData}
          emojiStyle={EmojiStyle.NATIVE}
          colorScheme={dark ? Theme.DARK : Theme.LIGHT}
          width="100%"
          height="min(420px, calc(var(--radix-popover-content-available-height, 428px) - .5rem))"
          suggestedEmojisMode={SuggestionMode.RECENT}
          skinTonePickerLocation={SkinTonePickerLocation.NONE}
          searchDisabled
          autoFocusSearch={false}
          previewConfig={{ showPreview: false }}
          labels={{
            loading: '正在加载表情…',
            loadingError: '表情加载失败',
            retryLoading: '重试',
            categoryNavigation: '表情分类',
            searchResultsNone: '没有匹配的表情',
            searchResultsOne: '找到一个表情',
            searchResultsMany: '找到 %n 个表情',
            skinToneNeutral: '默认肤色',
            skinToneLight: '浅色肤色',
            skinToneMediumLight: '中浅色肤色',
            skinToneMedium: '中等肤色',
            skinToneMediumDark: '中深色肤色',
            skinToneDark: '深色肤色',
          }}
          onEmojiClick={(data) => {
            insertPickedEmoji(editor, data.emoji, expectedSession)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
