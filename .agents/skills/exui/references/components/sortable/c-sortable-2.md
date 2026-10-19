<!-- Generated from resources/components/sortable/c-sortable-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Grid Layout

> Sortable list of items with grid layout

- Type: example, free and open source (MIT)
- Component: [Sortable](../sortable.md)
- Page: [local reference](./c-sortable-2.md)
- Uses: Badge, Sortable

## Best for

Asset cards with a title, a one line description and a colored type badge in an equal height 3 column layout, grips shown on hover

## Agent notes

- `getItemSize` sets `col-span-2` on the card inside `SortableItem` rather than on the grid cell, so the featured card fills 1 cell like the rest
- Replace `defaultGridItems`; its `priority` field is never rendered

## When not to use

- A single column of rows in place of tiles spread across the width: use [File List](./c-sortable-1.md)

## Third-party libraries

- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Sortable

### When to use

- Ranked lists such as a play queue, notification channels or release tasks, put in order by a grip
- Tile grids such as a media library, where cards change places across rows and columns
- Grouped options and menus reordered in place, such as product variants or sidebar menu entries

### When not to use

- Cards that move between several status columns on one board: use [Kanban](../kanban.md)
- Ranked table rows that keep several columns of values lined up: use the Drag & Drop blocks
- A whole page layout of sidebar, top bar and content area around the list: use the App Shell blocks

### Agent notes

- Drag listeners sit on `SortableItemHandle` only, so a `SortableItem` rendered without one cannot be dragged
- Passing `onMove` skips the built-in reorder, so neither `onValueChange` nor `onValueCommit` fires on drop
- The drag preview clones the child of `Sortable` whose `value` matches the dragged item, so a wrapper around `SortableItem` needs that `value` too
