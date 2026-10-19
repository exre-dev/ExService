<!-- Generated from resources/components/sortable/c-sortable-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sidebar Navigation

> Sortable sidebar navigation with frame

- Type: example, free and open source (MIT)
- Component: [Sortable](../sortable.md)
- Page: [local reference](./c-sortable-6.md)
- Uses: Badge, Frame, Sortable

## Best for

A narrow navigation menu of icon entries, some with a count badge, whose grips stay hidden until a row is hovered

## Agent notes

- Rows render `item.label` as plain text with no link; wrap it in your router link so the menu navigates
- A zero `count` prints a bare 0, because the badge is gated on `item.count` alone; test for a count above 0

## When not to use

- An app wide navigation column that collapses to icons or slides off screen: use [Sidebar](../sidebar.md)

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
