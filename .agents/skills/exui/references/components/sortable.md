<!-- Generated from resources/components/sortable.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sortable

> Open-source shadcn sortable components for drag-and-drop lists, priority ranking, and reordering rows.

- Type: upstream component, free
- Page: [local reference](./sortable.md)
- Examples: 8

## When to use

- Ranked lists such as a play queue, notification channels or release tasks, put in order by a grip
- Tile grids such as a media library, where cards change places across rows and columns
- Grouped options and menus reordered in place, such as product variants or sidebar menu entries

## When not to use

- Cards that move between several status columns on one board: use [Kanban](./kanban.md)
- Ranked table rows that keep several columns of values lined up: use the Drag & Drop blocks
- A whole page layout of sidebar, top bar and content area around the list: use the App Shell blocks

## Agent notes

- Drag listeners sit on `SortableItemHandle` only, so a `SortableItem` rendered without one cannot be dragged
- Passing `onMove` skips the built-in reorder, so neither `onValueChange` nor `onValueCommit` fires on drop
- The drag preview clones the child of `Sortable` whose `value` matches the dragged item, so a wrapper around `SortableItem` needs that `value` too

## Third-party libraries

- dnd kit v6: [API reference](https://dndkit.com/legacy/api-documentation/context-provider/dnd-context/), [docs](https://dndkit.com/legacy/introduction/getting-started/) (these are the Legacy docs; dndkit.com's default docs cover the newer @dnd-kit/react, a different API)
- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin
- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 4 of 8 examples

## Examples

- [File List](./sortable/c-sortable-1.md): Sortable list of items with drag-and-drop. Best for product files such as images, specs, video and audio, each row with a type icon, a colored badge and its size.
- [Grid Layout](./sortable/c-sortable-2.md): Sortable list of items with grid layout. Best for asset cards with a title, a one line description and a colored type badge in an equal height 3 column layout, grips shown on hover.
- [Nested Layout](./sortable/c-sortable-3.md): Sortable list of items with nested layout. Best for option groups such as colors, sizes and materials reordered as cards, with each group's values reordered inside it.
- [Playlist](./sortable/c-sortable-4.md): Sortable playlist with frame. Best for a music queue in a Frame with a track count, a Playing badge on the current song and the length of every track.
- [Settings Priority](./sortable/c-sortable-5.md): Sortable settings priority with frame. Best for notification channels ranked by delivery order in a Frame, each row with a Switch that turns the channel on or off.
- [Sidebar Navigation](./sortable/c-sortable-6.md): Sortable sidebar navigation with frame. Best for a narrow navigation menu of icon entries, some with a count badge, whose grips stay hidden until a row is hovered.
- [Image Gallery](./sortable/c-sortable-7.md): Sortable image gallery grid with frame. Best for tiles for image files labeled with name, pixel dimensions and size, set in a titled Frame panel.
- [Persisted Order](./sortable/c-sortable-8.md): Sortable list persisted to a backend. Best for numbered release tasks whose new order goes to a mock save on each drop, with the old order restored if it fails.
