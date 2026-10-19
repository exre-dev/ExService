<!-- Generated from resources/components/gantt/c-gantt-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Baseline Tracking

> Gantt chart with as-built baseline tracking

- Type: example, free and open source (MIT)
- Component: [Gantt](../gantt.md)
- Page: [local reference](./c-gantt-6.md)
- Uses: Card, Gantt

## Best for

Frozen plan dates ghosted behind actual bars, showing early, late and on time work plus a planned band on a whole group

## Agent notes

- Rows come from `buildResources`, which also dates the Implementation group's planned band around the current week
- Give a bar both `baselineStart` and `baselineEnd` or neither; equal values draw a planned milestone diamond

## When not to use

- Tasks chained by arrows from each predecessor into the next: use [Dependencies & Milestones](./c-gantt-7.md)

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
