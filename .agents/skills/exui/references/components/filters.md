<!-- Generated from resources/components/filters.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Filters

> Open-source shadcn filters components for filter bars, faceted search, and dashboard filtering.

- Type: upstream component, free
- Page: [local reference](./filters.md)
- Examples: 12

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Toolbars of removable filter chips over a table or list, one field, condition and value per chip
- Nested AND and OR condition builders, hung off a trigger over a report or laid out inline
- Attribute catalogs too large or deep to list at once, and option lists paged from a server

## When not to use

- A finished record table with its chip bar, paging and row actions already built: use the Filtering blocks
- Storefront product facets with price sliders, color swatches and department pills: use the Filter Sidebar blocks
- One day or span of days picked on its own, with no attribute or condition: use [Date Selector](./date-selector.md)

## Agent notes

- `renderValue`, `icon` and a component `editor` count toward the schema index by presence only, so swapping one alone keeps serving the old one
- A rule reaches `onQueryChange` unfinished: an empty `operator`, or a `value` still undefined or empty where its `arity` is not none; skip it when compiling
- Negate swaps to an operator's `inverse` where one exists and otherwise sets `negated`, as on `starts_with`, so a compiler must read `negated`

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)
- TanStack Table v9: [API reference](https://tanstack.com/table/v9/docs/framework/react/reference/index), [docs](https://tanstack.com/table/v9/docs/framework/react/quick-start), used by 2 of 12 examples
- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start), used by 1 of 12 examples
- input-otp v1: [API reference](https://input-otp.rodz.dev/docs/api), [docs](https://input-otp.rodz.dev/docs), used by 1 of 12 examples

## Examples

- [Full Filter Bar](./filters/c-filters-1.md): Everything in one filter bar. Best for nine fields on one bar with picks pinned atop every option list, an exclusive Unassigned row and the query printed as JSON.
- [Nested Attributes](./filters/c-filters-2.md): Nested attributes at workspace scale. Best for a 2,000 attribute branch generated across eight record types, with search synonyms such as zip for postcode and type icons on nested leaves.
- [Status Badges](./filters/c-filters-3.md): Status and priority colour badges. Best for picks shown as tinted badges until a third one folds them into a swatch stack with a count, plus a chip that takes no value.
- [Avatars & Paging](./filters/c-filters-4.md): Avatars, paging and a restored view. Best for a stored query of bare ids restored by a button, with contact names fetched for ids no search has loaded yet, and a Reset to the seed.
- [Date Editors](./filters/c-filters-5.md): A date and a date range editor. Best for typed phrases like next friday or a calendar click for one day, and a two month calendar with last 7 and 30 day presets for a range.
- [Slider Editor](./filters/c-filters-6.md): Sliders as the value editor. Best for health score and monthly spend bounds dragged on a thumb, with the closed chip drawing a mini rail of the span and its maximum.
- [Table Filtering](./filters/c-filters-7.md): Filtering a table. Best for a chip bar in a Card over a 12 person staff grid that sorts, pages, returns to page 1 on every edit and shows an empty message.
- [Choice Controls](./filters/c-filters-8.md): Choice controls as editors. Best for shadcn form controls as editors that commit per press, staying open for multi picks and closing after a single plan or region pick.
- [Typed Inputs](./filters/c-filters-9.md): Typed values in shadcn inputs. Best for dollar amounts with a per month unit, pasted keywords one per line, a 6 character code that commits when full and a domain check.
- [Popover Builder](./filters/c-filters-10.md): Nested groups in a popover. Best for a deal pipeline card whose header trigger opens a reorderable builder seeded with an OR group, with short operator words such as at least.
- [Inline Builder](./filters/c-filters-11.md): Nested groups inline, walked back out. Best for fields mapped to storage columns such as story_points, with a button that loads a group nested two deep and a live rule count.
- [Controlled & Translated](./filters/c-filters-12.md): Controlled, sized and translated. Best for english, German and Japanese copy over one query, a small or default size switch, read only and disabled states and a log of change reasons.
