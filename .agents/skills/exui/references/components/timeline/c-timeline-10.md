<!-- Generated from resources/components/timeline/c-timeline-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Deployment Log

> Deployment log timeline

- Type: example, free and open source (MIT)
- Component: [Timeline](../timeline.md)
- Page: [local reference](./c-timeline-10.md)
- Uses: Badge, Timeline

## Best for

Deploy runs with a green check or red cross node and a status badge, over a mono commit hash, branch and duration row

## Agent notes

- Any `status` in `deployments` other than success renders as failed, with the red cross node and a destructive badge

## When not to use

- A build still in progress, with running and pending stages: use [Pipeline Steps](./c-timeline-6.md)

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
