<!-- Generated from resources/components/timeline.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Timeline

> Open-source shadcn timeline components for activity feeds, roadmaps, and event history.

- Type: upstream component, free
- Page: [local reference](./timeline.md)
- Examples: 12

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Compact component padding

ExUI uses `1rem` padding (16px at a 16px root) for default Card insets, all sides of `AlertDialogContent`, `SheetHeader` and `SheetFooter`, vertical padding in `CommandEmpty` and DataGrid empty-table/filter messages, all sides of Gantt's no-resource message, and bottom padding between vertical `TimelineItem` entries. Empty-state padding appears only when that state is rendered; Timeline's last item has no added bottom padding. Caller classes can override these defaults.

Card's default and `sm` sizes both use `1rem` insets. `--card-spacing` controls those insets; `--card-gap` controls the separate section gap, which remains `1.5rem` by default and `1rem` for `sm`. Header bottom and Footer top insets appear when the corresponding border is added; a leading image still removes the Card's top inset.
<!-- exui-capabilities:end:skill -->

## When to use

- Project milestones, product roadmaps and release histories, stacked or laid out in a row
- Activity feeds and logs such as git events, deploy runs and team member actions
- Progress through ordered stages, such as order shipping or a build pipeline

## When not to use

- A ready made activity feed, approval tracker or changelog to drop into a page: use the Timeline blocks
- A full page audit log of access events grouped by day, with filters and export: use the Users blocks
- A multi step form or setup flow the user clicks through, one panel at a time: use [Stepper](./stepper.md)

## Agent notes

- `onValueChange` never fires, since no part changes the step on click or key; progress moves only when you pass a new `value`
- `defaultValue` is 1 when omitted, which sets `data-completed` on the `TimelineItem` with `step` 1; pass 0 when nothing is done yet
- Keep each `TimelineItem` a direct child of `Timeline`; wrapping one in an element hides its `TimelineSeparator` as if it were the last item

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin

## Examples

- [Basic](./timeline/c-timeline-1.md): Basic timeline.. Best for the minimal composition: 3 items written inline, each a date, title and line of copy, with the first 2 marked done.
- [Roadmap](./timeline/c-timeline-2.md): Timeline with roadmap.. Best for dates set in a right aligned column left of the line from the sm breakpoint, folding above each title on phones.
- [Order Status](./timeline/c-timeline-3.md): Timeline with order status.. Best for order stages where every step up to the current one fills its node with a check and later steps stay an empty ring.
- [Git Activity](./timeline/c-timeline-4.md): Timeline with git activity.. Best for a distinct icon inside each filled node, such as fork, pull request and merge, with the relative time under the description.
- [Milestones](./timeline/c-timeline-5.md): Timeline with milestones.. Best for entries that alternate either side of a center line, each just a date and a title with no body copy.
- [Pipeline Steps](./timeline/c-timeline-6.md): Timeline with pipeline steps.. Best for build stages with a check, spinner or circle node, a status colored duration badge and a collapsible Frame per step, open on load.
- [Roadmap Items](./timeline/c-timeline-7.md): Timeline with roadmap items.. Best for newest first entries marked by small colored dots, each a tiny uppercase date over one line led by a muted verb.
- [Horizontal](./timeline/c-timeline-8.md): Vertical timeline. Best for the default dots and line turned to run left to right, with 3 phases side by side below the track.
- [Leading Labels](./timeline/c-timeline-9.md): Horizontal timeline with leading labels. Best for dates printed above the track and titles with copy below it, so each phase reads as a labeled tick on the line.
- [Deployment Log](./timeline/c-timeline-10.md): Deployment log timeline. Best for deploy runs with a green check or red cross node and a status badge, over a mono commit hash, branch and duration row.
- [Avatar Activity](./timeline/c-timeline-11.md): Activity feed timeline with user avatars. Best for each event led by the actor's photo as its node, in one sentence that mutes the action between name and target.
- [Compact Milestones](./timeline/c-timeline-12.md): Compact horizontal milestone timeline. Best for versions across a row with check, play or circle nodes by status and a Current badge on the version in progress.
