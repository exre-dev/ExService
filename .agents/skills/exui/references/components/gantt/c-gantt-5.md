<!-- Generated from resources/components/gantt/c-gantt-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Task Table

> Gantt chart with task table and progress

- Type: example, free and open source (MIT)
- Component: [Gantt](../gantt.md)
- Page: [local reference](./c-gantt-5.md)
- Uses: Avatar, Badge, Button, Card, Gantt

## Best for

A read only status report whose tree panel adds Owner avatars and Status badges as columns, with rows added from the toolbar

## Agent notes

- Owner and Status cells read the `meta` state by row id, so a row added without a `meta` entry renders empty cells
- Drag, resize and slot selection are off through `defaultInteractions`, so bars change only through `addTask`

## When not to use

- A plan whose bars should be dragged and resized on the chart: use [Settings Menu](./c-gantt-1.md)

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
