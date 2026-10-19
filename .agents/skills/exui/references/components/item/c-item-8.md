<!-- Generated from resources/components/item/c-item-8.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Small Count Badges

> Small-size items with badges

- Type: example, free and open source (MIT)
- Component: [Item](../item.md)
- Page: [local reference](./c-item-8.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/item.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/item.md
- Uses: Badge, Item

## Best for

Mailbox folder links from Inbox to Trash in a narrow column, with a rounded count badge on Inbox and Drafts only

## Agent notes

- `menuItems` shows the count `Badge` only when `count` is above 1, so a folder holding exactly 1 item shows none

## When not to use

- Menu rows that print a keyboard chord beside each action: use [Keyboard Shortcuts](./c-item-7.md)
- A full app side navigation with grouped sections that collapses: use [Sidebar](../sidebar.md)

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
