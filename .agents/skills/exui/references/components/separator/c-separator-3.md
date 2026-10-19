<!-- Generated from resources/components/separator/c-separator-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Grouped Menu Items

> Vertical separator groups related menu items.

- Type: example, free and open source (MIT)
- Component: [Separator](../separator.md)
- Page: [local reference](./c-separator-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/separator.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/separator.md
- Uses: Separator

## Best for

Side by side entries, each a medium weight title over a muted caption, split by short rules centered in the row

## Agent notes

- Keep the forced `self-auto` beside `h-8` on each vertical `Separator`, or its built in `self-stretch` pins the short rule to the top of the row

## When not to use

- One word labels on a single line with rules the full height of the row: use [Vertical](./c-separator-2.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Separator

### When to use

- Thin rules between a heading and its body, or between the stacked rows of a list or a summary
- Vertical rules between inline labels or side by side menu entries along one row
- Labeled breaks with a short caption centered on the rule, like an or continue with line

### When not to use

- A trail of links from the current page back up to its parent pages: use [Breadcrumb](../breadcrumb.md)
- Step lines and named phase breaks in an agent run log or transcript: use [Marker](../marker.md)
- A list of rows each led by an avatar or icon, with text and an action: use [Item](../item.md)

### Agent notes

- The base `Separator` renders role separator, while the radix twin defaults `decorative` to true and renders role none, hidden from screen readers
- A vertical `Separator` takes its height from `self-stretch`, so it shows only in a flex row or grid unless given a height such as `h-8`
