<!-- Generated from resources/components/input.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Input

> Open-source shadcn input components for form entry, search fields, and auth screens.

- Type: shadcn/ui component, free
- Page: [local reference](./input.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input.md
- Examples: 31

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Input`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Input } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Input>) {
  return <Input {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.

**ExUI adaptation**

### Input appearance

`Input` uses a transparent border in its normal, hover and disabled states, following the Luma appearance. The 1px border still occupies space, so its geometry stays unchanged. Keyboard focus and `aria-invalid` retain their ExUI border colors and rings.
<!-- exui-capabilities:end:skill -->

## When to use

- Labeled text, email and search fields, plain or restyled as a pill, an underline or borderless
- Native typed fields for passwords, phones, URLs, numbers, dates, times, files, colors and ranges
- Field states and hints: disabled, required or optional marks, errors, character counts and password strength

## When not to use

- Icons, buttons, units or a prefix that sit inside the border of the box: use [Input Group](./input-group.md)
- International numbers chosen by country flag and formatted as the user types: use [Phone Input](./phone-input.md)
- A whole create or edit page that gathers many fields under one save action: use the Form blocks

## Agent notes

- The red invalid border comes from `aria-invalid` on `Input` in every style; `FieldError` only prints the message

## Examples

- [Basic](./input/c-input-1.md): Basic input. Best for a bare text box with placeholder text and no label, the smallest markup to start from.
- [With Label](./input/c-input-2.md): Input with label. Best for an email field with a visible label above it, tied to the box through htmlFor and id.
- [With Description](./input/c-input-3.md): Input with description. Best for a username field with one line of help text printed under the box.
- [Disabled](./input/c-input-4.md): Disabled input. Best for a labeled email field locked by the disabled attribute, dimmed and skipped by the keyboard.
- [Error Message](./input/c-input-5.md): Input with error message. Best for an email field shown in its red invalid state with a single error line below.
- [Character Counter](./input/c-input-6.md): Input with character counter. Best for a 50 character project description with a live typed count across from the label.
- [Password](./input/c-input-7.md): Input with password type. Best for a plain masked password box with no reveal button and no strength feedback.
- [Phone](./input/c-input-8.md): Input with phone type. Best for a tel field that brings up the phone keypad, with no country menu or number formatting.
- [URL](./input/c-input-9.md): Input with URL type. Best for a website address field typed as url, with a full https address as its placeholder.
- [Number](./input/c-input-10.md): Input with number type. Best for a numeric field typed as number, with the browser's own spin arrows for stepping.
- [Date](./input/c-input-11.md): Input with date type. Best for a day picked from the browser's built in calendar popup, with no date library.
- [File](./input/c-input-12.md): Input with file type. Best for a native file chooser with the browser's pick button flattened into the field, taking one file.
- [Required Indicator](./input/c-input-13.md): Input with required indicator. Best for a company name field whose label ends in a red asterisk to mark it mandatory.
- [Time](./input/c-input-14.md): Input with time type. Best for a native hour and minute field rendered by the browser, with no picker library and no state.
- [Contact Form](./input/c-input-15.md): Complex input form with multiple fields. Best for a short contact form with phone and country side by side, an address line and Cancel and Submit.
- [Label Tooltip](./input/c-input-16.md): Input label with tooltip. Best for a username label with a help icon that opens a tooltip, repeating the hint as text under the box.
- [Label Badge](./input/c-input-17.md): Input label with badge. Best for an API key field with a New badge in the success tint beside its label.
- [Optional Badge](./input/c-input-18.md): Input label with optional badge. Best for a middle name field with a small outlined Optional badge at the far end of the label row.
- [Link & Toggle](./input/c-input-19.md): Input label with link and visibility toggle. Best for a sign in password with a Forgot password link opposite the label and an eye button to reveal it.
- [Horizontal](./input/c-input-20.md): Input with horizontal orientation. Best for a name field with its label placed to the left on the same row rather than above.
- [Multiple Errors](./input/c-input-21.md): Input with multiple error messages. Best for a security code field listing 3 failed rules under it, each led by an alert icon.
- [Strength Hint](./input/c-input-22.md): Basic password strength with dynamic hint and icons. Best for a password with one hint line that turns from grey to red, amber or green as 3 rules pass.
- [Strength Meter](./input/c-input-23.md): Advanced password strength indicator with progress. Best for a 5 rule checklist with ticks, a 5 segment color bar, a met count and an eye toggle.
- [Pulsed Background](./input/c-input-24.md): Input with pulsed background animation. Best for a field behind a pulsing primary tint that stops when focused and resumes on blur.
- [Custom Focus Ring](./input/c-input-25.md): Input with custom focus ring. Best for a field whose focus border and ring turn emerald green in place of the theme ring color.
- [Subtle Background](./input/c-input-26.md): Input with subtle background. Best for a field filled with the muted surface color, kept the same on hover and focus.
- [Bottom Border](./input/c-input-27.md): Input with bottom border only. Best for an underline style field with a 2px bottom rule that turns primary on focus, with no ring.
- [Color](./input/c-input-28.md): Color input. Best for a browser color swatch that opens the native picker, starting from a blue hex value.
- [Range](./input/c-input-29.md): Range input with value indicator. Best for a native 0 to 100 range with its current number printed at the end of the label row.
- [Pill Shape](./input/c-input-30.md): Pill-shaped input. Best for a search box with fully rounded ends and wider side padding.
- [Borderless](./input/c-input-31.md): Minimal input without borders or background. Best for a chromeless field with no border, fill, padding or focus ring, only text and caret.
