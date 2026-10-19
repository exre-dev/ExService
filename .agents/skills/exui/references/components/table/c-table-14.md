<!-- Generated from resources/components/table/c-table-14.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Issues

> Issues table with priority, assignee, and labels

- Type: example, free and open source (MIT)
- Component: [Table](../table.md)
- Page: [local reference](./c-table-14.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/table.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/table.md
- Uses: Avatar, Badge, Card, Table

## Best for

Issue rows with a monospace ID, a title followed by an outline label badge, the assignee and a status badge

## Agent notes

- `priority`, `priorityIcon` and `priorityVariant` sit on each issue but are never rendered; add a cell to show them
- Every label renders as an outline `Badge`, so `labelVariant` on each issue is unused

## When not to use

- Issues moved between status columns by drag and drop: use [Kanban](../kanban.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Table

### When to use

- Short lists of records such as invoices, orders, members, files or API keys, one per row
- Rows that carry status badges, avatars, a totals footer or a menu of row actions
- Label and value pairs describing one record, such as an employee profile or a server

### When not to use

- Rows the reader sorts, filters, pages or selects with checkboxes: use [Data Grid](../data-grid.md)
- A ready made records section with a title bar, toolbar filters and a pager: use the Base blocks
- An account page where a person edits their avatar, name, email and regional settings: use the Profile blocks

### Agent notes

- `Table` wraps the table in its own overflow-x-auto div, and `className` lands on the inner table, never on that scroll wrapper
- `TableCell` and `TableHead` are nowrap in every style, so a long value widens the table and scrolls it sideways instead of wrapping
