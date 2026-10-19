<!-- Generated from resources/components/data-grid.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Data Grid

> Open-source shadcn data grid components for sorting and filtering, virtualized tables, and admin dashboards.

- Type: upstream component, free
- Page: [local reference](./data-grid.md)
- Examples: 34

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Compact component padding

ExUI uses `1rem` padding (16px at a 16px root) for default Card insets, all sides of `AlertDialogContent`, `SheetHeader` and `SheetFooter`, vertical padding in `CommandEmpty` and DataGrid empty-table/filter messages, all sides of Gantt's no-resource message, and bottom padding between vertical `TimelineItem` entries. Empty-state padding appears only when that state is rendered; Timeline's last item has no added bottom padding. Caller classes can override these defaults.

Card's default and `sm` sizes both use `1rem` insets. `--card-spacing` controls those insets; `--card-gap` controls the separate section gap, which remains `1.5rem` by default and `1rem` for `sm`. Header bottom and Footer top insets appear when the corresponding border is added; a leading image still removes the Card's top inset.

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `DataGridContainer`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { DataGridContainer } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof DataGridContainer>) {
  return <DataGridContainer {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.

**ExUI addition**

### Bundled chart and table runtimes

Import `Recharts` and `TanStackTable` from the root package when composing ExUI charts or DataGrid. These namespaces use the same bundled instances as ExUI's components. The wrapped Recharts axes, tooltip and legend scale their omitted numeric defaults with the document root font. `TanStackTable.useTable` and its app hooks do the same for omitted column sizes. Explicit numeric sizes are pixels; bare non-React `constructTable` retains its upstream pixel defaults.

```tsx verify
import { Recharts, TanStackTable } from '@exre/exui'

export const ExuiXAxis = Recharts.XAxis
export const ExuiTableHook = TanStackTable.useTable
```

<!-- exui-capabilities:end:skill -->

## When to use

- Admin and back office tables that sort, filter, paginate and select rows
- Spreadsheet style editing with cell selection, clipboard and inline edits
- Large record sets that need virtualized rows, columns or infinite scroll

## When not to use

- A short static list of rows with no sorting or paging: use [Table](./table.md)
- Records moved as cards between status columns: use [Kanban](./kanban.md)
- A folder or category hierarchy with no columns of data: use [Tree](./tree.md)

## Agent notes

- With `manualPagination`, pass the server total to `useTable` as `rowCount` as well as `recordCount`, or the page buttons never render
- Give `useTable` a stable `getRowId` whenever rows can be pinned, reordered or virtualized
- Swap `DataGridTable` for `DataGridTableVirtual` when rows need virtualization or infinite scroll

## Third-party libraries

- TanStack Table v9: [API reference](https://tanstack.com/table/v9/docs/framework/react/reference/index), [docs](https://tanstack.com/table/v9/docs/framework/react/quick-start)
- TanStack Virtual v3: [API reference](https://tanstack.com/virtual/v3/docs/api/virtualizer), [docs](https://tanstack.com/virtual/v3/docs/introduction)
- dnd kit v6: [API reference](https://dndkit.com/legacy/api-documentation/context-provider/dnd-context/), [docs](https://dndkit.com/legacy/introduction/getting-started/) (these are the Legacy docs; dndkit.com's default docs cover the newer @dnd-kit/react, a different API)
- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt)
- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 4 of 34 examples
- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started), used by 1 of 34 examples
- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start), used by 1 of 34 examples
- Class Variance Authority: [API reference](https://cva.style/api-reference/), [docs](https://cva.style/), used by 1 of 34 examples

## Examples

- [Pagination](./data-grid/c-data-grid-1.md): Data grid with pagination. Best for a starting point for client side paging over an in-memory list of users.
- [Cell Borders](./data-grid/c-data-grid-2.md): Data grid with cell border. Best for vertical lines between columns as well as rows, with the table set in a Card and the pager below it.
- [Dense Layout](./data-grid/c-data-grid-3.md): Data grid with dense layout. Best for shorter rows and tighter cell padding that fit more records into the same height.
- [Borderless](./data-grid/c-data-grid-4.md): Data grid without table borders. Best for rows with no divider lines, rounded row ends and a colored presence dot on each avatar.
- [Striped Rows](./data-grid/c-data-grid-5.md): Data grid with striped rows. Best for alternating shaded rows with rounded ends that help the eye follow a record across columns.
- [Auto Width](./data-grid/c-data-grid-6.md): Data grid with auto width table layout. Best for columns that size to their content under an auto table layout, leaving each column size unused.
- [Row Selection](./data-grid/c-data-grid-7.md): Data grid with row selection. Best for a checkbox per row plus a header checkbox that selects the current page, held in controlled state.
- [Expandable Rows](./data-grid/c-data-grid-8.md): Data grid with expandable rows. Best for a chevron toggle that opens a short text note under each row, drawn by the column expanded content.
- [Sub Table](./data-grid/c-data-grid-9.md): Data grid with sub table. Best for order rows that expand into a nested grid of line items, each with its own sorting and paging.
- [Column Icons](./data-grid/c-data-grid-10.md): Data grid with column icons. Best for an icon beside each header title, with sorting switched off so every header is a static label.
- [Sortable Columns](./data-grid/c-data-grid-11.md): Data grid with sortable columns. Best for header buttons that step each column through ascending, descending and unsorted, with an arrow.
- [Movable Columns](./data-grid/c-data-grid-12.md): Data grid with movable columns. Best for a header menu with sort entries plus Move to left and Move to right for reordering columns.
- [Draggable Columns](./data-grid/c-data-grid-13.md): Data grid with draggable columns. Best for headers dragged sideways to reorder columns, with the new order applied by an arrayMove handler.
- [Draggable Rows](./data-grid/c-data-grid-14.md): Data grid with draggable rows. Best for a grip handle on each row for dragging it to a new position, with the carried row free to drift sideways.
- [Column Resizing](./data-grid/c-data-grid-15.md): Data grid with column resizing. Best for drag handles on header edges, with Staff stretching into spare width and the Status column locked.
- [Pinnable Columns](./data-grid/c-data-grid-16.md): Data grid with pinnable columns. Best for an 8 column grid that scrolls sideways under a Name column pinned at the start, pinnable from each header.
- [Sticky Header](./data-grid/c-data-grid-17.md): Data grid with sticky header. Best for a header that stays put while a page of 10 rows scrolls inside a fixed height area.
- [Column Controls](./data-grid/c-data-grid-18.md): Data grid with column controls. Best for header menus that combine sort, pin, move and a column visibility list, plus resize handles.
- [Card Container](./data-grid/c-data-grid-19.md): Data grid with card container. Best for a Card with a Users title, an Add User action and the pager in its footer around the rows.
- [Column Visibility](./data-grid/c-data-grid-20.md): Data grid with column visibility controls. Best for a Columns button in the card header that opens checkboxes to show or hide each hideable column.
- [Loading Skeleton](./data-grid/c-data-grid-21.md): Data grid with loading skeleton. Best for skeleton rows drawn from markup set on each column, with an avatar and two text bars standing in for the User cell.
- [CRUD Admin](./data-grid/c-data-grid-22.md): Data grid with CRUD features. Best for a user admin list with search, a status filter popover showing counts, row checkboxes and a row actions menu.
- [CRUD in Frame](./data-grid/c-data-grid-23.md): Data grid with CRUD in frame container. Best for search, a status filter and row actions in a dense stacked Frame titled Team members, with no column resizing.
- [Totals Footer](./data-grid/c-data-grid-24.md): Data grid with column totals footer. Best for one footer row that sums every balance, with its label spanning the columns to the left.
- [Summary Stats Footer](./data-grid/c-data-grid-25.md): Data grid with summary stats footer. Best for two footer rows of statistics: lowest and highest balance, then the average and an active member count.
- [Aggregate Footer](./data-grid/c-data-grid-26.md): Data grid with per-column aggregate footer. Best for footer cells under Balance and Transactions that each show the average over a min to max range.
- [Local Infinite Scroll](./data-grid/c-data-grid-27.md): Data grid with local infinite scroll. Best for a list of 200 in-memory rows windowed by a row virtualizer in a 480px box, with a sticky header and no pager.
- [Remote Infinite Scroll](./data-grid/c-data-grid-28.md): Data grid with remote infinite scroll. Best for feeds that append the next server page as the reader scrolls to the end.
- [Row Pinning](./data-grid/c-data-grid-29.md): Data grid with row pinning support. Best for rows pinned above the rest from a pin column or row menu, kept across pages with a count and Unpin all.
- [Tree Rows](./data-grid/c-data-grid-30.md): Data grid with tree rows. Best for a department, team and member hierarchy with expand toggles, where each page counts top level rows only.
- [Spreadsheet Editing](./data-grid/c-data-grid-31.md): Data grid with spreadsheet editing. Best for a product sheet with range selection, a fill handle, paste, built-in and custom cell editors and a right-click menu.
- [Column Virtualization](./data-grid/c-data-grid-32.md): Data grid with column virtualization. Best for a matrix of 1000 rows by 36 metric columns, virtualized both ways, with edge columns pinned and 8 column jumps.
- [Localized Labels](./data-grid/c-data-grid-33.md): Data grid with localized labels. Best for a language switch for English, German and Japanese that swaps the built-in menu, pager and selection strings.
- [Server-Side Pagination](./data-grid/c-data-grid-34.md): Data grid with server side pagination. Best for records paged on the server, with sorting, search and a status filter sent to the API.
