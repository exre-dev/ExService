<!-- Generated from resources/components/skeleton/c-skeleton-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Stats Row

> Skeleton loader for a dashboard stats row

- Type: example, free and open source (MIT)
- Component: [Skeleton](../skeleton.md)
- Page: [local reference](./c-skeleton-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/skeleton.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/skeleton.md
- Uses: Card, Skeleton

## Best for

A row of 3 metric cards, each a small label bar over a tall value bar and a caption line

## Agent notes

- `grid-cols-3` has no breakpoint, so the 3 cards stay in one row on a phone, where their `w-24` value bars can overflow and clip

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Skeleton

### When to use

- Placeholders for avatars and user info, text paragraphs, forms and media cards while data loads
- Loading states for data tables, dashboard stats, lists with row actions, profile pages and chat threads

### When not to use

- Sortable record tables that draw their own placeholder rows during a fetch: use [Data Grid](../data-grid.md)
- Menu links in an app navigation rail that are still being fetched: use [Sidebar](../sidebar.md)
- A wait whose result has no known shape, such as a file being processed: use [Spinner](../spinner.md)

### Agent notes

- `Skeleton` has no size of its own, so every placeholder here sets its height and width by class; size yours to the content it stands in for
- `Skeleton` is a bare div with no role or text, so screen readers hear nothing; set aria-busy on the region it fills while loading
- The default radius of `Skeleton` follows the style, square in lyra and sera and rounded-2xl in luma and rhea; circles need rounded-full
