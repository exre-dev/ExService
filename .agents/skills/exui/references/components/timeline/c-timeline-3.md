<!-- Generated from resources/components/timeline/c-timeline-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Order Status

> Timeline with order status.

- Type: example, free and open source (MIT)
- Component: [Timeline](../timeline.md)
- Page: [local reference](./c-timeline-3.md)
- Uses: Timeline

## Best for

Order stages where every step up to the current one fills its node with a check and later steps stay an empty ring

## Agent notes

- `orderStatus` has no state field: the checks come from `defaultValue`, so pass the `id` of the order's current stage there

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Timeline

### When to use

- Project milestones, product roadmaps and release histories, stacked or laid out in a row
- Activity feeds and logs such as git events, deploy runs and team member actions
- Progress through ordered stages, such as order shipping or a build pipeline

### When not to use

- A ready made activity feed, approval tracker or changelog to drop into a page: use the Timeline blocks
- A full page audit log of access events grouped by day, with filters and export: use the Users blocks
- A multi step form or setup flow the user clicks through, one panel at a time: use [Stepper](../stepper.md)

### Agent notes

- `onValueChange` never fires, since no part changes the step on click or key; progress moves only when you pass a new `value`
- `defaultValue` is 1 when omitted, which sets `data-completed` on the `TimelineItem` with `step` 1; pass 0 when nothing is done yet
- Keep each `TimelineItem` a direct child of `Timeline`; wrapping one in an element hides its `TimelineSeparator` as if it were the last item
