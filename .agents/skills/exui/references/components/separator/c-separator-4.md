<!-- Generated from resources/components/separator/c-separator-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn List Rows

> Horizontal separator between items in a list.

- Type: example, free and open source (MIT)
- Component: [Separator](../separator.md)
- Page: [local reference](./c-separator-4.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/separator.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/separator.md
- Uses: Separator

## Best for

A stack of 3 label and value rows with a rule between every row, labels on the left and muted values on the right

## When not to use

- Priced line items with one rule under the heading and another above the total: use [Order Summary](./c-separator-6.md)

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
