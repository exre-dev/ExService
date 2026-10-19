<!-- Generated from resources/components/native-select.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Native Select

> Open-source shadcn native select components for lightweight selects, mobile-friendly forms, and basic option picking.

- Type: shadcn/ui component, free
- Page: [local reference](./native-select.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/native-select.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/native-select.md
- Examples: 6

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `NativeSelect`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { NativeSelect } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof NativeSelect>) {
  return <NativeSelect {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Form fields that pick one value from a short fixed list through the browser's own picker
- Option lists sorted under group headings, with single options shown but locked
- Fields at a smaller height, under a label and hint, or shown disabled or invalid

## When not to use

- Option rows that carry icons, avatars, badges or descriptions in the open list: use [Select](./select.md)
- A long list the user narrows by typing before picking one: use [Combobox](./combobox.md)
- Choices nested more than one level deep, such as region, then country, then city: use [Cascader](./cascader.md)

## Agent notes

- `className` on `NativeSelect` lands on its wrapper `div`; every other prop, such as `id`, `disabled` or `aria-invalid`, goes to the inner `select`
- The first option's text never names the control; tie a `FieldLabel` to the `NativeSelect` `id` as `c-native-select-4` does, or pass an aria-label
- No example passes a name to `NativeSelect`, so a native form submit leaves the choice out; add one inside your form

## Examples

- [Basic](./native-select/c-native-select-1.md): Basic native select.. Best for a flat list of 5 fruits behind an empty prompt option, with Grapes listed but disabled.
- [Grouped Options](./native-select/c-native-select-2.md): Native select with options grouped.. Best for fruits and vegetables under 2 group headings, 3 choices in each, below an ungrouped prompt.
- [Small](./native-select/c-native-select-3.md): Small native select.. Best for the sm size, 4px shorter than the default in every style, on a 2 option list.
- [Field With Label](./native-select/c-native-select-4.md): Native select embedded within a field.. Best for a Country label tied to the control by id, a hint line under it and 3 countries to pick.
- [Disabled](./native-select/c-native-select-5.md): Disabled native select.. Best for the whole control switched off, wrapper and chevron faded to half opacity.
- [Invalid](./native-select/c-native-select-6.md): Invalid native select.. Best for an error state from aria-invalid alone, turning the border red with no message printed under it.
