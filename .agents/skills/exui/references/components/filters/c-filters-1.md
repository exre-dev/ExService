<!-- Generated from resources/components/filters/c-filters-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Full Filter Bar

> Everything in one filter bar

- Type: example, free and open source (MIT)
- Component: [Filters](../filters.md)
- Page: [local reference](./c-filters-1.md)
- Uses: Avatar, Filters

## Best for

Nine fields on one bar with picks pinned atop every option list, an exclusive Unassigned row and the query printed as JSON

## Agent notes

- `searchDirectory` fakes a paged server over the 4,000 rows in `DIRECTORY` with a 260ms timer; call your API from the Contact field's `loadOptions` instead
- Replace `TEAM` and `COUNTRIES` with your own people and countries; `Person` loads every face from randomuser.me by its `img` path

## When not to use

- Value editors built from toggles, radios, checkboxes and a switch: use [Choice Controls](./c-filters-8.md)

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
