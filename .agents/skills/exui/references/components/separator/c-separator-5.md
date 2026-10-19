<!-- Generated from resources/components/separator/c-separator-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Centered Label

> Separator with centered text label

- Type: example, free and open source (MIT)
- Component: [Separator](../separator.md)
- Page: [local reference](./c-separator-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/separator.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/separator.md
- Uses: Separator

## Best for

A lone rule with a small muted caption, or continue with, sitting on a background patch at its middle

## Agent notes

- The caption `span` hides the rule behind it with `bg-background`; on a card or muted surface swap in that surface color

## When not to use

- A named phase break inside an agent run log or chat transcript: use [Marker](../marker.md)
- A captioned break between groups of inputs inside a form: use [Field](../field.md)

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
