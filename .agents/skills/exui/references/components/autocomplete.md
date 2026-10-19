<!-- Generated from resources/components/autocomplete.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Autocomplete

> Open-source shadcn autocomplete components for smart search, typeahead inputs, and suggestion lists.

- Type: upstream component, free
- Page: [local reference](./autocomplete.md)
- Examples: 12

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `AutocompleteContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { AutocompleteContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof AutocompleteContent>) {
  return <AutocompleteContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Search and filter fields that suggest matching options while the user types
- People and record lookups, grouped by team or fetched from a server as the query changes
- Form fields whose typed or picked text is validated with the rest of the form on submit

## When not to use

- A selection that stores the chosen option rather than typed text, or several as chips: use [Combobox](./combobox.md)
- Options nested in levels that the user drills into one level at a time: use [Cascader](./cascader.md)
- A palette of app actions and keyboard shortcuts, often opened in a dialog: use [Command](./command.md)

## Agent notes

- `value` and `onValueChange` carry the input text as a string; picking an item only fills that text and stores no item object
- Both twins are built on `@base-ui/react`, so installing it in a radix project adds Base UI as a dependency
- A Server Component cannot create the function child of `AutocompleteList`, so the file that renders it needs a use client directive

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt)
- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 1 of 12 examples
- React Hook Form v7: [API reference](https://react-hook-form.com/docs), [docs](https://react-hook-form.com/get-started), used by 1 of 12 examples
- React Hook Form resolvers v5: [API reference](https://github.com/react-hook-form/resolvers#api), [docs](https://github.com/react-hook-form/resolvers), used by 1 of 12 examples
- Zod v4: [API reference](https://zod.dev/api), [docs](https://zod.dev/), used by 1 of 12 examples

## Examples

- [Basic](./autocomplete/c-autocomplete-1.md): Basic autocomplete control. Best for the minimal uncontrolled setup, with 41 tag and component names matched by the built in filter.
- [Disabled](./autocomplete/c-autocomplete-2.md): Disabled state. Best for a field locked from the root, so the input takes no focus and its list never opens.
- [Auto Highlight](./autocomplete/c-autocomplete-3.md): Auto highlight option as you type. Best for the first match highlighted as soon as the user types, so Enter fills the input without arrow keys.
- [Labeled](./autocomplete/c-autocomplete-4.md): Control with label. Best for a shadcn Label stacked above the input and tied to it by a shared id, with auto highlight on.
- [Clear Button](./autocomplete/c-autocomplete-5.md): With clear button. Best for a query held in React state, with an X inside the input that appears once text is typed and empties it.
- [Trigger Button](./autocomplete/c-autocomplete-6.md): With trigger button. Best for a chevron button at the end of the input that opens the full list before anything is typed.
- [Clear & Trigger](./autocomplete/c-autocomplete-7.md): With clear and trigger buttons. Best for both end buttons at the default h-8 size in one spot: the chevron opens the list while empty, the X takes over once text is typed.
- [Groups & Labels](./autocomplete/c-autocomplete-8.md): With groups and labels. Best for a people directory of 26 users in 6 teams under sticky labels, matched on name, team or job title.
- [Search Results](./autocomplete/c-autocomplete-9.md): With search results. Best for a debounced lookup of 25 developers with a spinner, error text and result count in a status line.
- [Small](./autocomplete/c-autocomplete-10.md): Small autocomplete. Best for the sm size at h-7 with the clear X and chevron, for dense filter bars and toolbars.
- [Large](./autocomplete/c-autocomplete-11.md): Large autocomplete. Best for the lg size at h-9, keeping the chevron and clear X, for a search bar that leads a page.
- [Form Integration](./autocomplete/c-autocomplete-12.md): Form integration. Best for a React Hook Form field checked by zod that rejects text matching no item, with the error shown on submit.
