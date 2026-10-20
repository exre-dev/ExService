import { describe, expect, it } from 'vitest'
import { DOCS_CONTENT_LIMITS } from '@server/src/domains/docs/content/policy'
import { validateDocsContent } from '@server/src/domains/docs/content/validation'

/**
 * 8 MiB 内容预算的"输入 / 规范化后"边界与最坏规模耗时。
 *
 * 预算量的是**规范化后**的紧凑 UTF-8 字节，不是输入的 `Content-Length`、JS 字符数或
 * jsonb 物理大小。规范化会补默认属性、展开颜色、补 `rel`，因此输入略小于 8 MiB 也可能
 * 越界；末尾补齐的 paragraph 同样计入预算。最坏规模用例给出可复核的耗时上界。
 */

const LIMIT = DOCS_CONTENT_LIMITS.bytes

function textDoc(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

function headingDoc(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] }],
  }
}

const normalizedBytes = (doc: unknown) =>
  Buffer.byteLength(JSON.stringify(validateDocsContent(doc).content))

/** 以 `textDoc` 为基准线性外推：正文每多一个 ASCII 字符，规范化字节也多一个。 */
function paragraphDocOfSize(target: number) {
  const base = normalizedBytes(textDoc('x'))
  return textDoc('x'.repeat(target - base + 1))
}

const APPENDED_PARAGRAPH = { type: 'paragraph', attrs: { textAlign: null } }
/** 末尾补一个 paragraph 时序列化结果增加的字节：一个逗号加上节点本身。 */
const APPEND_BYTES = 1 + Buffer.byteLength(JSON.stringify(APPENDED_PARAGRAPH))

function expectDocsLimitExceeded(run: () => unknown) {
  let error: unknown
  try {
    run()
  } catch (caught) {
    error = caught
  }
  expect(error, 'expected DOCS_LIMIT_EXCEEDED').toMatchObject({
    code: 'DOCS_LIMIT_EXCEEDED',
    statusCode: 413,
  })
}

/** 统计节点数（doc 根算一个节点，Mark 不计），用于自校验构造出的文档确实撞上目标预算。 */
function countNodes(value: unknown): number {
  let total = 1
  const walk = (node: unknown): void => {
    const children = (node as { content?: unknown }).content
    if (!Array.isArray(children)) return
    for (const child of children) {
      total += 1
      walk(child)
    }
  }
  walk(value)
  return total
}

/**
 * 用跨度构造虚拟网格，节点数远低于节点预算。
 *
 * 早期版本用"每张表 5,000 个单元格"证明累计网格，实测那份文档有 20,103 个节点，
 * 在节点预算处就被拒，累计网格从未被触达。这里改为 `colspan` 放大列宽，
 * 让节点数与虚拟网格解耦，并在每条断言前自校验节点数确实远低于节点预算。
 */
function spanTable(cells: number, span: number) {
  return {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: Array.from({ length: cells }, () => ({
          type: 'tableCell',
          attrs: { colspan: span },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
        })),
      },
    ],
  }
}

const gridDoc = (...tables: unknown[]) => ({ type: 'doc', content: tables })

/** 虚拟网格上界：单表与整篇累计共用同一个 10,000。 */
function expectUnderNodeBudget(doc: unknown, cells: number) {
  const nodes = countNodes(doc)
  expect(nodes, `grid fixture (${cells} cells) must stay far below the node budget`).toBeLessThan(
    DOCS_CONTENT_LIMITS.nodes / 10,
  )
  return nodes
}

describe('8 MiB 预算量的是规范化后的字节', () => {
  it('accepts a document whose normalized form is exactly at the budget', () => {
    const doc = paragraphDocOfSize(LIMIT)
    // 自校验：构造出的文档规范化后确实是 8,388,608 字节，边界不是猜出来的。
    expect(normalizedBytes(doc)).toBe(LIMIT)
    expect(() => validateDocsContent(doc)).not.toThrow()
  })

  it('rejects one normalized byte more even while the input is still under 8 MiB', () => {
    const accepted = paragraphDocOfSize(LIMIT)
    const rejected = paragraphDocOfSize(LIMIT + 1)
    // 输入仍然小于 8 MiB——规范化补入的 `attrs` 才是越界的原因。
    expect(Buffer.byteLength(JSON.stringify(rejected))).toBeLessThan(LIMIT)
    expect(Buffer.byteLength(JSON.stringify(rejected))).toBe(
      Buffer.byteLength(JSON.stringify(accepted)) + 1,
    )
    expectDocsLimitExceeded(() => validateDocsContent(rejected))
  })

  it('counts the trailing paragraph it appends against the same budget', () => {
    // 以 heading 结尾的文档会被补一个 paragraph；补齐后的总字节仍受同一个 8 MiB 约束。
    const oneChar = normalizedBytes(headingDoc('x'))
    // 正文每多一个 ASCII 字符，补段落前后的字节都多一个。
    const fittingLength = LIMIT - oneChar + 1
    const fitting = headingDoc('x'.repeat(fittingLength))
    expect(normalizedBytes(fitting)).toBe(LIMIT)
    expect(() => validateDocsContent(fitting)).not.toThrow()

    // 再多 APPEND_BYTES 个字符时，补段落之前就已等于预算，补齐后必然越界。
    const rejected = headingDoc('x'.repeat(fittingLength + APPEND_BYTES))
    const rejectedInput = Buffer.byteLength(JSON.stringify(rejected))
    // 被拒文档的输入仍小于 8 MiB：越界来自规范化与补齐，不是输入本身。
    expect(rejectedInput).toBeLessThan(LIMIT)
    expect(rejectedInput + APPEND_BYTES).toBeGreaterThan(LIMIT - APPEND_BYTES)
    expectDocsLimitExceeded(() => validateDocsContent(rejected))
  })
})

describe('最坏规模的内容仍在有界时间内完成', () => {
  /** 断言规模确实达到声明的边界，并给出可复核的耗时上界。 */
  function timed(name: string, limitMs: number, run: () => unknown) {
    const started = performance.now()
    const result = run()
    const elapsed = performance.now() - started
    expect(elapsed, `${name} exceeded ${limitMs}ms`).toBeLessThan(limitMs)
    return { name, elapsed, result }
  }

  it('validates the maximum node count, depth, marks and grid within bounded time', () => {
    const measurements: Array<{ name: string; elapsed: number }> = []

    // 10,000 个节点：doc + 4,999 个 paragraph/text 对 + 末尾一个空 paragraph。
    const maxNodes = {
      type: 'doc',
      content: [
        ...Array.from({ length: 4_999 }, () => ({
          type: 'paragraph',
          content: [{ type: 'text', text: 'x' }],
        })),
        { type: 'paragraph' },
      ],
    }
    const nodes = timed('10,000 nodes', 30_000, () => validateDocsContent(maxNodes))
    expect(nodes.result).toBeTruthy()
    measurements.push({ name: nodes.name, elapsed: nodes.elapsed })

    // 深度 32：`listItem` 的内容是 `paragraph block*`，每层必须自带一个 paragraph。
    let deepest: Record<string, unknown> = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'deep' }],
    }
    for (let level = 0; level < 15; level++) {
      deepest = {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'l' }] }, deepest],
          },
        ],
      }
    }
    const depth = timed('depth 32', 5_000, () =>
      validateDocsContent({ type: 'doc', content: [deepest] }),
    )
    measurements.push({ name: depth.name, elapsed: depth.elapsed })
    // 再加一层就超出深度预算。
    expectDocsLimitExceeded(() =>
      validateDocsContent({
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph' }, deepest] }],
          },
        ],
      }),
    )

    // 每个文本节点 7 类共存的 Mark（`code` 排他），Mark 不占用节点预算。
    const marks = ['textStyle', 'bold', 'italic', 'strike', 'underline', 'highlight']
      .map((type) =>
        type === 'textStyle' ? { type, attrs: { color: '#abc', fontSize: '20px' } } : { type },
      )
      .concat({ type: 'link', attrs: { href: '/safe', target: '_blank' } })
    const maxMarks = {
      type: 'doc',
      content: Array.from({ length: 4_999 }, () => ({
        type: 'paragraph',
        content: [{ type: 'text', text: 'x', marks }],
      })).concat({ type: 'paragraph' }),
    }
    const markRun = timed('10,000 nodes × 7 marks', 30_000, () => validateDocsContent(maxMarks))
    measurements.push({ name: markRun.name, elapsed: markRun.elapsed })

    // 网格预算受节点预算夹住：单行 3,332 个单元格连同必需的 paragraph/text 正好用满 10,000 节点。
    const maxGrid = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: Array.from({ length: 3_332 }, () => ({
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
              })),
            },
          ],
        },
      ],
    }
    const grid = timed('3,332 table cells', 30_000, () => validateDocsContent(maxGrid))
    measurements.push({ name: grid.name, elapsed: grid.elapsed })
    expect(measurements.map(({ name }) => name)).toEqual([
      '10,000 nodes',
      'depth 32',
      '10,000 nodes × 7 marks',
      '3,332 table cells',
    ])
  })

  it('bounds the per-table and cumulative virtual grid with spans instead of cells', () => {
    const grid = DOCS_CONTENT_LIMITS.cumulativeGrid
    expect(grid).toBe(10_000)
    expect(DOCS_CONTENT_LIMITS.gridPerTable).toBe(10_000)

    // 单表 10,000 格：100 个 `colspan: 100` 的单元格，节点数与网格解耦。
    const single = gridDoc(spanTable(100, 100))
    expectUnderNodeBudget(single, 10_000)
    expect(() => validateDocsContent(single)).not.toThrow()

    // 单表 20,000 格：超过单表上界。
    const singleOver = gridDoc(spanTable(200, 100))
    expectUnderNodeBudget(singleOver, 20_000)
    expectDocsLimitExceeded(() => validateDocsContent(singleOver))

    // 累计 10,000 格：两张表各 5,000，恰好等于上界（`total > 10_000` 才拒绝）。
    const cumulative = gridDoc(spanTable(50, 100), spanTable(50, 100))
    expectUnderNodeBudget(cumulative, 10_000)
    expect(() => validateDocsContent(cumulative)).not.toThrow()

    // 累计 10,001 格：再补一个单格表，多出的恰好是一格。
    const oneMore = gridDoc(spanTable(50, 100), spanTable(50, 100), spanTable(1, 1))
    expectUnderNodeBudget(oneMore, 10_001)
    expectDocsLimitExceeded(() => validateDocsContent(oneMore))
  })

  it('validates a document at the full 8 MiB content budget within bounded time', () => {
    const doc = paragraphDocOfSize(LIMIT)
    const started = performance.now()
    const result = validateDocsContent(doc)
    const elapsed = performance.now() - started
    expect(Buffer.byteLength(JSON.stringify(result.content))).toBe(LIMIT)
    expect(Buffer.byteLength(result.textContent, 'utf8')).toBeLessThanOrEqual(LIMIT)
    // 8 MiB 正文会被完整序列化三次并额外走一遍字符串预检；上界取 30 秒只用于兜住失控实现。
    expect(elapsed, `8 MiB document took ${elapsed.toFixed(0)}ms`).toBeLessThan(30_000)
  })
})

/**
 * 拒绝侧的 ±1 边界。
 *
 * "恰好等于预算要接受"只钉住一侧：预算一旦被改动而用例仍只覆盖到它，回归不会拦住。
 * 这里对节点数、深度与 Mark 上限逐项断言"刚好接受 / 多一就拒绝"，
 * 并在每条断言前自校验构造出的规模确实是声明的那个数字。
 */
describe('预算的拒绝侧 ±1 边界', () => {
  const paragraph = (text = 'x') => ({ type: 'paragraph', content: [{ type: 'text', text }] })

  it('accepts 10,000 nodes and rejects 10,001', () => {
    const limit = DOCS_CONTENT_LIMITS.nodes
    expect(limit).toBe(10_000)

    // 9,999：doc + 4,999 个 paragraph/text 对，末尾已是 paragraph 因此不再补齐。
    const justUnder = { type: 'doc', content: Array.from({ length: 4_999 }, () => paragraph()) }
    expect(countNodes(justUnder)).toBe(limit - 1)
    expect(() => validateDocsContent(justUnder)).not.toThrow()

    // 10,000：同上再补一个空 paragraph（末尾补齐本身也计入节点预算）。
    const exact = {
      type: 'doc',
      content: [...Array.from({ length: 4_999 }, () => paragraph()), { type: 'paragraph' }],
    }
    expect(countNodes(exact)).toBe(limit)
    expect(() => validateDocsContent(exact)).not.toThrow()

    // 10,001：5,000 个 paragraph/text 对，末尾是 paragraph 因此没有额外补齐。
    const oneOver = { type: 'doc', content: Array.from({ length: 5_000 }, () => paragraph()) }
    expect(countNodes(oneOver)).toBe(limit + 1)
    expectDocsLimitExceeded(() => validateDocsContent(oneOver))
  })

  it('accepts a deepest node at depth 32 and rejects depth 33', () => {
    const limit = DOCS_CONTENT_LIMITS.depth
    expect(limit).toBe(32)

    /** `levels` 层 blockquote 之下：paragraph 在 `levels + 1` 层，text 在 `levels + 2` 层。 */
    const nested = (levels: number) => {
      let inner: Record<string, unknown> = paragraph('deep') as Record<string, unknown>
      for (let level = 0; level < levels; level += 1)
        inner = { type: 'blockquote', content: [inner] }
      return { type: 'doc', content: [inner] }
    }

    // 最深的节点（text）恰好在第 32 层：预算判据是 `depth > 32`，因此 32 仍被接受。
    expect(() => validateDocsContent(nested(limit - 2))).not.toThrow()
    expectDocsLimitExceeded(() => validateDocsContent(nested(limit - 1)))
  })

  it('accepts seven coexisting marks and rejects every way of exceeding them', () => {
    expect(DOCS_CONTENT_LIMITS.marksPerNode).toBe(8)

    // `code` 排除其他 Mark，因此可共存的上限是其余 7 类。
    const seven = [
      { type: 'textStyle', attrs: { color: '#abc', fontSize: '20px' } },
      { type: 'bold' },
      { type: 'italic' },
      { type: 'strike' },
      { type: 'underline' },
      { type: 'highlight', attrs: { color: '#abc' } },
      { type: 'link', attrs: { href: '/safe', target: '_blank' } },
    ]
    const withMarks = (marks: unknown[]) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks }] }],
    })
    expect(seven).toHaveLength(7)
    expect(() => validateDocsContent(withMarks(seven))).not.toThrow()
    // `code` 单独出现合法，只是不能与其他 Mark 共存。
    expect(() => validateDocsContent(withMarks([{ type: 'code' }]))).not.toThrow()

    const invalid = (marks: unknown[], name: string) => {
      let error: unknown
      try {
        validateDocsContent(withMarks(marks))
      } catch (caught) {
        error = caught
      }
      expect(error, name).toMatchObject({ code: 'DOCS_INVALID_CONTENT', statusCode: 400 })
    }
    // 8 类里含 code：与其余 Mark 互斥。
    invalid([...seven, { type: 'code' }], 'code mixed with others')
    // 重复 Mark 明确拒绝，不靠合并或丢弃修复。
    invalid([...seven, { type: 'bold' }], 'duplicate mark')
    // 9 类：超过每节点 Mark 上限。
    invalid([...seven, { type: 'bold' }, { type: 'code' }], 'nine marks')
  })
})
