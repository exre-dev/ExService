<!-- Generated from resources/components/marker.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Marker

> Open-source shadcn marker components for agent run logs, inline status lines, and labeled separators.

- Type: shadcn/ui component, free
- Page: [local reference](./marker.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/marker.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/marker.md
- Examples: 6

## When to use

- Agent run logs and tool call lists, one short line of status text per step
- Labeled dividers that split a transcript or run log into named phases
- Ruled summaries such as changed files, and rows that open a link or run an action

## When not to use

- A plain horizontal or vertical rule between content sections or menu items: use [Separator](./separator.md)
- A complete run console with approval steps, log views or an outcome report: use the Agent Activity blocks
- Dated events or milestones joined by indicator dots and a connecting line: use [Timeline](./timeline.md)

## Agent notes

- Make a row a link or button with `render` on the base twin and `asChild` on the radix twin
- `MarkerIcon` is `aria-hidden` with everything inside it, so the `MarkerContent` text alone must say what the row means
- An svg in `MarkerIcon` takes each style's icon size only while it carries no size class of its own

## Examples

- [Basic Variants](./marker/c-marker-1.md): Default, separator, and border markers. Best for the 3 variant shapes stacked with no icons: a plain line, a labeled divider and a line ruled underneath.
- [Tool Call Log](./marker/c-marker-2.md): Tool call log with icon markers. Best for a bare column of 6 tool calls, each led by an icon for its action, with no card, status or grouping.
- [Run Status](./marker/c-marker-3.md): Run status markers with a live step. Best for a titled run card mixing done, failed and in progress rows, with a failed badge and a spinner on the live step.
- [Phase Separators](./marker/c-marker-4.md): Agent run log grouped by phase separators. Best for plan, Edit and Verify dividers splitting 8 icon steps in a run card that shows the run name and duration.
- [Changed Files](./marker/c-marker-5.md): Changed files summary with border markers. Best for a diff of 5 files in ruled rows: truncated monospace paths, an added, modified or removed badge and a line delta.
- [Links & Action](./marker/c-marker-6.md): Markers as links and as an action button. Best for a pair of underlined link rows over a button row that flips between revert and undo, announced in a live region.
