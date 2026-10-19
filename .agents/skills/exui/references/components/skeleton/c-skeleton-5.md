<!-- Generated from resources/components/skeleton/c-skeleton-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Data Table

> Skeleton loader for a data table.

- Type: example, free and open source (MIT)
- Component: [Skeleton](../skeleton.md)
- Page: [local reference](./c-skeleton-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/skeleton.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/skeleton.md
- Uses: Skeleton

## Best for

A 3 column header row with a bottom border over 4 body rows, laid out with flex divs, not table markup

## Agent notes

- Placeholder rows come from `Array.from` with a `length` of 4; match it to your page size so the loaded rows do not shift the layout

## When not to use

- Placeholder rows inside a sortable, paged records table with known columns: use [Data Grid](../data-grid.md)

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
