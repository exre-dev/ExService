<!-- Generated from resources/components/data-grid/c-data-grid-27.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Local Infinite Scroll

> Data grid with local infinite scroll

- Type: example, free and open source (MIT)
- Component: [Data Grid](../data-grid.md)
- Page: [local reference](./c-data-grid-27.md)
- Uses: Avatar, Badge, Button, Card, Data Grid

## Best for

A list of 200 in-memory rows windowed by a row virtualizer in a 480px box, with a sticky header and no pager

## Agent notes

- `allData` comes from `generateData`, whose `Math.random` balances change on every load; pass your own array instead

## When not to use

- Rows fetched from a server a page at a time during scrolling: use [Remote Infinite Scroll](./c-data-grid-28.md)
- Dozens of columns that also need windowing sideways: use [Column Virtualization](./c-data-grid-32.md)

## Third-party libraries

- TanStack Table v9: [API reference](https://tanstack.com/table/v9/docs/framework/react/reference/index), [docs](https://tanstack.com/table/v9/docs/framework/react/quick-start)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Data Grid

### When to use

- Admin and back office tables that sort, filter, paginate and select rows
- Spreadsheet style editing with cell selection, clipboard and inline edits
- Large record sets that need virtualized rows, columns or infinite scroll

### When not to use

- A short static list of rows with no sorting or paging: use [Table](../table.md)
- Records moved as cards between status columns: use [Kanban](../kanban.md)
- A folder or category hierarchy with no columns of data: use [Tree](../tree.md)

### Agent notes

- With `manualPagination`, pass the server total to `useTable` as `rowCount` as well as `recordCount`, or the page buttons never render
- Give `useTable` a stable `getRowId` whenever rows can be pinned, reordered or virtualized
- Swap `DataGridTable` for `DataGridTableVirtual` when rows need virtualization or infinite scroll
