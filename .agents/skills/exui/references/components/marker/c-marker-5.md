<!-- Generated from resources/components/marker/c-marker-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Changed Files

> Changed files summary with border markers

- Type: example, free and open source (MIT)
- Component: [Marker](../marker.md)
- Page: [local reference](./c-marker-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/marker.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/marker.md
- Uses: Badge, Marker

## Best for

A diff of 5 files in ruled rows: truncated monospace paths, an added, modified or removed badge and a line delta

## Agent notes

- `CHANGES` is sample diff data; swap in your changed files with a `path`, `kind` and `delta` each
- A new `kind` goes into the union on `Change` and needs an entry in both `ICONS` and `BADGES`, since both are keyed by that union
- Every row but the last takes the border `variant`, so the list never ends on a rule with nothing below it

## When not to use

- A pick or drop area that sends documents, with progress per item: use [File Upload](../file-upload.md)
- A colored page glyph that names each document by its extension: use [File Type](../file-type.md)

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
