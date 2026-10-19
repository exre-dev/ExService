<!-- Generated from resources/components/phone-input.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Phone Input

> Open-source shadcn phone input components for international signup, contact forms, and country codes.

- Type: upstream component, free
- Page: [local reference](./phone-input.md)
- Examples: 8

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### ExUI phone input appearance

`PhoneInput` keeps its country button and number field at the same height. Use `variant="sm"`, `"default"` or `"lg"`; `size` remains the native input attribute. At a 16px root, small is 32px, large is 40px, and default follows density: 36px in standard density and 32px in compact density. Heights scale with the root font size.

Both halves use the form-control background tokens. The country search renders the standard `Input`, retaining its rounded border, inset spacing and focus appearance while the combobox handles filtering, keyboard navigation and selection. All eight existing examples share this appearance.
<!-- exui-capabilities:end:skill -->

## When to use

- Sign up, contact and checkout forms that collect a number together with its country dial code
- Edit and account screens that show a saved number, either editable or read only
- Single market forms that open preset to one country and format the number the local way

## When not to use

- A plain tel field in one fixed national format with no country picker: use [Input](./input.md)
- A one time code sent by text message once the number is known: use [Input Otp](./input-otp.md)
- A complete personal details page with avatar, name, email and phone in one layout: use the Profile blocks

## Agent notes

- Nothing validates the number; check it yourself and pass `aria-invalid` to `PhoneInput`, which turns the country button and the field red
- `placeholder` is the only text naming the field in every example; tie a label to it by id, or pass an aria label
- Height comes from `variant` set to `sm`, `default` or `lg`, not `size`, which stays the native input attribute

## Third-party libraries

- React Phone Number Input v3: [API reference](https://catamphetamine.gitlab.io/react-phone-number-input/docs/index.html#phoneinputwithcountry), [docs](https://gitlab.com/catamphetamine/react-phone-number-input)

## Examples

- [Basic](./phone-input/c-phone-input-1.md): Basic phone input. Best for no preset country, so a globe shows until a typed dial code or a pick from the list sets the flag.
- [Small](./phone-input/c-phone-input-2.md): Small phone input. Best for the compact sm height for dense rows, prefilled with a Dutch mobile number beside the NL flag.
- [Large](./phone-input/c-phone-input-3.md): Large phone input. Best for the tall lg height for roomy forms, preset to US and filled with a sample New York number.
- [Disabled](./phone-input/c-phone-input-4.md): Disabled phone input. Best for an empty field whose country button and number box are both dimmed and closed to focus and clicks.
- [Preset Value](./phone-input/c-phone-input-5.md): Phone input with preset value. Best for an editable field opened on a stored number, whose US flag comes from the number itself since no country is preset.
- [Error State](./phone-input/c-phone-input-6.md): Phone input with error state. Best for the invalid look on an empty field, with the country button border and the number box both turned red.
- [Default Country](./phone-input/c-phone-input-7.md): Phone input with specific default country. Best for a field preset to France, so the French flag shows and a typed national number formats the French way.
- [Read-Only](./phone-input/c-phone-input-8.md): Read-only phone input. Best for a stored number the user can focus, select and copy but not retype, for summary and confirmation screens.
