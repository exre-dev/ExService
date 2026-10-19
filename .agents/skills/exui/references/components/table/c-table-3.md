<!-- Generated from resources/components/table/c-table-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Status Badges

> Table in card with status badges.

- Type: example, free and open source (MIT)
- Component: [Table](../table.md)
- Page: [local reference](./c-table-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/table.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/table.md
- Uses: Card, Table

## Best for

A 2 column task list set inside a Card, with a colored status pill right aligned on each row

## Agent notes

- Status pills are spans colored by fixed green, yellow and gray classes in `statusColor`, with no dark mode shades

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
