import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import type { TiptapLifecycle } from '../lifecycle'
import { ToolbarSession, applyDocumentCommand } from '../toolbar/selection'

interface Integration {
  editor: Editor
  begin(owner: string): void
  restore(): boolean
  end(owner?: string): void
  run(command: (editor: Editor) => boolean): boolean
  upload(): void
}
const Context = createContext<Integration | null>(null)

export function OfficialUiProvider({
  editor,
  runtime,
  upload,
  children,
}: {
  editor: Editor
  runtime: TiptapLifecycle
  upload: () => void
  children: ReactNode
}) {
  const session = useRef<ToolbarSession | null>(null)
  const owner = useRef<string | null>(null)
  const value = useMemo<Integration>(
    () => ({
      editor,
      begin(nextOwner) {
        session.current?.dispose()
        owner.current = nextOwner
        session.current = new ToolbarSession(editor, runtime)
      },
      restore() {
        return session.current
          ? session.current.restore()
          : !editor.isDestroyed && editor.isEditable
      },
      end(closingOwner) {
        if (closingOwner && owner.current !== closingOwner) return
        session.current?.dispose()
        session.current = null
        owner.current = null
      },
      run(command) {
        return session.current
          ? session.current.run(command)
          : applyDocumentCommand(editor, () => command(editor))
      },
      upload,
    }),
    [editor, runtime, upload],
  )
  useEffect(() => () => value.end(), [value])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useOfficialIntegration() {
  const context = useContext(Context)
  if (!context) throw new Error('Official editor UI requires its integration provider')
  return context
}

const labels: Record<string, string> = {
  Undo: '撤销',
  Redo: '重做',
  Bold: '粗体',
  Italic: '斜体',
  Underline: '下划线',
  Strike: '删除线',
  Code: '行内代码',
  'Format text as heading': '标题',
  Heading: '标题',
  'List options': '列表',
  'Bullet List': '无序列表',
  'Ordered List': '有序列表',
  'Task List': '任务列表',
  'Toggle blockquote': '引用',
  Blockquote: '引用',
  'Code Block': '代码块',
  'Code block': '代码块',
  Link: '编辑链接',
  Highlight: '高亮',
  'Highlight text': '高亮',
  'Remove highlight': '清除高亮',
  'Add image': '上传本地图片',
  'Align left': '左对齐',
  'Align center': '居中',
  'Align right': '右对齐',
  'Align justify': '两端对齐',
}
export function translateLabel(label: string): string {
  return (
    labels[label] ??
    label
      .replace(/^Heading ([1-6])$/, '标题 $1')
      .replace(/^(成功|警告|危险|链接) highlight color$/, '高亮 $1')
  )
}
