<!-- Generated from resources/components/item/c-item-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn User Follow

> User item with avatar, info, and follow button

- Type: example, free and open source (MIT)
- Component: [Item](../item.md)
- Page: [local reference](./c-item-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/item.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/item.md
- Uses: Avatar, Button, Item

## Best for

Compact people rows with a photo and job title that show the follow button in both states, Follow and Following

## Agent notes

- Follow and Following are 2 fixed `Button` variants with no state; keep a following flag per person to swap label and variant

## When not to use

- A feed of who did what and when, one person per row with a timestamp: use [Activity Feed](./c-item-12.md)

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
