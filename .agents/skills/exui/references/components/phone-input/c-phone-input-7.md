<!-- Generated from resources/components/phone-input/c-phone-input-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Default Country

> Phone input with specific default country

- Type: example, free and open source (MIT)
- Component: [Phone Input](../phone-input.md)
- Page: [local reference](./c-phone-input-7.md)
- Uses: Phone Input

## Best for

A field preset to France, so the French flag shows and a typed national number formats the French way

## Agent notes

- `defaultCountry` can come from a later locale lookup, but a change applies only while the field is empty and no country was picked

## When not to use

- Visitors from many countries with no reliable way to guess theirs: use [Basic](./c-phone-input-1.md)

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
