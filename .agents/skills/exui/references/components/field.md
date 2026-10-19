<!-- Generated from resources/components/field.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Field

> Open-source shadcn form field components for form composition, validated inputs, and helper text.

- Type: shadcn/ui component, free
- Page: [local reference](./field.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/field.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/field.md
- Examples: 11

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Checkbox inside FieldLabel

Selecting a `Checkbox` inside `FieldLabel` changes the checkbox fill and checkmark while keeping the label background unchanged. This applies to both checkbox cards and settings rows. Clicking the label still toggles its checkbox.

**ExUI adaptation**

### Switch inside FieldLabel

When a `FieldLabel` contains a `Switch`, toggling the switch changes its track without filling the entire label background. This applies to card and settings-row labels. Use the label composition for a clickable switch row; avoid adding a selected fill solely to represent the switch state.

**ExUI adaptation**

### Radio field selection

`FieldLabel` keeps its background unchanged when a nested `RadioGroupItem` is selected, including card and settings-row compositions. The radio circle and indicator show the selected state. Label clicks and arrow-key selection remain available; add an explicit background class if the composition needs a tinted row or card.
<!-- exui-capabilities:end:skill -->

## When to use

- Labeled inputs, selects, text areas and code entry with optional hint text under the control
- Preference and permission lists where every switch or checkbox has a title and a description
- Validation states with a red label and one error, or a list of them, under the control

## When not to use

- A complete page for entering or editing a record, such as an invoice or a profile: use the Form blocks
- A full page of toggle rows for alert channels, app integrations or workspace options: use the Settings blocks
- A numeric value stepped with plus and minus buttons or scrubbed by dragging: use [Number Field](./number-field.md)

## Agent notes

- `FieldTitle` is a plain div, so a `Checkbox` or `Switch` titled only by it has no accessible name; point a `FieldLabel` at its id instead
- `data-invalid` on `Field` only sets a red text color, which its label inherits; the control turns red from aria-invalid, which no example sets
- Nothing ties `FieldDescription` or `FieldError` to the control; give them ids and list those in the control's aria-describedby

## Third-party libraries

- input-otp v1: [API reference](https://input-otp.rodz.dev/docs/api), [docs](https://input-otp.rodz.dev/docs), used by 1 of 11 examples

## Examples

- [Input Groups](./field/c-field-1.md): Fields with input groups. Best for an @ prefix and a fixed mail domain suffix on profile inputs, with a required star and a green available hint.
- [Input & Textarea](./field/c-field-2.md): Field with input and textarea. Best for a support ticket subject and message, with a character count set at the right end of the message label row.
- [Select Controls](./field/c-field-3.md): Field with select control. Best for plan and billing cycle dropdowns that load set to the pro plan and yearly billing, each with a hint below.
- [Radio & Checkboxes](./field/c-field-4.md): Field with radio groups and checkboxes. Best for email opt-in checkboxes with one locked on, then a public or private radio choice, each under its own legend.
- [Slider & Switch](./field/c-field-5.md): Filed with slider and switch. Best for a switch at the end of a titled row, then a slider in steps of 5 whose live percent reads beside its label.
- [OTP Input](./field/c-field-6.md): Field with OTP input. Best for a native select of delivery methods above a 6 slot code split 3 and 3 by a separator.
- [Settings Form](./field/c-field-7.md): Settings form with validation. Best for a long profile settings column mixing a slug error, a bio counter, 2 email switches and a terms checkbox above Save.
- [Permissions](./field/c-field-8.md): Permission settings with checkboxes. Best for role access levels from read to admin as ticked rows, with the owner only level disabled and a hint under the legend.
- [Responsive Layout](./field/c-field-9.md): Responsive field layout. Best for a member invite whose labels sit beside the inputs on a wide container and stack above them when narrow.
- [Notification Preferences](./field/c-field-10.md): Notification preferences form. Best for delivery channels as switch rows and event types as checkbox rows, in 2 legend groups split by a separator.
- [Validation Errors](./field/c-field-11.md): Form with validation errors. Best for a sign up with icon addons where the password fails 2 rules, passed as an errors array and shown as bullets.
