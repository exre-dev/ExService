<!-- Generated from resources/components/input-otp.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Input Otp

> Open-source shadcn OTP input components for verification codes, 2FA flows, and secure confirmation screens.

- Type: shadcn/ui component, free
- Page: [local reference](./input-otp.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input-otp.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input-otp.md
- Examples: 6

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Login and email verification codes, typed or pasted one character per slot
- Numeric PINs and digit only codes that ignore any letter typed into them
- Fixed length codes of letters and numbers, split into groups by separators

## When not to use

- A complete sign-in page with password, social buttons and a brand layout: use the Auth blocks
- A mobile number with its country dial code, entered before any code is sent: use [Phone Input](./phone-input.md)
- Open ended text of any length, such as a name, an email address or a password: use [Input](./input.md)

## Agent notes

- A wrong code turns red only from aria-invalid on each `InputOTPSlot`; set on `InputOTP` it reaches the hidden input and the slots stay plain
- Read the code from `onChange` on `InputOTP` and check it once it reaches `maxLength`; no example sends or verifies it

## Third-party libraries

- input-otp v1: [API reference](https://input-otp.rodz.dev/docs/api), [docs](https://input-otp.rodz.dev/docs)

## Examples

- [Basic](./input-otp/c-input-otp-1.md): Basic OTP input.. Best for the minimal markup: 6 slots split 3 and 3 by one separator, accepting any character.
- [Digits Only](./input-otp/c-input-otp-2.md): OTP input with numeric digits.. Best for one unbroken row of 6 slots that refuses anything but digits.
- [Multiple Separators](./input-otp/c-input-otp-3.md): OTP input with multiple separators.. Best for a controlled value prefilled with 123456, shown as 3 pairs between 2 separators.
- [Letters & Numbers](./input-otp/c-input-otp-4.md): OTP input with letters and numbers.. Best for a 6 character code that takes letters and digits but refuses symbols, with a hint between label and slots.
- [PIN Code](./input-otp/c-input-otp-5.md): OTP input for PIN codes.. Best for a 4 slot PIN in one group, digits only, with a short hint above the slots.
- [Verification Card](./input-otp/c-input-otp-6.md): OTP input verification code.. Best for a login check Card naming the email the code went to, with wider slots, a Resend Code button and a full width Verify.
