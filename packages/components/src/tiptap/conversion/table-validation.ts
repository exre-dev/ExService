import type { Node } from '@tiptap/pm/model'
import { fail, TIPTAP_LIMITS } from './policy'

/** Check the grid without allowing ProseMirror to silently repair it or
 * allocating an unbounded virtual grid from a tiny set of merged cells. */
export function validateTableGrid(table: Node): void {
  let width = 0
  table.firstChild?.forEach((cell) => {
    width += cell.attrs.colspan
  })
  const height = table.childCount
  if (!width || width * height > TIPTAP_LIMITS.nodes) fail('limit-exceeded')
  const occupied = new Uint8Array(width * height)
  table.forEach((row, _offset, y) => {
    let x = 0
    row.forEach((cell) => {
      while (x < width && occupied[y * width + x]) x++
      const { colspan, rowspan } = cell.attrs
      if (x + colspan > width || y + rowspan > height) fail('invalid-content')
      for (let dy = 0; dy < rowspan; dy++)
        for (let dx = 0; dx < colspan; dx++) {
          const slot = (y + dy) * width + x + dx
          if (occupied[slot]) fail('invalid-content')
          occupied[slot] = 1
        }
      x += colspan
    })
  })
  if (occupied.includes(0)) fail('invalid-content')
}

const structural = new Set(['table', 'thead', 'tbody', 'tr'])
const tableTags = new Set([...structural, 'td', 'th'])
const parents: Record<string, string[]> = {
  thead: ['table'],
  tbody: ['table'],
  tr: ['table', 'thead', 'tbody'],
  td: ['tr'],
  th: ['tr'],
}
const inlineContainers = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'pre',
  'code',
  'summary',
  'a',
  'span',
  'mark',
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'u',
])

/** parse5 can discard misplaced cells or foster-parent text outside a table.
 * Inspect the raw nesting first, before that evidence disappears. */
export function tableHtmlGuard() {
  const stack: string[] = []
  return {
    start(tag: string, selfClosing: boolean) {
      const parent = stack.at(-1)
      if (tag === 'table' && stack.some((name) => inlineContainers.has(name)))
        fail('invalid-content')
      if (tag === 'td' && stack.slice(stack.lastIndexOf('table')).includes('thead'))
        fail('invalid-content')
      if (parents[tag] && !parents[tag]!.includes(parent ?? '')) fail('invalid-content')
      if (parent && structural.has(parent) && !parents[tag]?.includes(parent))
        fail('invalid-content')
      if (tableTags.has(tag) && selfClosing) fail('invalid-content')
      if (!['br', 'hr', 'img', 'input'].includes(tag)) stack.push(tag)
    },
    end(tag: string) {
      if (tableTags.has(tag) && stack.at(-1) !== tag) fail('invalid-content')
      const index = stack.lastIndexOf(tag)
      if (index >= 0) {
        if (stack.slice(index + 1).some((name) => tableTags.has(name))) fail('invalid-content')
        stack.length = index
      }
    },
    text(value: string) {
      if (structural.has(stack.at(-1) ?? '') && value.trim()) fail('invalid-content')
    },
    finish() {
      if (stack.some((tag) => tableTags.has(tag))) fail('invalid-content')
    },
  }
}
