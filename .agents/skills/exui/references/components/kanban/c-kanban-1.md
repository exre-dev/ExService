<!-- Generated from resources/components/kanban/c-kanban-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Placeholder Overlay

> Kanban board with placeholder overlay

- Type: example, free and open source (MIT)
- Component: [Kanban](../kanban.md)
- Page: [local reference](./c-kanban-1.md)
- Uses: Avatar, Badge, Button, Card, Kanban

## Best for

Task cards with priority, assignee and due date, dragged as a dashed placeholder box between reorderable columns

## Agent notes

- Column headers read `COLUMN_TITLES` by key, so a new key in `columns` needs a title entry or its header is blank

## When not to use

- A board whose moves must reach a server and roll back on failure: use [Persisted Moves](./c-kanban-6.md)
- Drags that should show the card itself under the pointer: use [Dynamic Overlay](./c-kanban-2.md)

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
