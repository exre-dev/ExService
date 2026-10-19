<!-- Generated from resources/components/filters/c-filters-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Popover Builder

> Nested groups in a popover

- Type: example, free and open source (MIT)
- Component: [Filters](../filters.md)
- Page: [local reference](./c-filters-10.md)
- Uses: Avatar, Badge, Button, Card, Data Grid, Filters

## Best for

A deal pipeline card whose header trigger opens a reorderable builder seeded with an OR group, with short operator words such as at least

## Agent notes

- `matches` walks the tree over `DEALS` in the browser with a `TESTS` entry per operator; replace it with your API call or extend `TESTS` for new operators
- `reach` counts each term against `DEALS` and ignores `negated`, so drop `TermReach` from the renderers once rows come from a server
- Route every query write through `applyQuery`, which also resets `pageIndex` so a narrower result never strands the pager

## When not to use

- The builder laid open on the page with its tree printed back as an expression: use [Inline Builder](./c-filters-11.md)

## Third-party libraries

- TanStack Table v9: [API reference](https://tanstack.com/table/v9/docs/framework/react/reference/index), [docs](https://tanstack.com/table/v9/docs/framework/react/quick-start)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Filters

### When to use

- Toolbars of removable filter chips over a table or list, one field, condition and value per chip
- Nested AND and OR condition builders, hung off a trigger over a report or laid out inline
- Attribute catalogs too large or deep to list at once, and option lists paged from a server

### When not to use

- A finished record table with its chip bar, paging and row actions already built: use the Filtering blocks
- Storefront product facets with price sliders, color swatches and department pills: use the Filter Sidebar blocks
- One day or span of days picked on its own, with no attribute or condition: use [Date Selector](../date-selector.md)

### Agent notes

- `renderValue`, `icon` and a component `editor` count toward the schema index by presence only, so swapping one alone keeps serving the old one
- A rule reaches `onQueryChange` unfinished: an empty `operator`, or a `value` still undefined or empty where its `arity` is not none; skip it when compiling
- Negate swaps to an operator's `inverse` where one exists and otherwise sets `negated`, as on `starts_with`, so a compiler must read `negated`
