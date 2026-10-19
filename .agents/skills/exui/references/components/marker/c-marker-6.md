<!-- Generated from resources/components/marker/c-marker-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Links & Action

> Markers as links and as an action button

- Type: example, free and open source (MIT)
- Component: [Marker](../marker.md)
- Page: [local reference](./c-marker-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/marker.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/marker.md
- Uses: Marker

## Best for

A pair of underlined link rows over a button row that flips between revert and undo, announced in a live region

## Agent notes

- Both link rows keep a placeholder `href`; point them at your pull request and diff pages
- The revert row only flips local `reverted` state; call your revert action from its `onClick`

## When not to use

- A standalone action or link styled as a control, outside a list of status lines: use [Button](../button.md)
- Status lines that only report what a run did, with nothing to click: use [Tool Call Log](./c-marker-2.md)

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
