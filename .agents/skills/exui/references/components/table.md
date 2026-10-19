<!-- Generated from resources/components/table.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Table

> Open-source shadcn table components for admin tables, data display, and responsive lists.

- Type: shadcn/ui component, free
- Page: [local reference](./table.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/table.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/table.md
- Examples: 17

## When to use

- Short lists of records such as invoices, orders, members, files or API keys, one per row
- Rows that carry status badges, avatars, a totals footer or a menu of row actions
- Label and value pairs describing one record, such as an employee profile or a server

## When not to use

- Rows the reader sorts, filters, pages or selects with checkboxes: use [Data Grid](./data-grid.md)
- A ready made records section with a title bar, toolbar filters and a pager: use the Base blocks
- An account page where a person edits their avatar, name, email and regional settings: use the Profile blocks

## Agent notes

- `Table` wraps the table in its own overflow-x-auto div, and `className` lands on the inner table, never on that scroll wrapper
- `TableCell` and `TableHead` are nowrap in every style, so a long value widens the table and scrolls it sideways instead of wrapping

## Examples

- [Basic](./table/c-table-1.md): Basic table.. Best for a plain invoice list with a caption under the rows, a payment method column and status written as text.
- [With Footer](./table/c-table-2.md): Table with footer.. Best for a footer row whose Total label spans 2 columns beside a bold sum of the amounts.
- [Status Badges](./table/c-table-3.md): Table in card with status badges.. Best for a 2 column task list set inside a Card, with a colored status pill right aligned on each row.
- [Actions Column](./table/c-table-4.md): Table card with actions column.. Best for a dots button on each product row that opens Edit, Duplicate and a destructive Delete.
- [Interactive Rows](./table/c-table-5.md): Table with interactive elements.. Best for a number input in each row for changing a quantity in place, inside a Card.
- [Team Members](./table/c-table-6.md): Team members table with avatars, roles, and status. Best for team members with avatar, name and email over role and presence badges, inside a Frame panel.
- [Orders](./table/c-table-7.md): Orders table with customer info and payment status. Best for recent orders with a monospace order number, a customer name over the order date beside an avatar, and a right aligned amount.
- [Projects](./table/c-table-8.md): Projects table with team avatars and status. Best for projects with a folder icon tile, stacked team avatars plus an overflow count and a due date.
- [Activity Log](./table/c-table-9.md): Activity log table with user avatars and timestamps. Best for an audit trail of who did what, with an action badge, a monospace target such as a branch and a relative time.
- [Subscriptions](./table/c-table-10.md): Subscriptions table with plan badges and billing info. Best for software subscriptions with a plan badge, monthly price, next billing date and a Manage button on each row.
- [Inventory](./table/c-table-11.md): Product inventory table with stock badges and prices. Best for products with a SKU under the name, a stock level badge beside the unit count and an Edit, Restock, Archive menu.
- [API Keys](./table/c-table-12.md): API keys table with permission badges and actions. Best for masked secret keys in a code chip, with xs permission badges and icon buttons to copy or regenerate.
- [File Manager](./table/c-table-13.md): File manager table with owners and sharing badges. Best for files and folders with a type icon, owner avatar, a sharing scope badge, size and last modified time.
- [Issues](./table/c-table-14.md): Issues table with priority, assignee, and labels. Best for issue rows with a monospace ID, a title followed by an outline label badge, the assignee and a status badge.
- [Leaderboard](./table/c-table-15.md): Leaderboard table with rank, score, and level badges. Best for a ranked list with a position number, player handle, level badge, formatted score and a colored up or down change.
- [Employee Profile](./table/c-table-16.md): Vertical table with employee profile details. Best for one employee's details as label and value rows, with a shaded label column, avatar, job title and status.
- [Server Config](./table/c-table-17.md): Vertical table with server configuration details. Best for a titled server panel with a pulsing status dot, CPU and memory usage bars and secondary tag badges.
