// @vitest-environment jsdom
/**
 * 浏览器完整预设与 Docs profile 1 服务端 schema 的双层 parity。
 *
 * 内容附录（`.notes/docs-service/specs/2026-10-16-docs-server-v1.2-content.md`）第 2 节要求
 * 结构（schema parity）与值域/策略（policy parity）**分别**验证，且不能互相替代：
 * schema 的默认属性不提供值域——`heading level:5`、`admonition type:'danger'`、
 * URL 安全策略、hex 颜色与字号边界都能通过 ProseMirror schema，只有值域层能拒绝它们；
 * 反过来，值域样本也覆盖不到节点/属性集合、声明顺序与 Mark rank。
 *
 * 两层都只在这里同时驱动两侧实现：浏览器侧是 `packages/components` 的
 * `validateTiptapJSON` + `createTiptapExtensions({ purpose: 'conversion' })` 官方 `getSchema`，
 * Server 侧是 `apps/server` 领域内独立维护的 `docsSchema` 与 `validateDocsContent`。
 * Server 运行时不 import 组件内部文件，因此这条 parity 只能由测试绑定。
 *
 * 差异必须**显式列出**：下面用一张小的 `divergences` 表逐条固定两侧已知且经实际运行确认的
 * 不同结果（零宽表分类、累计网格、JSONB 存储门禁、严格原始字段），
 * 不用"都接受"或"都拒绝"的范围相等把它们掩盖掉。未出现在这张表里的样本，
 * 两侧必须给出同一个接受/拒绝判定。
 *
 * 这也说明为什么不能用 GFM 工厂或裸上游扩展替代完整预设：Placeholder、拖柄、Slash、
 * Emoji 与表格控制器没有持久节点，Admonition 与 AdmonitionTitle 是本仓库自研扩展，
 * `details.open` 只在 `persist:true` 的完整预设里注册、而在 Docs profile 1 里始终存在。
 */
import { describe, expect, it } from 'vitest'
// `@tiptap/core` 只安装在 packages/components 下，根 workspace 无法按裸包名解析；
// 通过 `@components` 别名取到同一个实例，与组件包内使用的是同一份运行时。
import { getSchema } from '@components/node_modules/@tiptap/core'
import type { TiptapContentPolicy } from '@components/src/tiptap/types'
import { createTiptapExtensions } from '@components/src/tiptap/extensions'
import { ContentFailure } from '@components/src/tiptap/conversion/policy'
import { validateTiptapJSON } from '@components/src/tiptap/conversion/validate'
import {
  DOCS_MARK_NAMES,
  DOCS_NODE_NAMES,
  docsSchema,
} from '@server/src/domains/docs/content/schema'
import { validateDocsContent } from '@server/src/domains/docs/content/validation'

type Json = Record<string, unknown>

/** 浏览器 validator 的固定空策略：Docs profile 1 不打开任何 data image 豁免。 */
const BROWSER_POLICY: TiptapContentPolicy = {}

const browserSchema = getSchema(createTiptapExtensions({ purpose: 'conversion' }))

// ---------------------------------------------------------------------------
// 样本构造器
// ---------------------------------------------------------------------------

const text = (value: string, ...marks: Json[]): Json => ({
  type: 'text',
  text: value,
  ...(marks.length ? { marks } : {}),
})
const para = (...content: Json[]): Json => ({ type: 'paragraph', content })
const p = (value?: string): Json =>
  value === undefined ? { type: 'paragraph' } : para(text(value))
const row = (...content: Json[]): Json => ({ type: 'tableRow', content })
const cell = (attrs: Json, ...content: Json[]): Json => ({ type: 'tableCell', attrs, content })
const doc = (...content: Json[]): Json => ({ type: 'doc', content })

/** 用 colspan 撑出很宽的虚拟网格：一个 span 单元格只花一个节点，不会触发节点预算。 */
function wideTable(cells: number, colspan: number): Json {
  return {
    type: 'table',
    content: [row(...Array.from({ length: cells }, () => cell({ colspan }, p('x'))))],
  }
}

// ---------------------------------------------------------------------------
// schema parity
// ---------------------------------------------------------------------------

/** 与持久语法有关的 NodeSpec/MarkSpec 字段；DOM parse/render、commands、plugins、NodeView 不比较。 */
const SPEC_FIELDS = [
  'content',
  'marks',
  'group',
  'inline',
  'atom',
  'selectable',
  'draggable',
  'code',
  'whitespace',
  'defining',
  'definingAsContext',
  'definingForContent',
  'isolating',
  'inclusive',
  'excludes',
  'spanning',
  'linebreakReplacement',
  'tableRole',
] as const

interface SchemaLike {
  nodes: Record<string, { spec: Record<string, unknown> }>
  marks: Record<string, { spec: Record<string, unknown>; rank: number }>
}

/** 只保留被比较的字段，缺省字段两侧一致地缺席，避免用 `undefined` 掩盖 `false`。 */
function projectSpec(spec: Record<string, unknown>): Json {
  const projected: Json = {}
  for (const field of SPEC_FIELDS) if (spec[field] !== undefined) projected[field] = spec[field]
  const attrs = (spec.attrs ?? {}) as Record<string, { default?: unknown }>
  projected.attrs = Object.fromEntries(
    Object.entries(attrs).map(([name, attr]) => [name, attr.default]),
  )
  return projected
}

function projectSchema(schema: SchemaLike): Json {
  return {
    nodes: Object.fromEntries(
      Object.entries(schema.nodes).map(([name, type]) => [name, projectSpec(type.spec)]),
    ),
    marks: Object.fromEntries(
      Object.entries(schema.marks).map(([name, type]) => [name, projectSpec(type.spec)]),
    ),
  }
}

/** ProseMirror 按 `schema.marks` 的声明顺序赋 rank，两侧必须逐项相同。 */
function markRanks(schema: SchemaLike): Json {
  return Object.fromEntries(Object.entries(schema.marks).map(([name, type]) => [name, type.rank]))
}

describe('browser full preset and the Docs server schema describe the same document grammar', () => {
  it('declares the same node and mark names in the same insertion order', () => {
    expect(Object.keys(browserSchema.nodes)).toEqual([...DOCS_NODE_NAMES])
    expect(Object.keys(browserSchema.marks)).toEqual([...DOCS_MARK_NAMES])
    // 完整预设的 24 个节点与 8 类 Mark 必须全部落在 profile 1 里；没有 GFM 行内 Image，也没有 H5/H6。
    expect(Object.keys(browserSchema.nodes)).toHaveLength(24)
    expect(Object.keys(browserSchema.marks)).toHaveLength(8)
  })

  it('projects every node and mark spec, including attribute defaults, to the same object', () => {
    // 一次整体相等：任何字段或默认值漂移都会在这里打出 diff，而不是被逐项抽查漏掉。
    expect(projectSchema(browserSchema as unknown as SchemaLike)).toEqual(
      projectSchema(docsSchema as unknown as SchemaLike),
    )
  })

  it('assigns the same Mark rank from the same mark declaration order', () => {
    expect(markRanks(browserSchema as unknown as SchemaLike)).toEqual(
      markRanks(docsSchema as unknown as SchemaLike),
    )
    expect(markRanks(browserSchema as unknown as SchemaLike)).toEqual({
      link: 0,
      textStyle: 1,
      bold: 2,
      code: 3,
      italic: 4,
      strike: 5,
      underline: 6,
      highlight: 7,
    })
  })
})

// ---------------------------------------------------------------------------
// 值域 / 策略 parity
// ---------------------------------------------------------------------------

type Outcome = { accepted: true } | { accepted: false; code: string }

/**
 * 两侧各拿一份独立深拷贝：浏览器 validator 用对象身份做循环引用检测，
 * Server 会在自己的快照上补默认属性，谁都不能看到对方改写过的对象。
 */
const snapshot = (value: Json): Json => JSON.parse(JSON.stringify(value)) as Json

function browserRun(input: Json): Outcome {
  try {
    validateTiptapJSON(snapshot(input), browserSchema, BROWSER_POLICY)
    return { accepted: true }
  } catch (error) {
    // 浏览器契约：失败必须是携带 code/message/path 的 ContentFailure。
    if (!(error instanceof ContentFailure)) throw error
    expect(error.issue.message).toBeTruthy()
    return { accepted: false, code: error.issue.code }
  }
}

function serverRun(input: Json): Outcome {
  try {
    validateDocsContent(snapshot(input))
    return { accepted: true }
  } catch (error) {
    return { accepted: false, code: String((error as { code?: unknown }).code) }
  }
}

function browserNormalized(input: Json): unknown {
  return validateTiptapJSON(snapshot(input), browserSchema, BROWSER_POLICY)
}

function serverNormalized(input: Json): unknown {
  return validateDocsContent(snapshot(input)).content
}

// --- 双方都接受，且规范化结果逐字节相同 -----------------------------------

const accepted: Array<[string, Json]> = [
  ['an empty document normalised to one paragraph', doc()],
  [
    'heading levels 1 to 4',
    doc(
      { type: 'heading', attrs: { level: 1 }, content: [text('one')] },
      { type: 'heading', attrs: { level: 2 }, content: [text('two')] },
      { type: 'heading', attrs: { level: 3 }, content: [text('three')] },
      { type: 'heading', attrs: { level: 4 }, content: [text('four')] },
    ),
  ],
  [
    'paragraph text alignment left, center, right and justify',
    doc(
      { type: 'paragraph', attrs: { textAlign: 'left' }, content: [text('l')] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('c')] },
      { type: 'paragraph', attrs: { textAlign: 'right' }, content: [text('r')] },
      { type: 'paragraph', attrs: { textAlign: 'justify' }, content: [text('j')] },
    ),
  ],
  [
    'heading text alignment',
    doc({ type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [text('h')] }),
  ],
  [
    'cell alignment left, center and right',
    doc({
      type: 'table',
      content: [
        row(
          { type: 'tableHeader', attrs: { align: 'left' }, content: [p('l')] },
          { type: 'tableHeader', attrs: { align: 'center' }, content: [p('c')] },
          { type: 'tableCell', attrs: { align: 'right' }, content: [p('r')] },
        ),
      ],
    }),
  ],
  [
    'span lower bound',
    doc({ type: 'table', content: [row(cell({ colspan: 1, rowspan: 1 }, p('a')))] }),
  ],
  [
    'span upper bound at 10 000 virtual cells',
    doc({ type: 'table', content: [row(cell({ colspan: 10_000 }, p('a')))] }),
  ],
  [
    'colwidth bounds and the colspan length rule',
    doc({ type: 'table', content: [row(cell({ colspan: 2, colwidth: [0, 8192] }, p('a')))] }),
  ],
  [
    'an empty table row fully covered by an earlier rowspan',
    doc({ type: 'table', content: [row(cell({ rowspan: 2 }, p('a'))), row()] }),
  ],
  [
    'image dimension bounds',
    doc({ type: 'image', attrs: { src: '/a.png', width: 1, height: 8192 } }),
  ],
  [
    'empty image alt and title normalised to null',
    doc({ type: 'image', attrs: { src: '/a.png', alt: '', title: '' } }),
  ],
  [
    'ordered list types 1, a, A, i and I',
    doc(
      {
        type: 'orderedList',
        attrs: { start: 1, type: '1' },
        content: [{ type: 'listItem', content: [p('a')] }],
      },
      {
        type: 'orderedList',
        attrs: { start: 2, type: 'a' },
        content: [{ type: 'listItem', content: [p('b')] }],
      },
      {
        type: 'orderedList',
        attrs: { start: 3, type: 'A' },
        content: [{ type: 'listItem', content: [p('c')] }],
      },
      {
        type: 'orderedList',
        attrs: { start: 4, type: 'i' },
        content: [{ type: 'listItem', content: [p('d')] }],
      },
      {
        type: 'orderedList',
        attrs: { start: 5, type: 'I' },
        content: [{ type: 'listItem', content: [p('e')] }],
      },
      {
        type: 'orderedList',
        attrs: { start: 6, type: null },
        content: [{ type: 'listItem', content: [p('f')] }],
      },
    ),
  ],
  [
    'code block languages, including null and the empty string',
    doc(
      { type: 'codeBlock', content: [text('plain')] },
      { type: 'codeBlock', attrs: { language: null }, content: [text('null')] },
      { type: 'codeBlock', attrs: { language: '' }, content: [text('empty')] },
      { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('typed')] },
      { type: 'codeBlock', attrs: { language: 'c++' }, content: [text('plus')] },
      { type: 'codeBlock', attrs: { language: 'objective-c' }, content: [text('dash')] },
    ),
  ],
  [
    'hex colours expanded and lower-cased',
    doc({
      type: 'paragraph',
      content: [
        text('short', {
          type: 'textStyle',
          attrs: { color: '#ABC', backgroundColor: '#AABBCCDD' },
        }),
        text('highlight', { type: 'highlight', attrs: { color: '#F0A' } }),
      ],
    }),
  ],
  [
    'font sizes converted to the 0.75 to 3 rem window',
    doc({
      type: 'paragraph',
      content: [
        text('min', { type: 'textStyle', attrs: { fontSize: '12px' } }),
        text('max', { type: 'textStyle', attrs: { fontSize: '48px' } }),
        text('rem', { type: 'textStyle', attrs: { fontSize: '1.5rem' } }),
      ],
    }),
  ],
  [
    'safe http, https, site-relative and mailto addresses',
    doc({
      type: 'paragraph',
      content: [
        text('https', { type: 'link', attrs: { href: 'https://example.com/a?b=1#c' } }),
        text('http', { type: 'link', attrs: { href: 'http://example.com/' } }),
        text('relative', { type: 'link', attrs: { href: '/deep/path' } }),
        text('mailto', { type: 'link', attrs: { href: 'mailto:a@b.com' } }),
      ],
    }),
  ],
  [
    'link target and rel, including _blank gaining noopener noreferrer',
    doc({
      type: 'paragraph',
      content: [
        text('blank', { type: 'link', attrs: { href: '/a', target: '_blank' } }),
        text('blank plus nofollow', {
          type: 'link',
          attrs: { href: '/b', target: '_blank', rel: 'nofollow' },
        }),
        text('self', { type: 'link', attrs: { href: '/c', target: '_self', rel: 'noopener' } }),
        text('titled', { type: 'link', attrs: { href: '/d', rel: null, class: null, title: 'T' } }),
      ],
    }),
  ],
  [
    'mention identity with and without a label',
    doc(
      para(
        { type: 'mention', attrs: { id: 'user-7', label: 'Ada' } },
        { type: 'mention', attrs: { id: 'user-8' } },
      ),
    ),
  ],
  [
    'admonition types tip, info, warning and error',
    doc(
      {
        type: 'admonition',
        attrs: { type: 'tip' },
        content: [{ type: 'admonitionTitle', content: [text('t')] }, p('b')],
      },
      {
        type: 'admonition',
        attrs: { type: 'info' },
        content: [{ type: 'admonitionTitle' }, p('b')],
      },
      {
        type: 'admonition',
        attrs: { type: 'warning' },
        content: [{ type: 'admonitionTitle' }, p('b')],
      },
      {
        type: 'admonition',
        attrs: { type: 'error' },
        content: [{ type: 'admonitionTitle' }, p('b')],
      },
    ),
  ],
  [
    'details.open defaulted to false and explicitly kept true',
    doc(
      {
        type: 'details',
        content: [
          { type: 'detailsSummary', content: [text('closed')] },
          { type: 'detailsContent', content: [p('body')] },
        ],
      },
      {
        type: 'details',
        attrs: { open: true },
        content: [
          { type: 'detailsSummary', content: [text('open')] },
          { type: 'detailsContent', content: [p('body')] },
        ],
      },
    ),
  ],
  [
    'task items, hard breaks and horizontal rules',
    doc(
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [p('todo')] },
          { type: 'taskItem', attrs: { checked: true }, content: [p('done')] },
        ],
      },
      para(text('before'), { type: 'hardBreak' }, text('after')),
      { type: 'horizontalRule' },
      { type: 'blockquote', content: [p('quoted')] },
    ),
  ],
  [
    'nested bullet and ordered lists',
    doc({
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            p('one'),
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    p('one.a'),
                    {
                      type: 'bulletList',
                      content: [{ type: 'listItem', content: [p('one.a.i')] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            p('two'),
            {
              type: 'orderedList',
              attrs: { start: 3, type: 'i' },
              content: [{ type: 'listItem', content: [p('two.a')] }],
            },
          ],
        },
      ],
    }),
  ],
  [
    'a structurally complex document combining tables, lists, admonitions, code and marks',
    ((): Json =>
      doc(
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'center' },
          content: [text('Docs parity', { type: 'bold' })],
        },
        para(
          text(
            'bold and linked',
            { type: 'bold' },
            {
              type: 'link',
              attrs: { href: 'https://example.com/a?b=1#c', target: '_blank', title: 'Example' },
            },
          ),
          text(' styled', {
            type: 'textStyle',
            attrs: { color: '#ABC', backgroundColor: '#11223344', fontSize: '18px' },
          }),
          text(' highlighted', { type: 'highlight', attrs: { color: '#F0A' } }),
          { type: 'hardBreak' },
          { type: 'mention', attrs: { id: 'user-7', label: 'Ada' } },
          text(' inline code', { type: 'code' }),
          text(' trailing', { type: 'italic' }, { type: 'underline' }, { type: 'strike' }),
        ),
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                p('one'),
                { type: 'bulletList', content: [{ type: 'listItem', content: [p('one.a')] }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                p('two'),
                {
                  type: 'orderedList',
                  attrs: { start: 3, type: 'i' },
                  content: [{ type: 'listItem', content: [p('two.a')] }],
                },
              ],
            },
          ],
        },
        {
          type: 'taskList',
          content: [{ type: 'taskItem', attrs: { checked: true }, content: [p('done')] }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [text('const a = 1\nif (a) {\n  x()\n}\n')],
        },
        { type: 'blockquote', content: [p('quoted')] },
        {
          type: 'table',
          content: [
            row({
              type: 'tableHeader',
              attrs: { colspan: 2, colwidth: [120, 240], align: 'center' },
              content: [p('head')],
            }),
            row(
              { type: 'tableCell', attrs: { align: 'left' }, content: [p('a')] },
              {
                type: 'tableCell',
                attrs: { colwidth: [240], align: 'right' },
                content: [
                  p('b'),
                  { type: 'bulletList', content: [{ type: 'listItem', content: [p('nested')] }] },
                ],
              },
            ),
          ],
        },
        {
          type: 'details',
          attrs: { open: true },
          content: [
            { type: 'detailsSummary', content: [text('More', { type: 'italic' })] },
            {
              type: 'detailsContent',
              content: [
                {
                  type: 'admonition',
                  attrs: { type: 'warning' },
                  content: [
                    { type: 'admonitionTitle', content: [text('Careful', { type: 'underline' })] },
                    p('outer body'),
                    {
                      type: 'admonition',
                      attrs: { type: 'tip' },
                      content: [
                        { type: 'admonitionTitle', content: [text('Inner', { type: 'strike' })] },
                        p('inner body'),
                      ],
                    },
                  ],
                },
                { type: 'horizontalRule' },
              ],
            },
          ],
        },
        {
          type: 'image',
          attrs: { src: '/uploads/a.png', alt: '', title: 'Title', width: 640, height: 480 },
        },
      ))(),
  ],
]

describe('value-domain parity: documents both validators accept', () => {
  // 只比较接受/拒绝会让规范化漂移溜过去；接受的样本还要求两侧产出同一份文档。
  it.each(accepted)('accepts %s and normalises it identically', (_name, sample) => {
    expect(browserRun(sample)).toEqual({ accepted: true })
    expect(serverRun(sample)).toEqual({ accepted: true })
    expect(serverNormalized(sample)).toEqual(browserNormalized(sample))
  })
})

// --- 双方都拒绝 -------------------------------------------------------------
// 只有"都拒绝"被断言：浏览器有 5 个 issue code、Docs 有 4 个错误码，
// 同一类失败落到哪个码上不完全一致（例如空 attrs 在浏览器是 invalid-content、
// 在 Docs 是 DOCS_UNSUPPORTED_CONTENT）。落码差异属于实现细节，判定一致才是门禁。

const rejected: Array<[string, Json]> = [
  ['heading level 5', doc({ type: 'heading', attrs: { level: 5 }, content: [text('h')] })],
  ['heading level 0', doc({ type: 'heading', attrs: { level: 0 }, content: [text('h')] })],
  [
    'unknown paragraph text alignment',
    doc({ type: 'paragraph', attrs: { textAlign: 'start' }, content: [text('x')] }),
  ],
  [
    'cell alignment justify',
    doc({ type: 'table', content: [row(cell({ align: 'justify' }, p('x')))] }),
  ],
  ['colspan below 1', doc({ type: 'table', content: [row(cell({ colspan: 0 }, p('x')))] })],
  [
    'colspan above 10 000',
    doc({ type: 'table', content: [row(cell({ colspan: 10_001 }, p('x')))] }),
  ],
  ['non-integer colspan', doc({ type: 'table', content: [row(cell({ colspan: 1.5 }, p('x')))] })],
  [
    'rowspan beyond the table height',
    doc({ type: 'table', content: [row(cell({ rowspan: 2 }, p('x')))] }),
  ],
  [
    'colwidth length not matching colspan',
    doc({ type: 'table', content: [row(cell({ colspan: 2, colwidth: [120] }, p('x')))] }),
  ],
  [
    'colwidth above 8 192',
    doc({ type: 'table', content: [row(cell({ colwidth: [8193] }, p('x')))] }),
  ],
  [
    'non-integer colwidth',
    doc({ type: 'table', content: [row(cell({ colwidth: [12.5] }, p('x')))] }),
  ],
  ['image width below 1', doc({ type: 'image', attrs: { src: '/a.png', width: 0 } })],
  ['image width above 8 192', doc({ type: 'image', attrs: { src: '/a.png', width: 8193 } })],
  ['image without a source', doc({ type: 'image' })],
  [
    'unknown ordered list type',
    doc({
      type: 'orderedList',
      attrs: { type: 'x' },
      content: [{ type: 'listItem', content: [p('x')] }],
    }),
  ],
  [
    'ordered list start below 1',
    doc({
      type: 'orderedList',
      attrs: { start: 0 },
      content: [{ type: 'listItem', content: [p('x')] }],
    }),
  ],
  [
    'unknown admonition type',
    doc({
      type: 'admonition',
      attrs: { type: 'danger' },
      content: [{ type: 'admonitionTitle' }, p('b')],
    }),
  ],
  [
    'admonition without a title',
    doc({ type: 'admonition', attrs: { type: 'info' }, content: [p('b')] }),
  ],
  ['named CSS colour', doc(para(text('x', { type: 'textStyle', attrs: { color: 'red' } })))],
  [
    'hex colour with a css var',
    doc(para(text('x', { type: 'textStyle', attrs: { color: 'var(--x)' } }))),
  ],
  ['font size in pt', doc(para(text('x', { type: 'textStyle', attrs: { fontSize: '12pt' } })))],
  [
    'font size above the rem window',
    doc(para(text('x', { type: 'textStyle', attrs: { fontSize: '100px' } }))),
  ],
  [
    'font size below the rem window',
    doc(para(text('x', { type: 'textStyle', attrs: { fontSize: '8px' } }))),
  ],
  [
    'javascript link',
    doc(para(text('x', { type: 'link', attrs: { href: 'javascript:alert(1)' } }))),
  ],
  ['protocol-relative image', doc({ type: 'image', attrs: { src: '//evil.test/x.png' } })],
  ['mailto image', doc({ type: 'image', attrs: { src: 'mailto:a@b.com' } })],
  // 不是差异：浏览器在 `allowRasterDataImages` 未打开时同样关闭 data image，
  // 因此 `{}` 策略下两侧都拒绝，不需要占用 divergences 表。
  ['data image url', doc({ type: 'image', attrs: { src: 'data:image/png;base64,AAAA' } })],
  [
    'credentialed link',
    doc(para(text('x', { type: 'link', attrs: { href: 'https://u:p@example.com/' } }))),
  ],
  [
    'link target _parent',
    doc(para(text('x', { type: 'link', attrs: { href: '/a', target: '_parent' } }))),
  ],
  [
    'unknown link rel token',
    doc(para(text('x', { type: 'link', attrs: { href: '/a', rel: 'evil' } }))),
  ],
  [
    'link class is not a document attribute',
    doc(para(text('x', { type: 'link', attrs: { href: '/a', class: 'c' } }))),
  ],
  // 不是差异：JS 的 `\w` 本身就是 ASCII `[A-Za-z0-9_]`，浏览器正则与 Docs 的
  // `^[A-Za-z0-9_+\-]*$` 等价，两侧同样拒绝非 ASCII 语言名。
  [
    'code block language with non-ascii letters',
    doc({ type: 'codeBlock', attrs: { language: '中文' }, content: [text('x')] }),
  ],
  [
    'code block language with a space',
    doc({ type: 'codeBlock', attrs: { language: 'a b' }, content: [text('x')] }),
  ],
  ['unknown node type', doc({ type: 'mystery' } as unknown as Json)],
  ['unknown mark type', doc(para(text('x', { type: 'blink' })))],
  [
    'unknown attribute',
    doc({ type: 'paragraph', attrs: { textAlign: null, extra: 1 }, content: [text('x')] }),
  ],
  ['empty text node', doc(para({ type: 'text', text: '' } as unknown as Json))],
  ['blank mention id', doc(para({ type: 'mention', attrs: { id: ' ' } }))],
  ['non-string mention label', doc(para({ type: 'mention', attrs: { id: 'u', label: 5 } }))],
  [
    'non-boolean task item checked',
    doc({
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: 'true' }, content: [p('x')] }],
    }),
  ],
  [
    'non-boolean details open',
    doc({
      type: 'details',
      attrs: { open: 'true' },
      content: [
        { type: 'detailsSummary', content: [text('s')] },
        { type: 'detailsContent', content: [p('b')] },
      ],
    }),
  ],
  [
    'details without detailsContent',
    doc({ type: 'details', content: [{ type: 'detailsSummary', content: [text('s')] }] }),
  ],
  [
    'an empty table row nothing covers',
    doc({ type: 'table', content: [row(cell({}, p('x'))), row()] }),
  ],
  [
    'a ragged table grid',
    doc({
      type: 'table',
      content: [row(cell({}, p('x')), cell({}, p('y'))), row(cell({}, p('z')))],
    }),
  ],
  [
    'a table cell pushed out of the grid',
    doc({
      type: 'table',
      content: [
        row(cell({ colspan: 1, rowspan: 2 }, p('a')), cell({}, p('b'))),
        row(cell({ colspan: 2 }, p('c'))),
      ],
    }),
  ],
  ['a hard break carrying text', doc(para({ type: 'hardBreak', text: 'x' } as unknown as Json))],
  [
    'a block image inside a heading',
    doc({ type: 'heading', content: [{ type: 'image', attrs: { src: '/a.png' } }] }),
  ],
  [
    'a text node carrying attributes',
    doc(para({ type: 'text', text: 'x', attrs: {} } as unknown as Json)),
  ],
  // 不是差异：浏览器靠 `Node.check()` 里 `Mark.sameSet` 的比对拒绝重复与互斥 Mark，
  // Docs 在值域层直接拒绝，两侧判定相同。
  ['duplicate marks of the same type', doc(para(text('x', { type: 'bold' }, { type: 'bold' })))],
  ['the code mark combined with bold', doc(para(text('x', { type: 'code' }, { type: 'bold' })))],
  ['bold combined with the code mark', doc(para(text('x', { type: 'bold' }, { type: 'code' })))],
]

describe('value-domain parity: documents both validators reject', () => {
  it.each(rejected)('rejects %s', (_name, sample) => {
    expect(browserRun(sample).accepted).toBe(false)
    expect(serverRun(sample).accepted).toBe(false)
  })
})

// --- 已确认的差异 -----------------------------------------------------------

interface Divergence {
  /** 差异的名字，也是测试名。 */
  name: string
  /** 为什么这是设计上的差异，而不是某一侧的缺陷。 */
  why: string
  sample: Json
  browser: Outcome
  server: Outcome
}

/**
 * 两侧**已知且经实际运行确认**会给出不同结果的样本。
 *
 * 每一行都必须写清为什么：内容附录把这些加严项（整篇累计网格、严格原始 JSON 字段、
 * JSONB 存储门禁）与零宽表的错误分类差异都列为 Docs 的显式决定。把它们固定在这里，
 * 是为了让"其余样本完全一致"这句话有可核对的边界，而不是用宽松的范围相等掩盖它们。
 */
const divergences: Divergence[] = [
  {
    name: 'a zero-width table is a structural error in Docs, a limit in the browser',
    why: '内容附录第 3 节把它们列为显式错误分类差异：浏览器把零宽表归 limit-exceeded，Docs profile 1 按结构错误返回 400。两侧都拒绝，但类别不同。',
    sample: doc({ type: 'table', content: [row()] }),
    browser: { accepted: false, code: 'limit-exceeded' },
    server: { accepted: false, code: 'DOCS_INVALID_CONTENT' },
  },
  {
    name: 'a cumulative virtual grid over 10 000 cells across two tables',
    why: '整篇累计网格是 Docs 额外增加的资源边界（内容附录第 5 节）；浏览器逐表检查，两张各 6 000 格的表都能通过它的逐表门禁。这里用 colspan 撑大网格，节点数只有几百，触发的确实是累计网格而不是节点预算。',
    sample: doc(wideTable(60, 100), wideTable(60, 100)),
    browser: { accepted: true },
    server: { accepted: false, code: 'DOCS_LIMIT_EXCEEDED' },
  },
  {
    name: 'a NUL byte in a stored string',
    why: 'PostgreSQL jsonb 不能保存 NUL（内容附录第 4 节）。Docs 在 JSON 预检里对所有字符串显式拒绝，浏览器没有这条门禁；同样的字符串出现在 image alt/title/label 上也一样被 Docs 拒绝。',
    sample: doc(para(text('a\u0000b'))),
    browser: { accepted: true },
    server: { accepted: false, code: 'DOCS_INVALID_CONTENT' },
  },
  {
    name: 'an unpaired UTF-16 surrogate in a stored string',
    why: '未配对 surrogate 同样不能进入 jsonb。Docs 用 `encodeURIComponent` 显式探测并拒绝，浏览器用 TextEncoder 静默替换成 U+FFFD 后接受。',
    sample: doc(para(text('a\ud800b'))),
    browser: { accepted: true },
    server: { accepted: false, code: 'DOCS_INVALID_CONTENT' },
  },
  {
    name: 'an empty attrs object on a node that declares none',
    why: 'Docs 对原始 JSON 字段是严格封闭的：没有声明属性的节点出现显式 attrs 就是未知字段，不能以"规范化后为空"为由接受。浏览器把空 attrs 当成缺省直接丢掉。',
    sample: doc(para({ type: 'hardBreak', attrs: {} } as unknown as Json)),
    browser: { accepted: true },
    server: { accepted: false, code: 'DOCS_UNSUPPORTED_CONTENT' },
  },
  {
    name: 'an empty attrs object on the doc root',
    why: '根不允许 attrs（内容附录第 3 节）。浏览器的 `visit` 不区分根节点，同样把空 attrs 当作缺省丢弃。',
    sample: { type: 'doc', content: [p('x')], attrs: {} },
    browser: { accepted: true },
    server: { accepted: false, code: 'DOCS_UNSUPPORTED_CONTENT' },
  },
]

describe('value-domain parity: divergences are enumerated, not averaged away', () => {
  it.each(divergences)('diverges on $name', ({ sample, browser, server }) => {
    expect(browserRun(sample)).toEqual(browser)
    expect(serverRun(sample)).toEqual(server)
  })

  it('keeps the divergence table to the confirmed rows only', () => {
    // 用样本名字把这张表钉住：新增或关闭一条差异都必须同时改这张表，不能悄悄扩大范围。
    expect(divergences.map(({ name }) => name)).toEqual([
      'a zero-width table is a structural error in Docs, a limit in the browser',
      'a cumulative virtual grid over 10 000 cells across two tables',
      'a NUL byte in a stored string',
      'an unpaired UTF-16 surrogate in a stored string',
      'an empty attrs object on a node that declares none',
      'an empty attrs object on the doc root',
    ])
  })
})
