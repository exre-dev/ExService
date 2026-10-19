import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { TableView } from '@tiptap/extension-table'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import type { Node } from '@tiptap/pm/model'
import { Button, Popover, PopoverAnchor, PopoverContent } from '@exre/exui'
import {
  Table2,
  MoreHorizontal,
  MoreVertical,
  Plus,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Rows3,
  Columns3,
  Heading,
  Trash2,
} from 'lucide-react'
import { ToolbarSession, applyDocumentCommand } from '../toolbar/selection'
import type { TiptapLifecycle } from '../lifecycle'
import { executeTableCommand, type TableCommand } from './commands'
import styles from './table.module.scss'

export interface TableControlsProps {
  enabled: boolean
  editor: Editor
  runtime: TiptapLifecycle
  tableView: TableView
  getPos: () => number | undefined
  node: Node
}
type Kind = 'row' | 'column' | 'table'
const actions = {
  row: [
    { command: 'addRowBefore', label: '在上方插入行', Icon: ArrowUpToLine },
    { command: 'addRowAfter', label: '在下方插入行', Icon: ArrowDownToLine },
    { command: 'deleteRow', label: '删除当前行', Icon: Rows3 },
  ],
  column: [
    { command: 'addColumnBefore', label: '在左侧插入列', Icon: ArrowLeftToLine },
    { command: 'addColumnAfter', label: '在右侧插入列', Icon: ArrowRightToLine },
    { command: 'deleteColumn', label: '删除当前列', Icon: Columns3 },
  ],
  table: [
    { command: 'toggleHeaderRow', label: '切换表头行', Icon: Heading },
    { command: 'deleteTable', label: '删除表格', Icon: Trash2 },
  ],
} as const
type Menu = {
  kind: Kind
  index: number
  table: Node
  trigger: HTMLButtonElement
  session: ToolbarSession
}
type Geometry = {
  rows: number[]
  columns: { center: number; visible: boolean }[]
  width: number
  height: number
}

export function TableControls(props: TableControlsProps) {
  return props.enabled ? <EditableTableControls {...props} /> : null
}

function EditableTableControls({ editor, runtime, tableView, getPos, node }: TableControlsProps) {
  const [geometry, setGeometry] = useState<Geometry>({ rows: [], columns: [], width: 0, height: 0 })
  const [menu, setMenu] = useState<Menu | null>(null)
  const session = useRef<ToolbarSession | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const position = () => {
    if (editor.isDestroyed || !editor.isEditable || runtime.composing || editor.view.composing)
      return undefined
    const pos = getPos()
    // ProseMirror can reuse an equal view without calling update after a whole
    // document replacement. Reference identity would disable that live table.
    return pos !== undefined &&
      tableView.dom.isConnected &&
      editor.state.doc.nodeAt(pos)?.eq(tableView.node)
      ? pos
      : undefined
  }
  const close = () => {
    session.current?.dispose()
    session.current = null
    setMenu(null)
  }
  useEffect(
    () => () => {
      session.current?.dispose()
    },
    [],
  )
  useEffect(() => {
    if (menu && !menu.table.eq(tableView.node)) close()
  }, [menu, node, tableView])
  useLayoutEffect(() => {
    let frame = 0
    const shell = tableView.dom.parentElement!
    const measure = () => {
      const origin = shell.getBoundingClientRect(),
        scroll = tableView.dom.getBoundingClientRect()
      const rows = Array.from(tableView.contentDOM.rows).map((row) => {
        const rect = row.getBoundingClientRect()
        return rect.top - origin.top + rect.height / 2
      })
      const columns = Array.from(tableView.colgroup.children).map((col) => {
        const rect = col.getBoundingClientRect(),
          center = rect.left + rect.width / 2
        return {
          center: center - origin.left,
          visible: !scroll.width || (center >= scroll.left && center <= scroll.right),
        }
      })
      const next = { rows, columns, width: scroll.width, height: scroll.height }
      setGeometry((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      )
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(shell)
    observer.observe(tableView.table)
    tableView.dom.addEventListener('scroll', schedule, { passive: true })
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      tableView.dom.removeEventListener('scroll', schedule)
    }
  }, [tableView, node])

  const select = (kind: Kind, index: number): boolean => {
    const pos = position()
    if (pos === undefined) return false
    const map = TableMap.get(tableView.node)
    const offset = map.map[kind === 'row' ? index * map.width : kind === 'column' ? index : 0]
    if (offset === undefined) return false
    const $cell = editor.state.doc.resolve(pos + 1 + offset)
    const selected =
      kind === 'row'
        ? CellSelection.rowSelection($cell)
        : kind === 'column'
          ? CellSelection.colSelection($cell)
          : new CellSelection($cell)
    editor.view.dispatch(editor.state.tr.setSelection(selected))
    return editor.state.selection.eq(selected)
  }
  const open = (kind: Kind, index: number, trigger: HTMLButtonElement) => {
    close()
    if (!select(kind, index)) return
    const next = new ToolbarSession(editor, runtime, () => {
      setMenu(null)
    })
    session.current = next
    setMenu({ kind, index, table: tableView.node, trigger, session: next })
  }
  const append = (kind: 'row' | 'column') => {
    close()
    const map = TableMap.get(tableView.node)
    const index = (kind === 'row' ? map.height : map.width) - 1
    if (
      select(kind, index) &&
      applyDocumentCommand(editor, () => {
        const pos = position()
        return (
          pos !== undefined &&
          executeTableCommand(editor, pos, index, kind === 'row' ? 'addRowAfter' : 'addColumnAfter')
        )
      })
    )
      editor.view.focus()
  }
  const run = (command: TableCommand) => {
    if (!menu) return
    if (!menu.table.eq(tableView.node)) {
      close()
      return
    }
    if (
      position() !== undefined &&
      menu.session.run((current) => {
        const pos = position()
        return pos !== undefined && executeTableCommand(current, pos, menu.index, command)
      })
    )
      close()
  }
  const navigate = (event: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const buttons = Array.from(
      panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    )
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
    event.preventDefault()
  }
  const map = TableMap.get(tableView.node)
  const virtualRef = useRef({ getBoundingClientRect: () => new DOMRect() })
  virtualRef.current = {
    getBoundingClientRect: () => menu?.trigger.getBoundingClientRect() ?? new DOMRect(),
  }
  return (
    <div className={styles.controls} data-table-controls>
      <button
        type="button"
        className={`${styles.handle} ${styles.corner}`}
        aria-label="表格菜单"
        title="表格菜单"
        aria-haspopup="menu"
        aria-expanded={menu?.kind === 'table'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => open('table', 0, event.currentTarget)}
      >
        <Table2 aria-hidden="true" />
      </button>
      {Array.from({ length: map.height }, (_, index) => (
        <button
          key={`r${index}`}
          type="button"
          className={`${styles.handle} ${styles.row}`}
          style={{ top: geometry.rows[index] ?? 20 }}
          aria-label={`第 ${index + 1} 行操作`}
          title={`第 ${index + 1} 行操作`}
          aria-haspopup="menu"
          aria-expanded={menu?.kind === 'row' && menu.index === index}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => open('row', index, event.currentTarget)}
        >
          <MoreVertical aria-hidden="true" />
        </button>
      ))}
      {Array.from({ length: map.width }, (_, index) => (
        <button
          key={`c${index}`}
          type="button"
          className={`${styles.handle} ${styles.column}`}
          style={{
            left: geometry.columns[index]?.center ?? 20,
            display: geometry.columns[index]?.visible === false ? 'none' : undefined,
          }}
          aria-label={`第 ${index + 1} 列操作`}
          title={`第 ${index + 1} 列操作`}
          aria-haspopup="menu"
          aria-expanded={menu?.kind === 'column' && menu.index === index}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => open('column', index, event.currentTarget)}
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        className={`${styles.handle} ${styles.appendRow}`}
        style={{ width: geometry.width || undefined }}
        aria-label="追加一行"
        title="追加一行"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => append('row')}
      >
        <Plus aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`${styles.handle} ${styles.appendColumn}`}
        style={{ height: geometry.height || undefined }}
        aria-label="追加一列"
        title="追加一列"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => append('column')}
      >
        <Plus aria-hidden="true" />
      </button>
      <Popover
        open={!!menu}
        onOpenChange={(opened) => {
          if (!opened) close()
        }}
      >
        <PopoverAnchor virtualRef={virtualRef} />
        <PopoverContent
          ref={panel}
          glass
          className={styles.menu}
          role="menu"
          aria-label="表格操作菜单"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onKeyDown={navigate}
          onEscapeKeyDown={(event) => {
            event.preventDefault()
            const trigger = menu?.trigger
            close()
            if (trigger?.isConnected) trigger.focus()
          }}
        >
          {menu &&
            actions[menu.kind].map(({ command, label, Icon }) => (
              <Button
                key={command}
                type="button"
                variant="ghost"
                role="menuitem"
                className={styles.item}
                disabled={
                  (command === 'deleteRow' && map.height === 1) ||
                  (command === 'deleteColumn' && map.width === 1)
                }
                onClick={() => run(command)}
              >
                <Icon aria-hidden="true" />
                {label}
              </Button>
            ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}
