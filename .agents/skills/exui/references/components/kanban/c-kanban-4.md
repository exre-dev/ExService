<!-- Generated from resources/components/kanban/c-kanban-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Stacked Frame

> Minimal kanban with stacked frame

- Type: example, free and open source (MIT)
- Component: [Kanban](../kanban.md)
- Page: [local reference](./c-kanban-4.md)
- Uses: Avatar, Badge, Frame, Kanban, Progress

## Best for

Stacked Frame columns with a one line description each, over cards with a progress bar and assignee

## Agent notes

- Column titles print the raw `columnId` key and each `FrameDescription` text is hardcoded per key

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Kanban

### When to use

- Boards that move cards between status columns by drag and drop
- Roadmap and workflow views where each column is one stage of the work

### When not to use

- A finished tracker for issues, tickets or releases with rich cards: use the Kanban Board blocks
- A sales deal pipeline with values, owners and stage forecasts: use the CRM blocks
- A single flat list reordered by drag, with no columns: use [Sortable](../sortable.md)

### Agent notes

- Save moves in `onValueCommit`, which fires once per drop with `previousValue` for rollback; `onValueChange` also fires mid drag
- Drag listeners live on `KanbanItemHandle` and `KanbanColumnHandle`; a card or column without one cannot be dragged
- `KanbanColumnHandle` is hidden until its column is hovered or the handle has keyboard focus, so keep the column title outside it
