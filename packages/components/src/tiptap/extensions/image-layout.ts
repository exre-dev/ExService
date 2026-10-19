import type { NodeViewRenderer } from '@tiptap/core'
import { DOMSerializer, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'

/** Layout-only adapter around the official Image NodeView (and its official
 * toDOM spec when readonly). No document attributes or clipboard HTML change. */
export function imageLayoutNodeView(
  official: NodeViewRenderer | null | undefined,
): NodeViewRenderer {
  return (props) => {
    let node = props.node
    const render = (next: ProseMirrorNode) =>
      DOMSerializer.renderSpec(document, props.editor.schema.nodes.image!.spec.toDOM!(next))
        .dom as HTMLImageElement
    let view: NodeView
    if (official) view = official(props)
    else {
      const container = document.createElement('div')
      container.append(render(node))
      view = { dom: container }
    }
    const container = view.dom as HTMLElement
    container.dataset.tiptapImageLayout = ''
    let image = container.querySelector('img')!
    const layout = () => {
      const width = node.attrs.width as number | null,
        height = node.attrs.height as number | null
      const naturalRatio =
        image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : null
      const displayWidth = width ?? (height && naturalRatio ? height * naturalRatio : null)
      container.style.setProperty(
        '--tiptap-image-width',
        displayWidth ? `${displayWidth}px` : 'auto',
      )
      container.style.setProperty(
        '--tiptap-image-height',
        height && !width && !naturalRatio ? `${height}px` : 'auto',
      )
      container.style.setProperty(
        '--tiptap-image-ratio',
        width && height ? `${width} / ${height}` : naturalRatio ? String(naturalRatio) : 'auto',
      )
    }
    image.addEventListener('load', layout)
    layout()
    const update = view.update?.bind(view),
      destroy = view.destroy?.bind(view)
    view.update = (next, decorations, innerDecorations) => {
      if (next.type !== node.type) return false
      if (official) {
        if (!update?.(next, decorations, innerDecorations)) return false
      } else if (!node.eq(next)) {
        image.removeEventListener('load', layout)
        const replacement = render(next)
        image.replaceWith(replacement)
        image = replacement
        image.addEventListener('load', layout)
      }
      node = next
      layout()
      return true
    }
    view.destroy = () => {
      image.removeEventListener('load', layout)
      destroy?.()
    }
    return view
  }
}
