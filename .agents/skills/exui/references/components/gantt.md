<!-- Generated from resources/components/gantt.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Gantt

> Open-source shadcn gantt components with split tree and timeline panes, drag scheduling, and progress rollups.

- Type: upstream component, free
- Page: [local reference](./gantt.md)
- Examples: 7

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Compact component padding

ExUI uses `1rem` padding (16px at a 16px root) for default Card insets, all sides of `AlertDialogContent`, `SheetHeader` and `SheetFooter`, vertical padding in `CommandEmpty` and DataGrid empty-table/filter messages, all sides of Gantt's no-resource message, and bottom padding between vertical `TimelineItem` entries. Empty-state padding appears only when that state is rendered; Timeline's last item has no added bottom padding. Caller classes can override these defaults.

Card's default and `sm` sizes both use `1rem` insets. `--card-spacing` controls those insets; `--card-gap` controls the separate section gap, which remains `1.5rem` by default and `1rem` for `sm`. Header bottom and Footer top insets appear when the corresponding border is added; a leading image still removes the Card's top inset.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.

**ExUI adaptation**

### Root export collision aliases

The public root resolves name collisions between component modules with `Reui`-prefixed names. Import those exact names from `@exre/exui`; do not assume the original module-local name is also exported.

Read [Root export collision aliases](../exui/setup.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Project plans where a tree of phases and tasks owns bars dragged and resized along a time axis
- Roadmaps, status reports and team capacity views read anywhere from a single day to a whole year
- Delivery tracked against a frozen plan, or work chained by dependency arrows and milestone diamonds

## When not to use

- A finished planner page with an edit dialog, dispatch rows and rules checked on drop: use the Gantt blocks
- A quarter of sales deals grouped by account, beside board, table and calendar views: use the CRM blocks
- A list of dated steps or updates read in order, with no bars to drag or resize: use [Timeline](./timeline.md)

## Agent notes

- Replace `buildBars`, which dates its sample bars from the start of the current week, with your own records
- Every example seeds bars through `defaultEvents` alone; pass `events` with `onEventsChange` to keep edits in your store

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)
- date-fns time zones v1: [API reference](https://github.com/date-fns/date-fns/tree/main/pkgs/tz#api), [docs](https://github.com/date-fns/date-fns/tree/main/pkgs/tz)
- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin

## Examples

- [Settings Menu](./gantt/c-gantt-1.md): Gantt chart with settings menu and schedulable rows. Best for a tabbed Settings popover with 12 display and behavior switches, 6 languages and 5 time zones, over empty rows waiting to be scheduled.
- [Drag Reorder](./gantt/c-gantt-2.md): Gantt chart with drag-to-reorder tree rows. Best for the leanest setup, where one callback adds a drag grip to every tree row and a single setState keeps the new order.
- [Quarter Roadmap](./gantt/c-gantt-3.md): Gantt chart with quarter roadmap and rollups. Best for multi month initiatives grouped by workstream, with a toolbar button that drops the next backlog item onto its empty row.
- [Capacity Board](./gantt/c-gantt-4.md): Gantt chart with weekly capacity board. Best for teammates grouped by squad with avatar row labels and shaded weekends, where added assignments stack into extra lanes.
- [Task Table](./gantt/c-gantt-5.md): Gantt chart with task table and progress. Best for a read only status report whose tree panel adds Owner avatars and Status badges as columns, with rows added from the toolbar.
- [Baseline Tracking](./gantt/c-gantt-6.md): Gantt chart with as-built baseline tracking. Best for frozen plan dates ghosted behind actual bars, showing early, late and on time work plus a planned band on a whole group.
- [Dependencies & Milestones](./gantt/c-gantt-7.md): Gantt chart with dependency arrows and milestones. Best for a rollout chain where QA waits on 2 build tracks and a zero length sign off gate opens the go live step.
