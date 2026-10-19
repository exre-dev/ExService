<!-- Generated from resources/components/kanban.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Kanban

> Open-source shadcn kanban components for task boards, workflow pipelines, and drag-and-drop planning.

- Type: upstream component, free
- Page: [local reference](./kanban.md)
- Examples: 6

## When to use

- Boards that move cards between status columns by drag and drop
- Roadmap and workflow views where each column is one stage of the work

## When not to use

- A finished tracker for issues, tickets or releases with rich cards: use the Kanban Board blocks
- A sales deal pipeline with values, owners and stage forecasts: use the CRM blocks
- A single flat list reordered by drag, with no columns: use [Sortable](./sortable.md)

## Agent notes

- Save moves in `onValueCommit`, which fires once per drop with `previousValue` for rollback; `onValueChange` also fires mid drag
- Drag listeners live on `KanbanItemHandle` and `KanbanColumnHandle`; a card or column without one cannot be dragged
- `KanbanColumnHandle` is hidden until its column is hovered or the handle has keyboard focus, so keep the column title outside it

## Third-party libraries

- dnd kit v6: [API reference](https://dndkit.com/legacy/api-documentation/context-provider/dnd-context/), [docs](https://dndkit.com/legacy/introduction/getting-started/) (these are the Legacy docs; dndkit.com's default docs cover the newer @dnd-kit/react, a different API)
- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin
- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 1 of 6 examples

## Examples

- [Placeholder Overlay](./kanban/c-kanban-1.md): Kanban board with placeholder overlay. Best for task cards with priority, assignee and due date, dragged as a dashed placeholder box between reorderable columns.
- [Dynamic Overlay](./kanban/c-kanban-2.md): Kanban board with dynamic overlay. Best for a live copy of the dragged card or whole column under the pointer, drawn by an overlay function.
- [Frame Columns](./kanban/c-kanban-3.md): Kanban board with frame columns. Best for frame columns with a status icon and count over label cards, where only the cards drag.
- [Stacked Frame](./kanban/c-kanban-4.md): Minimal kanban with stacked frame. Best for stacked Frame columns with a one line description each, over cards with a progress bar and assignee.
- [Feature Roadmap](./kanban/c-kanban-5.md): Feature roadmap kanban with progress. Best for a product roadmap of feature cards with description, progress bar and vote count across color coded stages.
- [Persisted Moves](./kanban/c-kanban-6.md): Kanban board persisted to a backend. Best for drops saved to a simulated API, with a loading toast and a rollback to the previous board on failure.
