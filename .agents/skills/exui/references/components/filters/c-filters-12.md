<!-- Generated from resources/components/filters/c-filters-12.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Controlled & Translated

> Controlled, sized and translated

- Type: example, free and open source (MIT)
- Component: [Filters](../filters.md)
- Page: [local reference](./c-filters-12.md)
- Uses: Avatar, Badge, Filters, Toggle Group

## Best for

English, German and Japanese copy over one query, a small or default size switch, read only and disabled states and a log of change reasons

## Agent notes

- Chip empty words come from `ANY_LABELS` through `renderValue`, which `labels` never reaches, so translate them with your other copy
- `NEGATED_DE` and `NEGATED_JA` are keyed by the translated operator label, so rewording an entry in `OPERATORS` needs the same key changed there
- The read only tint keys off the `data-readonly` attribute the primitive sets; `disabled` has no such hook, so it is painted from `interaction`

## When not to use

- A chip bar that narrows the rows of a real table as it changes: use [Table Filtering](./c-filters-7.md)

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
