<!-- Generated from resources/components/timeline/c-timeline-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Pipeline Steps

> Timeline with pipeline steps.

- Type: example, free and open source (MIT)
- Component: [Timeline](../timeline.md)
- Page: [local reference](./c-timeline-6.md)
- Uses: Avatar, Badge, Collapsible, Frame, Spinner, Timeline

## Best for

Build stages with a check, spinner or circle node, a status colored duration badge and a collapsible Frame per step, open on load

## Agent notes

- Node icons and badge colors follow each step's `status`, but the node fill follows `defaultValue`; set both from the same pipeline state

## When not to use

- A history of finished deploys, each a pass or fail with commit and branch: use [Deployment Log](./c-timeline-10.md)

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
