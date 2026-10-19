<!-- Generated from resources/components/autocomplete/c-autocomplete-12.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Form Integration

> Form integration

- Type: example, free and open source (MIT)
- Component: [Autocomplete](../autocomplete.md)
- Page: [local reference](./c-autocomplete-12.md)
- Uses: Alert, Autocomplete, Button, Field

## Best for

A React Hook Form field checked by zod that rejects text matching no item, with the error shown on submit

## Agent notes

- `onSubmit` only raises a `toast` with `data.feature` and resets the form; save the value there and mount the Sonner toaster
- `FormSchema` accepts only text equal to an `items` value; drop its `refine` to let users submit free text

## Third-party libraries

- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started)
- React Hook Form v7: [API reference](https://react-hook-form.com/docs), [docs](https://react-hook-form.com/get-started)
- React Hook Form resolvers v5: [API reference](https://github.com/react-hook-form/resolvers#api), [docs](https://github.com/react-hook-form/resolvers)
- Zod v4: [API reference](https://zod.dev/api), [docs](https://zod.dev/)

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
