import { Schema } from '@tiptap/pm/model'

/**
 * Docs profile 1 的持久文档语法。
 *
 * 这是领域内的最小 NodeSpec/MarkSpec，与 `packages/components/src/tiptap/extensions/index.ts`
 * 的完整预设（`createTiptapExtensions({ purpose: 'conversion' })`）逐项对应：
 * 24 个节点、8 类 Mark，节点/属性名称与默认值一致，声明顺序决定 Mark rank。
 *
 * 本模块只描述持久 JSON 的语法与默认属性：不创建 Editor，不导入组件包根、React、CSS、
 * NodeView 或 HTML/Markdown 转换器，不引入 jsdom 或 parse5。运行期只使用
 * `Schema`、`nodeFromJSON` 与 `Node.check()`，不使用 `createAndFill` 自动修补。
 */

const nodeOrder = [
  'paragraph',
  'mention',
  'blockquote',
  'bulletList',
  'codeBlock',
  'doc',
  'hardBreak',
  'heading',
  'horizontalRule',
  'listItem',
  'orderedList',
  'text',
  'taskList',
  'taskItem',
  'details',
  'detailsSummary',
  'detailsContent',
  'image',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell',
  'admonition',
  'admonitionTitle',
] as const

const markOrder = [
  'link',
  'textStyle',
  'bold',
  'code',
  'italic',
  'strike',
  'underline',
  'highlight',
] as const

export const DOCS_NODE_NAMES = nodeOrder
export const DOCS_MARK_NAMES = markOrder

const rawNodes = {
  paragraph: { content: 'inline*', group: 'block', attrs: { textAlign: { default: null } } },
  mention: {
    group: 'inline',
    inline: true,
    atom: true,
    selectable: false,
    attrs: {
      id: { default: null },
      label: { default: null },
      mentionSuggestionChar: { default: '@' },
    },
  },
  blockquote: { content: 'block+', group: 'block', defining: true, attrs: {} },
  bulletList: { content: 'listItem+', group: 'block list', attrs: {} },
  codeBlock: {
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    attrs: { language: { default: null } },
  },
  doc: { content: 'block+', attrs: {} },
  hardBreak: {
    group: 'inline',
    inline: true,
    selectable: false,
    linebreakReplacement: true,
    attrs: {},
  },
  heading: {
    content: 'inline*',
    group: 'block',
    defining: true,
    attrs: { textAlign: { default: null }, level: { default: 1 } },
  },
  horizontalRule: { group: 'block', attrs: {} },
  listItem: { content: 'paragraph block*', defining: true, attrs: {} },
  orderedList: {
    content: 'listItem+',
    group: 'block list',
    attrs: { start: { default: 1 }, type: { default: null } },
  },
  text: { group: 'inline', attrs: {} },
  taskList: { content: 'taskItem+', group: 'block list', attrs: {} },
  taskItem: { content: 'paragraph block*', defining: true, attrs: { checked: { default: false } } },
  details: {
    content: 'detailsSummary detailsContent',
    group: 'block',
    defining: true,
    isolating: true,
    attrs: { open: { default: false } },
  },
  detailsSummary: {
    content: 'text*',
    selectable: false,
    defining: true,
    isolating: true,
    attrs: {},
  },
  detailsContent: { content: 'block+', selectable: false, defining: true, attrs: {} },
  image: {
    group: 'block',
    inline: false,
    draggable: true,
    attrs: {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
    },
  },
  table: { content: 'tableRow+', group: 'block', isolating: true, tableRole: 'table', attrs: {} },
  tableRow: { content: '(tableCell | tableHeader)*', tableRole: 'row', attrs: {} },
  tableHeader: {
    content: 'block+',
    isolating: true,
    tableRole: 'header_cell',
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      colwidth: { default: null },
      align: { default: null },
    },
  },
  tableCell: {
    content: 'block+',
    isolating: true,
    tableRole: 'cell',
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      colwidth: { default: null },
      align: { default: null },
    },
  },
  admonition: {
    content: 'admonitionTitle block+',
    group: 'block',
    defining: true,
    attrs: { type: { default: 'info' } },
  },
  admonitionTitle: { content: 'inline*', defining: true, attrs: {} },
} as const

const rawMarks = {
  link: {
    inclusive: true,
    attrs: {
      href: { default: null },
      target: { default: null },
      rel: { default: null },
      class: { default: null },
      title: { default: null },
    },
  },
  textStyle: {
    attrs: {
      backgroundColor: { default: null },
      color: { default: null },
      fontSize: { default: null },
    },
  },
  bold: { attrs: {} },
  code: { code: true, excludes: '_', attrs: {} },
  italic: { attrs: {} },
  strike: { attrs: {} },
  underline: { attrs: {} },
  highlight: { attrs: { color: { default: null } } },
} as const

function order<T extends Record<string, unknown>>(
  source: T,
  names: readonly (keyof T & string)[],
): T {
  const missing = names.filter((name) => !(name in source))
  if (missing.length)
    throw new Error(`Docs content schema is missing entries: ${missing.join(', ')}`)
  const extra = Object.keys(source).filter((name) => !(names as readonly string[]).includes(name))
  if (extra.length)
    throw new Error(`Docs content schema has unexpected entries: ${extra.join(', ')}`)
  return Object.fromEntries(names.map((name) => [name, source[name]])) as T
}

export const docsSchema = new Schema({
  nodes: order(rawNodes, nodeOrder),
  marks: order(rawMarks, markOrder),
  topNode: 'doc',
})
