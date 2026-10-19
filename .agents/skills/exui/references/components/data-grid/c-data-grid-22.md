<!-- Generated from resources/components/data-grid/c-data-grid-22.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn CRUD Admin

> Data grid with CRUD features

- Type: example, free and open source (MIT)
- Component: [Data Grid](../data-grid.md)
- Page: [local reference](./c-data-grid-22.md)
- Uses: Avatar, Badge, Button, Card, Checkbox, Data Grid, Dropdown Menu, Input Group, Label, Popover

## Best for

A user admin list with search, a status filter popover showing counts, row checkboxes and a row actions menu

## Agent notes

- Edit, Delete and Add new run no code; only Copy ID in `ActionsCell` acts, through `useCopyToClipboard`
- Search and the status checkboxes filter `demoData` into `filteredData` on the client, before the rows reach `useTable`
- Copy ID confirms with `toast` from `sonner`, which renders only in an app that mounts a Sonner Toaster

## When not to use

- A list that should match other Frame panels on the same page: use [CRUD in Frame](./c-data-grid-23.md)

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
