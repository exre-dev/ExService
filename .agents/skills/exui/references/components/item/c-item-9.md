<!-- Generated from resources/components/item/c-item-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Team Roles

> Team members with roles and multiple actions

- Type: example, free and open source (MIT)
- Component: [Item](../item.md)
- Page: [local reference](./c-item-9.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/item.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/item.md
- Uses: Avatar, Badge, Button, Dropdown Menu, Item

## Best for

Member rows with email under the name, a role badge and a dots menu of Change Role, View Profile and Remove

## Agent notes

- `members` holds 3 sample people with a `roleVariant` each; load your team and map every role to a `Badge` variant
- Change Role, View Profile and Remove are `DropdownMenuItem` entries with no handler; attach your member actions to each

## When not to use

- A members roster compared across aligned columns of role and status: use [Table](../table.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Item

### When to use

- Rows of people, files, services or events, each an avatar or icon beside text, a badge or a button
- Clickable menus of account pages, mailbox folders or commands, ending in a chevron, count or key
- A compact record card with a header and footer, such as a project with status, team and progress

### When not to use

- A finished dashboard panel of KPIs, transactions or integrations with data on every row: use the List blocks
- A whole page of account options in labeled rows, each with its own switch, select or input: use the Settings blocks
- Rows the user reorders by dragging them up or down the page: use [Sortable](../sortable.md)

### Agent notes

- Make a row a link through `render` on the base twin or `asChild` on radix; every style draws the hover fill only when the row is an anchor
- `ItemGroup` sets `role` list but `Item` sets no listitem role, so wrap each row in an element that carries it
- `ItemTitle` clamps to 1 line and `ItemDescription` to 2, so longer text is cut off until a `className` lifts the clamp
