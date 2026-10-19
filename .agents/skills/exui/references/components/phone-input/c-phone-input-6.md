<!-- Generated from resources/components/phone-input/c-phone-input-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Error State

> Phone input with error state

- Type: example, free and open source (MIT)
- Component: [Phone Input](../phone-input.md)
- Page: [local reference](./c-phone-input-6.md)
- Uses: Phone Input

## Best for

The invalid look on an empty field, with the country button border and the number box both turned red

## Agent notes

- `aria-invalid` is hardcoded to true; any truthy value, the string false included, reddens the country button, so pass a boolean

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Phone Input

### When to use

- Sign up, contact and checkout forms that collect a number together with its country dial code
- Edit and account screens that show a saved number, either editable or read only
- Single market forms that open preset to one country and format the number the local way

### When not to use

- A plain tel field in one fixed national format with no country picker: use [Input](../input.md)
- A one time code sent by text message once the number is known: use [Input Otp](../input-otp.md)
- A complete personal details page with avatar, name, email and phone in one layout: use the Profile blocks

### Agent notes

- Nothing validates the number; check it yourself and pass `aria-invalid` to `PhoneInput`, which turns the country button and the field red
- `placeholder` is the only text naming the field in every example; tie a label to it by id, or pass an aria label
- Height comes from `variant` set to `sm`, `default` or `lg`, not `size`, which stays the native input attribute
