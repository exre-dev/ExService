<!-- Generated from resources/components/autocomplete/c-autocomplete-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Search Results

> With search results

- Type: example, free and open source (MIT)
- Component: [Autocomplete](../autocomplete.md)
- Page: [local reference](./c-autocomplete-9.md)
- Uses: Autocomplete, Avatar

## Best for

A debounced lookup of 25 developers with a spinner, error text and result count in a status line

## Agent notes

- Replace `searchDevelopers` with your request; it waits 200 to 1000ms at random and throws on 2% of calls or when the query is "error"
- Keep the `ignore` flag when you swap in a real fetch, since it discards a response that lands after the query changed
- `shouldRenderPopup` keeps the popup unmounted while `searchValue` is empty, so the chevron opens nothing before typing

## When not to use

- Options known up front in the page, with no request, loading or error states: use [Clear & Trigger](./c-autocomplete-7.md)

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
