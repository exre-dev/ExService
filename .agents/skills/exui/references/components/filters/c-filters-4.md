<!-- Generated from resources/components/filters/c-filters-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Avatars & Paging

> Avatars, paging and a restored view

- Type: example, free and open source (MIT)
- Component: [Filters](../filters.md)
- Page: [local reference](./c-filters-4.md)
- Uses: Avatar, Button, Filters

## Best for

A stored query of bare ids restored by a button, with contact names fetched for ids no search has loaded yet, and a Reset to the seed

## Agent notes

- `searchDirectory` and `fetchPeople` fake a server over the 5,000 rows in `DIRECTORY`; wire them to your contacts API behind `loadOptions` and `resolveValues`
- `SAVED_VIEW` is a hardcoded query; load the user's stored query from your backend and pass it to `setQuery`

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
