<!-- Generated from resources/components/separator/c-separator-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Vertical

> Vertical separator for inline elements.

- Type: example, free and open source (MIT)
- Component: [Separator](../separator.md)
- Page: [local reference](./c-separator-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/separator.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/separator.md
- Uses: Separator

## Best for

A single line of 3 one word labels, Blog, Docs and Source, split by 2 rules as tall as the row

## Agent notes

- Blog, Docs and Source are plain `div` text, not links; wrap each in an anchor with a real target before using the row as navigation

## When not to use

- Side by side entries that each stack a title over a caption: use [Grouped Menu Items](./c-separator-3.md)

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
