<!-- Generated from resources/components/input-otp/c-input-otp-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Digits Only

> OTP input with numeric digits.

- Type: example, free and open source (MIT)
- Component: [Input Otp](../input-otp.md)
- Page: [local reference](./c-input-otp-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input-otp.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input-otp.md
- Uses: Field, Input Otp

## Best for

One unbroken row of 6 slots that refuses anything but digits

## Agent notes

- `REGEXP_ONLY_DIGITS` drops a pasted code whole when a space or dash sits inside it; strip them with the pasteTransformer prop

## When not to use

- A short PIN of 4 digits with a hint line under its label: use [PIN Code](./c-input-otp-5.md)

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
