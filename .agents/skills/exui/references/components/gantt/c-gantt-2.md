<!-- Generated from resources/components/gantt/c-gantt-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Drag Reorder

> Gantt chart with drag-to-reorder tree rows

- Type: example, free and open source (MIT)
- Component: [Gantt](../gantt.md)
- Page: [local reference](./c-gantt-2.md)
- Uses: Card, Gantt

## Best for

The leanest setup, where one callback adds a drag grip to every tree row and a single setState keeps the new order

## Agent notes

- The row grip shows only when `onResourceReorder` is passed, and `resources` must be state it updates or a drop changes nothing

## When not to use

- Records dragged into a new order in a table with no dates: use [Data Grid](../data-grid.md)

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Gantt

### When to use

- Project plans where a tree of phases and tasks owns bars dragged and resized along a time axis
- Roadmaps, status reports and team capacity views read anywhere from a single day to a whole year
- Delivery tracked against a frozen plan, or work chained by dependency arrows and milestone diamonds

### When not to use

- A finished planner page with an edit dialog, dispatch rows and rules checked on drop: use the Gantt blocks
- A quarter of sales deals grouped by account, beside board, table and calendar views: use the CRM blocks
- A list of dated steps or updates read in order, with no bars to drag or resize: use [Timeline](../timeline.md)

### Agent notes

- Replace `buildBars`, which dates its sample bars from the start of the current week, with your own records
- Every example seeds bars through `defaultEvents` alone; pass `events` with `onEventsChange` to keep edits in your store
