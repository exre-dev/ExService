<!-- Generated from resources/components/checkbox/c-checkbox-20.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Right Side Tooltip

> Checkbox with label and tooltip info

- Type: example, free and open source (MIT)
- Component: [Checkbox](../checkbox.md)
- Page: [local reference](./c-checkbox-20.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/checkbox.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/checkbox.md
- Uses: Checkbox, Field, Tooltip

## Best for

An exact duplicate of c-checkbox-18, sharing its tooltip-checkbox id, label text and right side tooltip

## Agent notes

- The help button from `TooltipTrigger` is announced without a name because its icon is `aria-hidden`; add an accessible label
- The `tooltip-checkbox` id repeats in `c-checkbox-18`, so rename it when both render on the same page

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
