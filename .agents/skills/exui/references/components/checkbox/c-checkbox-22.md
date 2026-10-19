<!-- Generated from resources/components/checkbox/c-checkbox-22.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Uppercase Badges

> Checkbox with feature badge

- Type: example, free and open source (MIT)
- Component: [Checkbox](../checkbox.md)
- Page: [local reference](./c-checkbox-22.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/checkbox.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/checkbox.md
- Uses: Badge, Checkbox, Field

## Best for

Feature flags tagged with the stock Badge shrunk by hand to an 18px pill of 10px uppercase text with wide tracking

## When not to use

- Pills sized by a prop rather than hand set height and text classes: use [Badge Group](./c-checkbox-19.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Checkbox

### When to use

- Consent and opt-in fields, such as accepting terms or turning on a feature
- Lists where any number of options can be ticked, like notification channels or permissions
- Selectable cards and tiles for modules, people or a saved payment card

### When not to use

- A choice where exactly 1 option of a set may be picked: use [Radio Group](../radio-group.md)
- An on or off setting that applies the moment it is flipped: use [Switch](../switch.md)
- A complete record entry page with many field types and a submit handler: use the Form blocks

### Agent notes

- No example passes a name to `Checkbox`, so a native submit sends none of these boxes; give each one a name inside a real form
- The base twin sets the mixed state with the `indeterminate` prop; the radix twin passes `checked` as the string indeterminate
- A mixed state draws the same `CheckIcon` as a ticked box, as the indicator has no minus icon; add one in `Checkbox` to show a dash
