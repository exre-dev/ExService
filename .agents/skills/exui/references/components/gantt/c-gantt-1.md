<!-- Generated from resources/components/gantt/c-gantt-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Settings Menu

> Gantt chart with settings menu and schedulable rows

- Type: example, free and open source (MIT)
- Component: [Gantt](../gantt.md)
- Page: [local reference](./c-gantt-1.md)
- Uses: Button, Card, Gantt, Label, Popover, Radio Group, Select, Switch, Tabs

## Best for

A tabbed Settings popover with 12 display and behavior switches, 6 languages and 5 time zones, over empty rows waiting to be scheduled

## Agent notes

- `handleSelectSlot` adds the scheduled bar with `addEvent` and saves nothing; send the slot to your API there
- Right to left comes from `dir` on the wrapping div, which `Gantt` inherits; set it on your own layout for Arabic
- `SettingsMenu` and the 14 `useState` hooks feeding it only demo the props; pass the values you want straight to `Gantt`

## When not to use

- A lean starting point with no settings panel to strip out: use [Drag Reorder](./c-gantt-2.md)

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
