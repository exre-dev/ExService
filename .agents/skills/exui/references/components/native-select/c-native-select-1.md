<!-- Generated from resources/components/native-select/c-native-select-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Basic

> Basic native select.

- Type: example, free and open source (MIT)
- Component: [Native Select](../native-select.md)
- Page: [local reference](./c-native-select-1.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/native-select.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/native-select.md
- Uses: Native Select

## Best for

A flat list of 5 fruits behind an empty prompt option, with Grapes listed but disabled

## When not to use

- A shorter control one height step below the default: use [Small](./c-native-select-3.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Native Select

### When to use

- Form fields that pick one value from a short fixed list through the browser's own picker
- Option lists sorted under group headings, with single options shown but locked
- Fields at a smaller height, under a label and hint, or shown disabled or invalid

### When not to use

- Option rows that carry icons, avatars, badges or descriptions in the open list: use [Select](../select.md)
- A long list the user narrows by typing before picking one: use [Combobox](../combobox.md)
- Choices nested more than one level deep, such as region, then country, then city: use [Cascader](../cascader.md)

### Agent notes

- `className` on `NativeSelect` lands on its wrapper `div`; every other prop, such as `id`, `disabled` or `aria-invalid`, goes to the inner `select`
- The first option's text never names the control; tie a `FieldLabel` to the `NativeSelect` `id` as `c-native-select-4` does, or pass an aria-label
- No example passes a name to `NativeSelect`, so a native form submit leaves the choice out; add one inside your form
