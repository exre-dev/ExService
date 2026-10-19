<!-- Generated from resources/components/input-otp/c-input-otp-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Letters & Numbers

> OTP input with letters and numbers.

- Type: example, free and open source (MIT)
- Component: [Input Otp](../input-otp.md)
- Page: [local reference](./c-input-otp-4.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input-otp.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input-otp.md
- Uses: Field, Input Otp

## Best for

A 6 character code that takes letters and digits but refuses symbols, with a hint between label and slots

## Agent notes

- `input-otp` defaults inputMode to numeric, so phones open a number pad; set inputMode to text on `InputOTP` so letters can be typed

## When not to use

- A code made only of digits, shown in a single unbroken row: use [Digits Only](./c-input-otp-2.md)

## Third-party libraries

- input-otp v1: [API reference](https://input-otp.rodz.dev/docs/api), [docs](https://input-otp.rodz.dev/docs)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Input Otp

### When to use

- Login and email verification codes, typed or pasted one character per slot
- Numeric PINs and digit only codes that ignore any letter typed into them
- Fixed length codes of letters and numbers, split into groups by separators

### When not to use

- A complete sign-in page with password, social buttons and a brand layout: use the Auth blocks
- A mobile number with its country dial code, entered before any code is sent: use [Phone Input](../phone-input.md)
- Open ended text of any length, such as a name, an email address or a password: use [Input](../input.md)

### Agent notes

- A wrong code turns red only from aria-invalid on each `InputOTPSlot`; set on `InputOTP` it reaches the hidden input and the slots stay plain
- Read the code from `onChange` on `InputOTP` and check it once it reaches `maxLength`; no example sends or verifies it
