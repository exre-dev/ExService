<!-- Generated from resources/components/autocomplete/c-autocomplete-8.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Groups & Labels

> With groups and labels

- Type: example, free and open source (MIT)
- Component: [Autocomplete](../autocomplete.md)
- Page: [local reference](./c-autocomplete-8.md)
- Uses: Autocomplete, Avatar

## Best for

A people directory of 26 users in 6 teams under sticky labels, matched on name, team or job title

## Agent notes

- Replace `usersData`, whose `avatar` URLs load from randomuser.me, with your own directory
- `groupUsers` keeps only the teams listed in its `order` array, so users of any other team silently drop out
- `filter` is null, so `filteredItems` alone decides matches over name, team and position; add any new field there

## When not to use

- People found by a server query rather than a list loaded up front: use [Search Results](./c-autocomplete-9.md)

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Autocomplete

### When to use

- Search and filter fields that suggest matching options while the user types
- People and record lookups, grouped by team or fetched from a server as the query changes
- Form fields whose typed or picked text is validated with the rest of the form on submit

### When not to use

- A selection that stores the chosen option rather than typed text, or several as chips: use [Combobox](../combobox.md)
- Options nested in levels that the user drills into one level at a time: use [Cascader](../cascader.md)
- A palette of app actions and keyboard shortcuts, often opened in a dialog: use [Command](../command.md)

### Agent notes

- `value` and `onValueChange` carry the input text as a string; picking an item only fills that text and stores no item object
- Both twins are built on `@base-ui/react`, so installing it in a radix project adds Base UI as a dependency
- A Server Component cannot create the function child of `AutocompleteList`, so the file that renders it needs a use client directive
