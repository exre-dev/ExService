<!-- Generated from resources/components/data-grid/c-data-grid-13.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Draggable Columns

> Data grid with draggable columns

- Type: example, free and open source (MIT)
- Component: [Data Grid](../data-grid.md)
- Page: [local reference](./c-data-grid-13.md)
- Uses: Avatar, Badge, Data Grid

## Best for

Headers dragged sideways to reorder columns, with the new order applied by an arrayMove handler

## Agent notes

- `DataGridTableDnd` sorts over `columnOrder` and writes nothing itself, so seed that state with every column `id` and update it in `handleDragEnd`

## When not to use

- Column moves made from a header menu with no pointer drag: use [Movable Columns](./c-data-grid-12.md)

## Third-party libraries

- TanStack Table v9: [API reference](https://tanstack.com/table/v9/docs/framework/react/reference/index), [docs](https://tanstack.com/table/v9/docs/framework/react/quick-start)
- dnd kit v6: [API reference](https://dndkit.com/legacy/api-documentation/context-provider/dnd-context/), [docs](https://dndkit.com/legacy/introduction/getting-started/) (these are the Legacy docs; dndkit.com's default docs cover the newer @dnd-kit/react, a different API)

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
