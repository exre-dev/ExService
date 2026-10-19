import type { Editor } from '@tiptap/core'
import { addColumn, addRow, removeColumn, removeRow, TableMap } from '@tiptap/pm/tables'

export type TableCommand =
  | 'addRowBefore'
  | 'addRowAfter'
  | 'deleteRow'
  | 'addColumnBefore'
  | 'addColumnAfter'
  | 'deleteColumn'
  | 'toggleHeaderRow'
  | 'deleteTable'

/** A handle identifies a logical grid row/column. Native selection commands
 * expand across merged cells, so use the public indexed table transforms. */
export function executeTableCommand(
  editor: Editor,
  tablePos: number,
  index: number,
  command: TableCommand,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table' || !editor.isEditable) return false
  if (command === 'toggleHeaderRow' || command === 'deleteTable') return editor.commands[command]()
  const map = TableMap.get(table)
  const row = command === 'addRowBefore' || command === 'addRowAfter' || command === 'deleteRow'
  if (index < 0 || index >= (row ? map.height : map.width)) return false
  if (
    (command === 'deleteRow' && map.height === 1) ||
    (command === 'deleteColumn' && map.width === 1)
  )
    return false
  const rect = {
    table,
    map,
    tableStart: tablePos + 1,
    left: 0,
    top: 0,
    right: map.width,
    bottom: map.height,
  }
  const tr = editor.state.tr
  switch (command) {
    case 'addRowBefore':
      addRow(tr, rect, index)
      break
    case 'addRowAfter':
      addRow(tr, rect, index + 1)
      break
    case 'deleteRow':
      removeRow(tr, rect, index)
      break
    case 'addColumnBefore':
      addColumn(tr, rect, index)
      break
    case 'addColumnAfter':
      addColumn(tr, rect, index + 1)
      break
    case 'deleteColumn':
      removeColumn(tr, rect, index)
      break
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}
