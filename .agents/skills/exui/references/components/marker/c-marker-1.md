<!-- Generated from resources/components/marker/c-marker-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Basic Variants

> Default, separator, and border markers

- Type: example, free and open source (MIT)
- Component: [Marker](../marker.md)
- Page: [local reference](./c-marker-1.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/marker.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/marker.md
- Uses: Marker

## Best for

The 3 variant shapes stacked with no icons: a plain line, a labeled divider and a line ruled underneath

## When not to use

- A bare rule under a section heading, or a centered label over a form divider: use [Separator](../separator.md)

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
