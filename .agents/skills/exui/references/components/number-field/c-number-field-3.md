<!-- Generated from resources/components/number-field/c-number-field-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Large Size

> Basic number field

- Type: example, free and open source (MIT)
- Component: [Number Field](../number-field.md)
- Page: [local reference](./c-number-field-3.md)
- Uses: Number Field

## Best for

The lg size, a 36px tall group with wider buttons and roomier vertical input padding

## When not to use

- A dense row where the control must stay 28px tall: use [Small Size](./c-number-field-2.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Number Field

### When to use

- Quantities, amounts and counts stepped up or down by buttons inside a min and max range
- Compact numeric settings whose label scrubs the value when dragged sideways
- Validated amounts in a React Hook Form form, checked by a zod schema with the error shown below

### When not to use

- Free text such as a name, an email or an order ID, with nothing to step: use [Input](../input.md)
- A full plans comparison with tier prices and a seat count to adjust: use the Pricing blocks
- A record entry page with many controls, such as a product with price and stock: use the Form blocks

### Agent notes

- `onValueChange` receives null when the input is cleared, so type a controlled `value` as a number or null
- Set `aria-invalid` on `NumberFieldGroup` to turn its border destructive; a shadcn `Field` marked invalid only recolors text
- An outside label must point `htmlFor` at the `id` passed to `NumberField`, which Base UI sets on the input
