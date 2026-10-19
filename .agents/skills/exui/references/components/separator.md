<!-- Generated from resources/components/separator.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Separator

> Open-source shadcn separator components for content grouping, toolbar dividers, and section breaks.

- Type: shadcn/ui component, free
- Page: [local reference](./separator.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/separator.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/separator.md
- Examples: 6

## When to use

- Thin rules between a heading and its body, or between the stacked rows of a list or a summary
- Vertical rules between inline labels or side by side menu entries along one row
- Labeled breaks with a short caption centered on the rule, like an or continue with line

## When not to use

- A trail of links from the current page back up to its parent pages: use [Breadcrumb](./breadcrumb.md)
- Step lines and named phase breaks in an agent run log or transcript: use [Marker](./marker.md)
- A list of rows each led by an avatar or icon, with text and an action: use [Item](./item.md)

## Agent notes

- The base `Separator` renders role separator, while the radix twin defaults `decorative` to true and renders role none, hidden from screen readers
- A vertical `Separator` takes its height from `self-stretch`, so it shows only in a flex row or grid unless given a height such as `h-8`

## Examples

- [Horizontal](./separator/c-separator-1.md): Horizontal separator for content sections.. Best for a heading with a muted subtitle, set off from a muted paragraph of body copy by one full width rule.
- [Vertical](./separator/c-separator-2.md): Vertical separator for inline elements.. Best for a single line of 3 one word labels, Blog, Docs and Source, split by 2 rules as tall as the row.
- [Grouped Menu Items](./separator/c-separator-3.md): Vertical separator groups related menu items.. Best for side by side entries, each a medium weight title over a muted caption, split by short rules centered in the row.
- [List Rows](./separator/c-separator-4.md): Horizontal separator between items in a list.. Best for a stack of 3 label and value rows with a rule between every row, labels on the left and muted values on the right.
- [Centered Label](./separator/c-separator-5.md): Separator with centered text label. Best for a lone rule with a small muted caption, or continue with, sitting on a background patch at its middle.
- [Order Summary](./separator/c-separator-6.md): Order summary with separators. Best for a price breakdown of subtotal, discount and tax, ruled off from its heading above and from a medium weight total below.
