<!-- Generated from resources/components/input/c-input-29.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Range

> Range input with value indicator

- Type: example, free and open source (MIT)
- Component: [Input](../input.md)
- Page: [local reference](./c-input-29.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input.md
- Uses: Field, Input

## Best for

A native 0 to 100 range with its current number printed at the end of the label row

## When not to use

- A themed track with 2 thumbs, tick marks or a tooltip over the thumb: use [Slider](../slider.md)

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
