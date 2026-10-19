import { useCallback, useEffect, useRef } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import type { TiptapLifecycle } from '../lifecycle'
import { OfficialUiProvider } from '../official/integration'
import { TooltipProvider } from '../official/primitives'
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from '../official/components/tiptap-ui-primitive/toolbar/toolbar'
import { MarkButton } from '../official/components/tiptap-ui/mark-button'
import { UndoRedoButton } from '../official/components/tiptap-ui/undo-redo-button'
import { HeadingDropdownMenu } from '../official/components/tiptap-ui/heading-dropdown-menu'
import { ListDropdownMenu } from '../official/components/tiptap-ui/list-dropdown-menu'
import { BlockquoteButton } from '../official/components/tiptap-ui/blockquote-button'
import { CodeBlockButton } from '../official/components/tiptap-ui/code-block-button'
import { TextAlignButton } from '../official/components/tiptap-ui/text-align-button'
import { ColorHighlightPopover } from '../official/components/tiptap-ui/color-highlight-popover'
import { LinkPopover } from '../official/components/tiptap-ui/link-popover'
import { ImageUploadButton } from '../official/components/tiptap-ui/image-upload-button'
import { ToolbarSession } from './selection'
import { useToolbarColors } from './colors'
import { getFormattingPalette } from './formatting-colors'
import styles from '../official/theme.module.scss'

export function TiptapToolbar({
  editor,
  runtime,
  uploadEnabled,
}: {
  editor: Editor
  runtime: TiptapLifecycle
  uploadEnabled: boolean
}) {
  const generation = useEditorState({ editor, selector: () => runtime.documentGeneration })
  return (
    <ToolbarContent
      key={generation}
      editor={editor}
      runtime={runtime}
      uploadEnabled={uploadEnabled}
    />
  )
}

function ToolbarContent({
  editor,
  runtime,
  uploadEnabled,
}: {
  editor: Editor
  runtime: TiptapLifecycle
  uploadEnabled: boolean
}) {
  const host = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null)
  const colors = useToolbarColors(host)
  const fileSession = useRef<ToolbarSession | null>(null)
  const upload = useCallback(() => {
    fileSession.current?.dispose()
    fileSession.current = new ToolbarSession(editor, runtime)
    file.current?.click()
  }, [editor, runtime])
  useEffect(() => () => fileSession.current?.dispose(), [])
  const palette = getFormattingPalette(colors.default !== null && !!host.current?.closest('.dark'))
  return (
    <OfficialUiProvider editor={editor} runtime={runtime} upload={upload}>
      <TooltipProvider>
        <Toolbar
          ref={host}
          className={styles.toolbar}
          aria-label="富文本工具栏"
          data-tiptap-ui="official"
        >
          <ToolbarGroup>
            <UndoRedoButton editor={editor} action="undo" />
            <UndoRedoButton editor={editor} action="redo" />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <HeadingDropdownMenu editor={editor} levels={[1, 2, 3, 4]} />
            <ListDropdownMenu editor={editor} types={['bulletList', 'orderedList', 'taskList']} />
            <BlockquoteButton editor={editor} />
            <CodeBlockButton editor={editor} />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            {(['bold', 'italic', 'underline', 'strike', 'code'] as const).map((type) => (
              <MarkButton key={type} editor={editor} type={type} />
            ))}
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            <ColorHighlightPopover editor={editor} {...palette} />
            <LinkPopover editor={editor} autoOpenOnLinkActive={false} />
          </ToolbarGroup>
          <ToolbarSeparator />
          <ToolbarGroup>
            {(['left', 'center', 'right', 'justify'] as const).map((align) => (
              <TextAlignButton key={align} editor={editor} align={align} />
            ))}
          </ToolbarGroup>
          {uploadEnabled && (
            <>
              <ToolbarSeparator />
              <ToolbarGroup>
                <ImageUploadButton editor={editor} />
              </ToolbarGroup>
            </>
          )}
        </Toolbar>
        {uploadEnabled && (
          <input
            ref={file}
            className={styles.file}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp"
            aria-label="选择本地图片"
            onChange={(event) => {
              const selection = fileSession.current
              if (selection?.restore())
                Array.from(event.target.files ?? []).forEach((item) => {
                  void runtime.upload(item)
                })
              event.target.value = ''
              selection?.dispose()
              fileSession.current = null
            }}
          />
        )}
      </TooltipProvider>
    </OfficialUiProvider>
  )
}
