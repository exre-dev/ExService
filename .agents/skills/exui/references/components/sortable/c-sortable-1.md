<!-- Generated from resources/components/sortable/c-sortable-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn File List

> Sortable list of items with drag-and-drop

- Type: example, free and open source (MIT)
- Component: [Sortable](../sortable.md)
- Page: [local reference](./c-sortable-1.md)
- Uses: Badge, Sortable

## Best for

Product files such as images, specs, video and audio, each row with a type icon, a colored badge and its size

## Agent notes

- `handleValueChange` only stores the order and raises a `toast` per drop; send the new order to your API there
- Each row carries a pointer cursor and an empty `onClick` stub; open the file from it or drop both

## When not to use

- A reorder that must reach a server and roll back when the save fails: use [Persisted Order](./c-sortable-8.md)
- A titled music queue with a track count and a now playing mark: use [Playlist](./c-sortable-4.md)

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
