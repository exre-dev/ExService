<!-- Generated from resources/components/data-grid/c-data-grid-31.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Spreadsheet Editing

> Data grid with spreadsheet editing

- Type: example, free and open source (MIT)
- Component: [Data Grid](../data-grid.md)
- Page: [local reference](./c-data-grid-31.md)
- Uses: Alert Dialog, Avatar, Badge, Button, Calendar, Card, Combobox, Context Menu, Data Grid, Popover, Select, Toast

## Best for

A product sheet with range selection, a fill handle, paste, built-in and custom cell editors and a right-click menu

## Agent notes

- Persist cell edits in `updateRows`, which paste, fill and every editor reach; `handleRowCreate`, `duplicateRow` and `deleteRow` call `setData` directly
- `autoResetPageIndex` stays false so a commit on page 2 does not snap back to page 1 each time `setData` replaces the rows

## Third-party libraries

- TanStack Table v9: [API reference](https://tanstack.com/table/v9/docs/framework/react/reference/index), [docs](https://tanstack.com/table/v9/docs/framework/react/quick-start)
- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)
- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start), through shadcn Calendar

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
