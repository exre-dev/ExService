<!-- Generated from resources/components/sortable/c-sortable-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Settings Priority

> Sortable settings priority with frame

- Type: example, free and open source (MIT)
- Component: [Sortable](../sortable.md)
- Page: [local reference](./c-sortable-5.md)
- Uses: Frame, Sortable, Switch

## Best for

Notification channels ranked by delivery order in a Frame, each row with a Switch that turns the channel on or off

## Agent notes

- Neither `setChannels` nor `toggleChannel` saves anything; send the order and the enabled flags to your API
- The `Switch` on each row has no accessible name; label it with `channel.name`

## When not to use

- A media queue where one entry is marked as now playing: use [Playlist](./c-sortable-4.md)

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
