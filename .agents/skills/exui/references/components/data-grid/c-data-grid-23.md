<!-- Generated from resources/components/data-grid/c-data-grid-23.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn CRUD in Frame

> Data grid with CRUD in frame container

- Type: example, free and open source (MIT)
- Component: [Data Grid](../data-grid.md)
- Page: [local reference](./c-data-grid-23.md)
- Uses: Avatar, Badge, Button, Checkbox, Data Grid, Dropdown Menu, Frame, Input Group, Label, Popover

## Best for

Search, a status filter and row actions in a dense stacked Frame titled Team members, with no column resizing

## Agent notes

- `ActionsCell` wires only Copy ID; its Edit and Delete items and the Add new button call nothing yet
- The search box and status filter narrow `demoData` in `filteredData`, so swap them for query params when rows come from an API

## When not to use

- Column widths the user drags to resize: use [CRUD Admin](./c-data-grid-22.md)

## Third-party libraries

- TanStack Table v9: [API reference](https://tanstack.com/table/v9/docs/framework/react/reference/index), [docs](https://tanstack.com/table/v9/docs/framework/react/quick-start)
- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started)

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
