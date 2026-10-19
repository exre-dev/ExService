import type { NodeViewRenderer } from '@tiptap/core'
import { TableView } from '@tiptap/extension-table'
import { ReactRenderer } from '@tiptap/react'
import type { TiptapLifecycle } from '../lifecycle'
import { TableControls } from './TableControls'
import styles from './table.module.scss'

/** Keep the official contentDOM and column layout; controls are live view-only
 * siblings. The schema serializer remains the clipboard/export authority. */
export function createTableNodeView(runtime: TiptapLifecycle): NodeViewRenderer {
  return ({ editor, node, view, getPos, HTMLAttributes }) => {
    const tableView = new TableView(node, 100, view, HTMLAttributes)
    const dom = document.createElement('div')
    dom.className = styles.shell!
    dom.dataset.tiptapTable = ''
    const ui = new ReactRenderer(TableControls, {
      editor,
      props: { editor, runtime, tableView, getPos, node, enabled: editor.isEditable },
      className: styles.layer,
    })
    const updateEditable = () =>
      ui.updateProps({ enabled: !editor.isDestroyed && editor.isEditable })
    editor.on('update', updateEditable)
    editor.on('transaction', updateEditable)
    // setEditable(..., false) updates NodeViews through the explicit runtime notification.
    const unsubscribe = runtime.onEditableChange(updateEditable)
    ui.element.contentEditable = 'false'
    dom.append(tableView.dom, ui.element)
    return {
      dom,
      contentDOM: tableView.contentDOM,
      update(next) {
        if (!tableView.update(next)) return false
        ui.updateProps({ node: next })
        return true
      },
      stopEvent: (event) =>
        event.target instanceof globalThis.Node && ui.element.contains(event.target),
      ignoreMutation: (mutation) =>
        ui.element.contains(mutation.target) ||
        mutation.target === dom ||
        tableView.ignoreMutation(mutation),
      destroy: () => {
        unsubscribe()
        editor.off('update', updateEditable)
        editor.off('transaction', updateEditable)
        ui.destroy()
      },
    }
  }
}
