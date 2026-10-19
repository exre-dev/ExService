<!-- Generated from resources/components/table/c-table-13.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn File Manager

> File manager table with owners and sharing badges

- Type: example, free and open source (MIT)
- Component: [Table](../table.md)
- Page: [local reference](./c-table-13.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/table.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/table.md
- Uses: Avatar, Badge, Table

## Best for

Files and folders with a type icon, owner avatar, a sharing scope badge, size and last modified time

## Agent notes

- Each record in `files` stores its own `IconPlaceholder` element in `icon`; pick the icon from the file type instead

## When not to use

- Document icons resolved from each name or MIME format, with a colored extension label: use [File Type](../file-type.md)

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
