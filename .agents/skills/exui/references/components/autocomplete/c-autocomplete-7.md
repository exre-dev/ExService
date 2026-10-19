<!-- Generated from resources/components/autocomplete/c-autocomplete-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Clear & Trigger

> With clear and trigger buttons

- Type: example, free and open source (MIT)
- Component: [Autocomplete](../autocomplete.md)
- Page: [local reference](./c-autocomplete-7.md)
- Uses: Autocomplete

## Best for

Both end buttons at the default h-8 size in one spot: the chevron opens the list while empty, the X takes over once text is typed

## Agent notes

- The default filter still runs over `filteredItems`; null out `filter` first if your own matching reads other fields

## When not to use

- Suggestions that come from a request with loading and error states: use [Search Results](./c-autocomplete-9.md)

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
