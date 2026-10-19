<!-- Generated from resources/components/marker/c-marker-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Tool Call Log

> Tool call log with icon markers

- Type: example, free and open source (MIT)
- Component: [Marker](../marker.md)
- Page: [local reference](./c-marker-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/marker.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/marker.md
- Uses: Marker

## Best for

A bare column of 6 tool calls, each led by an icon for its action, with no card, status or grouping

## Agent notes

- `TOOL_CALLS` is sample data; map your run's tool calls onto its `id`, `label` and `icon` fields

## When not to use

- Steps that belong under named phases such as plan, edit and verify: use [Phase Separators](./c-marker-4.md)
- A run where some steps failed or are still in progress: use [Run Status](./c-marker-3.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Marker

### When to use

- Agent run logs and tool call lists, one short line of status text per step
- Labeled dividers that split a transcript or run log into named phases
- Ruled summaries such as changed files, and rows that open a link or run an action

### When not to use

- A plain horizontal or vertical rule between content sections or menu items: use [Separator](../separator.md)
- A complete run console with approval steps, log views or an outcome report: use the Agent Activity blocks
- Dated events or milestones joined by indicator dots and a connecting line: use [Timeline](../timeline.md)

### Agent notes

- Make a row a link or button with `render` on the base twin and `asChild` on the radix twin
- `MarkerIcon` is `aria-hidden` with everything inside it, so the `MarkerContent` text alone must say what the row means
- An svg in `MarkerIcon` takes each style's icon size only while it carries no size class of its own
