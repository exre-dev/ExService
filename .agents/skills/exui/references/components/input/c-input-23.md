<!-- Generated from resources/components/input/c-input-23.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Strength Meter

> Advanced password strength indicator with progress

- Type: example, free and open source (MIT)
- Component: [Input](../input.md)
- Page: [local reference](./c-input-23.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input.md
- Uses: Field, Input

## Best for

A 5 rule checklist with ticks, a 5 segment color bar, a met count and an eye toggle

## Agent notes

- The bar draws 5 segments and the count reads out of 5 by hand, so a rule added to `checkStrength` needs both updated
- The eye button's aria-controls names `password`, an id that does not exist; point it at the generated `id`

## When not to use

- A single hint line with no bar or rule checklist: use [Strength Hint](./c-input-22.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Input

### When to use

- Labeled text, email and search fields, plain or restyled as a pill, an underline or borderless
- Native typed fields for passwords, phones, URLs, numbers, dates, times, files, colors and ranges
- Field states and hints: disabled, required or optional marks, errors, character counts and password strength

### When not to use

- Icons, buttons, units or a prefix that sit inside the border of the box: use [Input Group](../input-group.md)
- International numbers chosen by country flag and formatted as the user types: use [Phone Input](../phone-input.md)
- A whole create or edit page that gathers many fields under one save action: use the Form blocks

### Agent notes

- The red invalid border comes from `aria-invalid` on `Input` in every style; `FieldError` only prints the message
