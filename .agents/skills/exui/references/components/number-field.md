<!-- Generated from resources/components/number-field.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Number Field

> Open-source shadcn number field components for quantity pickers, pricing inputs, and step controls.

- Type: upstream component, free
- Page: [local reference](./number-field.md)
- Examples: 6

## When to use

- Quantities, amounts and counts stepped up or down by buttons inside a min and max range
- Compact numeric settings whose label scrubs the value when dragged sideways
- Validated amounts in a React Hook Form form, checked by a zod schema with the error shown below

## When not to use

- Free text such as a name, an email or an order ID, with nothing to step: use [Input](./input.md)
- A full plans comparison with tier prices and a seat count to adjust: use the Pricing blocks
- A record entry page with many controls, such as a product with price and stock: use the Form blocks

## Agent notes

- `onValueChange` receives null when the input is cleared, so type a controlled `value` as a number or null
- Set `aria-invalid` on `NumberFieldGroup` to turn its border destructive; a shadcn `Field` marked invalid only recolors text
- An outside label must point `htmlFor` at the `id` passed to `NumberField`, which Base UI sets on the input

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt)
- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 1 of 6 examples
- React Hook Form v7: [API reference](https://react-hook-form.com/docs), [docs](https://react-hook-form.com/get-started), used by 1 of 6 examples
- React Hook Form resolvers v5: [API reference](https://github.com/react-hook-form/resolvers#api), [docs](https://github.com/react-hook-form/resolvers), used by 1 of 6 examples
- Zod v4: [API reference](https://zod.dev/api), [docs](https://zod.dev/), used by 1 of 6 examples

## Examples

- [Default Size](./number-field/c-number-field-1.md): Basic number field. Best for the default size with minus at the start, plus at the end and the value centered between them.
- [Small Size](./number-field/c-number-field-2.md): Basic number field. Best for the sm size, a 28px tall group with tighter input padding for dense rows and toolbars.
- [Large Size](./number-field/c-number-field-3.md): Basic number field. Best for the lg size, a 36px tall group with wider buttons and roomier vertical input padding.
- [Buttons on Right](./number-field/c-number-field-4.md): Number field with buttons on right. Best for the value aligned left with minus and plus grouped side by side at the end of the field.
- [Spinner Buttons](./number-field/c-number-field-5.md): Number field with spinner buttons. Best for up and down chevrons stacked in a small bordered box at the end, with the value aligned to the start.
- [Form Validation](./number-field/c-number-field-6.md): Number field in form. Best for a React Hook Form Controller binding the amount, with zod bounds, an error message and Cancel and Submit buttons.
