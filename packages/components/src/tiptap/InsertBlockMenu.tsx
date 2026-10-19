import { useEffect, useId, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  Button,
  Field,
  FieldLabel,
  FieldError,
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@exre/exui'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Editor } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  SquareCode,
  Minus,
  Image,
  PanelTopClose,
  Table2,
  Lightbulb,
  Info,
  TriangleAlert,
  CircleAlert,
  Plus,
  GripVertical,
  type LucideIcon,
} from 'lucide-react'
import {
  closeInsertBlock,
  insertBlock,
  insertBlockImageUrl,
  openInsertBlockAfter,
  prepareInsertBlockImage,
  readInsertBlockAnchor,
  type InsertBlockAnchor,
  type InsertBlockType,
} from './insert-block'
import type { TiptapLifecycle } from './lifecycle'
import type { ContentSession } from './content-session'
import { isSafeTiptapUrl } from './conversion/policy'
import styles from './InsertBlockMenu.module.scss'

type Item = { type: InsertBlockType | 'image'; label: string; icon: LucideIcon }
const groups: { label: string; items: Item[] }[] = [
  {
    label: '文字',
    items: [
      { type: 'text', label: '正文', icon: Type },
      { type: 'h1', label: '标题 1', icon: Heading1 },
      { type: 'h2', label: '标题 2', icon: Heading2 },
      { type: 'h3', label: '标题 3', icon: Heading3 },
      { type: 'h4', label: '标题 4', icon: Heading4 },
    ],
  },
  {
    label: '列表',
    items: [
      { type: 'bullet', label: '无序列表', icon: List },
      { type: 'ordered', label: '有序列表', icon: ListOrdered },
      { type: 'task', label: '任务列表', icon: ListTodo },
    ],
  },
  {
    label: '内容',
    items: [
      { type: 'image', label: '图片', icon: Image },
      { type: 'quote', label: '引用', icon: Quote },
      { type: 'code', label: '代码块', icon: SquareCode },
      { type: 'divider', label: '分隔线', icon: Minus },
      { type: 'details', label: '折叠块', icon: PanelTopClose },
      { type: 'table', label: '表格', icon: Table2 },
    ],
  },
  {
    label: '提示',
    items: [
      { type: 'tip', label: '提示', icon: Lightbulb },
      { type: 'info', label: '信息', icon: Info },
      { type: 'warning', label: '警告', icon: TriangleAlert },
      { type: 'error', label: '危险', icon: CircleAlert },
    ],
  },
]
const markdownGroups = groups
  .filter((group) => group.label !== '提示')
  .map((group) => ({
    ...group,
    items:
      group.label === '文字'
        ? [
            ...group.items,
            { type: 'h5' as const, label: '标题 5', icon: Heading5 },
            { type: 'h6' as const, label: '标题 6', icon: Heading6 },
          ]
        : group.items.filter((item) => item.type !== 'details'),
  }))
const imageSchema = z.object({
  src: z
    .string()
    .min(1, '请输入图片地址。')
    .refine((value) => isSafeTiptapUrl(value, 'image'), '请输入安全的图片地址。'),
  alt: z.string(),
  title: z.string(),
})

export function InsertBlockControls({ editor }: { editor: Editor }) {
  const target = useRef<{ node: Node; pos: number } | null>(null)
  return (
    <DragHandle
      editor={editor}
      nested={false}
      className={styles.controls}
      onNodeChange={({ node, pos }) => {
        target.current = node && pos >= 0 ? { node, pos } : null
      }}
    >
      <button
        type="button"
        className={styles.add}
        aria-label="插入块"
        title="插入块"
        draggable={false}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const hover = target.current
          if (hover && !editor.isDestroyed && editor.state.doc.nodeAt(hover.pos) === hover.node)
            openInsertBlockAfter(editor, hover.pos)
        }}
      >
        <Plus aria-hidden="true" />
      </button>
      <span className={styles.grip} role="img" aria-label="拖动段落" title="拖动段落">
        <GripVertical aria-hidden="true" />
      </span>
    </DragHandle>
  )
}

export function InsertBlockMenu({
  editor,
  anchor,
  runtime,
  uploadEnabled,
  keyboard,
  markdown = false,
}: {
  editor: Editor
  anchor: InsertBlockAnchor
  runtime: TiptapLifecycle | ContentSession
  uploadEnabled: boolean
  keyboard: MutableRefObject<(event: KeyboardEvent) => boolean>
  markdown?: boolean
}) {
  const menuGroups = markdown ? markdownGroups : groups
  const items = menuGroups.flatMap((group) => group.items)
  const visualRows = menuGroups.flatMap((group) =>
    Array.from({ length: Math.ceil(group.items.length / 2) }, (_, row) =>
      group.items.slice(row * 2, row * 2 + 2),
    ),
  )
  const [index, setIndex] = useState(0)
  const [imageForm, setImageForm] = useState(false)
  const form = useForm<z.infer<typeof imageSchema>>({
    resolver: zodResolver(imageSchema),
    defaultValues: { src: '', alt: '', title: '' },
  })
  const formId = useId()
  useEffect(() => {
    if (imageForm) form.setFocus('src')
  }, [imageForm, form.setFocus])
  const active = useRef(index)
  active.current = index
  const file = useRef<HTMLInputElement>(null),
    fileSession = useRef<object | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const virtualRef = useRef({ getBoundingClientRect: () => new DOMRect() })
  virtualRef.current = {
    getBoundingClientRect: () => {
      if (editor.isDestroyed) return new DOMRect()
      try {
        const current = readInsertBlockAnchor(editor)
        if (!current) return new DOMRect()
        if (current.mode === 'slash') {
          const rect = editor.view.coordsAtPos(current.from + 2)
          return new DOMRect(rect.left, rect.top, 0, rect.bottom - rect.top)
        }
        const node = editor.view.nodeDOM(current.from)
        if (node instanceof Element) {
          const rect = node.getBoundingClientRect()
          return new DOMRect(
            rect.left - 2.5 * parseFloat(getComputedStyle(editor.view.dom).fontSize),
            rect.bottom,
            0,
            0,
          )
        }
      } catch {
        /* The plugin dismisses a deleted target on the same transaction. */
      }
      return editor.view.dom.getBoundingClientRect()
    },
  }
  const select = (item: Item) => {
    if (runtime.composing || editor.view.composing) return
    if (readInsertBlockAnchor(editor)?.session !== anchor.session) return
    if (item.type !== 'image') {
      insertBlock(editor, item.type, anchor.session)
      return
    }
    if (markdown) {
      if (prepareInsertBlockImage(editor)) setImageForm(true)
      return
    }
    if (!uploadEnabled) return
    fileSession.current = prepareInsertBlockImage(editor)
    if (fileSession.current) file.current?.click()
  }
  const handleKey = (event: KeyboardEvent): boolean => {
    if (
      anchor.pendingImage ||
      runtime.composing ||
      editor.view.composing ||
      event.isComposing ||
      event.keyCode === 229
    )
      return false
    if (event.key === 'Enter') {
      const item = items[active.current]
      if (item) select(item)
      return true
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
      return false
    let next = active.current
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
      next = Math.max(0, Math.min(items.length - 1, next + (event.key === 'ArrowRight' ? 1 : -1)))
    else {
      let row = 0,
        column = next,
        start = 0
      while (column >= visualRows[row]!.length) {
        column -= visualRows[row]!.length
        row++
      }
      const targetRow = Math.max(
        0,
        Math.min(visualRows.length - 1, row + (event.key === 'ArrowDown' ? 1 : -1)),
      )
      start = visualRows.slice(0, targetRow).reduce((sum, items) => sum + items.length, 0)
      next = start + Math.min(column, visualRows[targetRow]!.length - 1)
    }
    if (items[next]?.type === 'image' && !uploadEnabled && !markdown)
      next += event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
    active.current = next
    setIndex(next)
    if (anchor.mode === 'after')
      panel.current
        ?.querySelectorAll<HTMLButtonElement>('button')
        [next]?.focus({ preventScroll: true })
    return true
  }
  useLayoutEffect(() => {
    keyboard.current = handleKey
    return () => {
      keyboard.current = () => false
    }
  })
  useLayoutEffect(() => {
    const container = panel.current,
      button = container?.querySelectorAll<HTMLButtonElement>('button')[index]
    if (!container || !button) return
    const bounds = container.getBoundingClientRect(),
      choice = button.getBoundingClientRect()
    if (choice.top < bounds.top) container.scrollTop -= bounds.top - choice.top
    else if (choice.bottom > bounds.bottom) container.scrollTop += choice.bottom - bounds.bottom
  }, [index, anchor.pendingImage])
  useEffect(() => {
    const input = file.current
    const cancel = () => {
      const current = readInsertBlockAnchor(editor)
      if (current?.session === fileSession.current) closeInsertBlock(editor)
      fileSession.current = null
    }
    input?.addEventListener('cancel', cancel)
    return () => input?.removeEventListener('cancel', cancel)
  }, [editor])
  const input = (
    <input
      ref={file}
      className={styles.file}
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      aria-label="插入块图片"
      onChange={(event) => {
        const current = readInsertBlockAnchor(editor),
          chosen = event.target.files?.[0]
        if (
          current?.pendingImage &&
          current.session === fileSession.current &&
          chosen &&
          uploadEnabled
        ) {
          if ('upload' in runtime)
            void runtime.upload(chosen, undefined, {
              from: current.from,
              to: current.to,
              replace: current.mode === 'slash',
            })
        }
        if (current?.session === fileSession.current) closeInsertBlock(editor)
        fileSession.current = null
        event.target.value = ''
      }}
    />
  )
  return (
    <>
      {!markdown && input}
      {(!anchor.pendingImage || imageForm) && (
        <Popover
          open
          onOpenChange={(open) => {
            if (!open && readInsertBlockAnchor(editor)?.session === anchor.session)
              closeInsertBlock(editor)
          }}
        >
          <PopoverAnchor virtualRef={virtualRef} />
          <PopoverContent
            ref={panel}
            glass
            role="dialog"
            aria-label="插入块"
            data-tiptap-insert-block
            className={styles.popup}
            align="start"
            sideOffset={4}
            collisionPadding={8}
            updatePositionStrategy="always"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              if (imageForm)
                panel.current
                  ?.querySelector<HTMLInputElement>('input')
                  ?.focus({ preventScroll: true })
              else if (anchor.mode === 'after')
                panel.current
                  ?.querySelector<HTMLButtonElement>('button')
                  ?.focus({ preventScroll: true })
            }}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              event.preventDefault()
              if (
                event.isComposing ||
                event.keyCode === 229 ||
                runtime.composing ||
                editor.view.composing
              )
                return
              closeInsertBlock(editor)
              if (!editor.isDestroyed && editor.isEditable) editor.view.focus()
            }}
            onKeyDown={(event) => {
              if (handleKey(event.nativeEvent)) event.preventDefault()
            }}
          >
            {imageForm ? (
              <form
                className={styles.imageForm}
                onSubmit={form.handleSubmit((values) => {
                  if (
                    readInsertBlockAnchor(editor)?.session !== anchor.session ||
                    !editor.isEditable ||
                    runtime.composing ||
                    editor.view.composing
                  )
                    return
                  if (
                    !insertBlockImageUrl(
                      editor,
                      { ...values, title: values.title || null },
                      anchor.session,
                    )
                  )
                    form.setError('src', { message: '图片无法插入，原文档已保留。' })
                })}
              >
                <Field data-invalid={!!form.formState.errors.src}>
                  <FieldLabel htmlFor={`${formId}-url`}>图片地址</FieldLabel>
                  <Input
                    id={`${formId}-url`}
                    {...form.register('src')}
                    aria-invalid={!!form.formState.errors.src}
                    aria-describedby={`${formId}-error`}
                  />
                  <FieldError id={`${formId}-error`}>
                    {form.formState.errors.src?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${formId}-alt`}>替代文字</FieldLabel>
                  <Input id={`${formId}-alt`} {...form.register('alt')} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${formId}-title`}>图片说明</FieldLabel>
                  <Input id={`${formId}-title`} {...form.register('title')} />
                </Field>
                <Button type="submit">插入图片</Button>
              </form>
            ) : (
              menuGroups.map((group) => (
                <section
                  key={group.label}
                  role="group"
                  aria-label={group.label}
                  className={styles.category}
                >
                  <div className={styles.heading} aria-hidden="true">
                    {group.label}
                  </div>
                  <div className={styles.grid}>
                    {group.items.map((item) => {
                      const position = items.indexOf(item),
                        Icon = item.icon
                      return (
                        <button
                          key={item.type}
                          type="button"
                          className={styles.choice}
                          aria-label={item.label}
                          title={item.label}
                          data-type={item.type}
                          data-active={position === index}
                          disabled={item.type === 'image' && !uploadEnabled && !markdown}
                          onMouseDown={(event) => event.preventDefault()}
                          onFocus={() => {
                            active.current = position
                            setIndex(position)
                          }}
                          onPointerMove={() => {
                            active.current = position
                            setIndex(position)
                          }}
                          onClick={() => select(item)}
                        >
                          <span className={styles.icon} aria-hidden="true">
                            <Icon />
                          </span>
                          <span className={styles.label}>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))
            )}
          </PopoverContent>
        </Popover>
      )}
    </>
  )
}
