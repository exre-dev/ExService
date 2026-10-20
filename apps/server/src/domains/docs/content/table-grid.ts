import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { DOCS_CONTENT_LIMITS, fail } from './policy.js'

/**
 * 整篇所有表累计的虚拟网格预算。
 *
 * 浏览器侧只逐表检查；Docs 额外要求整篇累计不超过同一上界，
 * 因此这里必须跨表累加，超限是资源错误（413）而不是结构错误。
 */
export interface GridBudget {
  add(cells: number): void
}

export function createGridBudget(): GridBudget {
  let total = 0
  return {
    add(cells: number): void {
      total += cells
      if (total > DOCS_CONTENT_LIMITS.cumulativeGrid) fail('DOCS_LIMIT_EXCEEDED')
    },
  }
}

/**
 * 校验一张表的完整逻辑网格。
 *
 * 首行正宽度之和为基准宽度；迭代把每个单元格放到当前行首个未占据列，
 * 最终所有逻辑槽必须恰好占据一次。上方单元格的 rowspan 可以覆盖后续行的全部逻辑列，
 * 因此被完整覆盖的空 tableRow 合法，不能仅因 `childCount === 0` 拒绝；
 * 没有前方跨度覆盖的空行留下缺格，与重叠、越界一样是结构错误（400）。
 * 零宽表在 Docs profile 1 也归结构错误，这与浏览器把它算作超限是显式分类差异。
 */
export function validateTableGrid(table: ProseMirrorNode, budget: GridBudget): void {
  let width = 0
  table.firstChild?.forEach((cell) => {
    width += Number(cell.attrs.colspan)
  })
  const height = table.childCount
  if (!width) fail('DOCS_INVALID_CONTENT')
  if (width * height > DOCS_CONTENT_LIMITS.gridPerTable) fail('DOCS_LIMIT_EXCEEDED')
  budget.add(width * height)
  const occupied = new Uint8Array(width * height)
  table.forEach((row, _offset, y) => {
    let x = 0
    row.forEach((cell) => {
      while (x < width && occupied[y * width + x]) x += 1
      const colspan = Number(cell.attrs.colspan)
      const rowspan = Number(cell.attrs.rowspan)
      if (x + colspan > width || y + rowspan > height) fail('DOCS_INVALID_CONTENT')
      for (let dy = 0; dy < rowspan; dy += 1) {
        for (let dx = 0; dx < colspan; dx += 1) {
          const slot = (y + dy) * width + x + dx
          if (occupied[slot]) fail('DOCS_INVALID_CONTENT')
          occupied[slot] = 1
        }
      }
      x += colspan
    })
  })
  if (occupied.includes(0)) fail('DOCS_INVALID_CONTENT')
}
