<!-- Generated from resources/components/field/c-field-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Settings Form

> Settings form with validation

- Type: example, free and open source (MIT)
- Component: [Field](../field.md)
- Page: [local reference](./c-field-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/field.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/field.md
- Uses: Button, Checkbox, Field, Input, Switch, Textarea

## Best for

A long profile settings column mixing a slug error, a bio counter, 2 email switches and a terms checkbox above Save

## Agent notes

- Save Changes is a `Button` outside any form element with no handler, so nothing is sent
- The slug `FieldError` text and `data-invalid` are fixed; set both from your slug check result
- The 24/160 bio count is static and does not match the default text; compute it from the `Textarea` value

## When not to use

- A sign up whose password fails a list of rules under one input: use [Validation Errors](./c-field-11.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Field

### When to use

- Labeled inputs, selects, text areas and code entry with optional hint text under the control
- Preference and permission lists where every switch or checkbox has a title and a description
- Validation states with a red label and one error, or a list of them, under the control

### When not to use

- A complete page for entering or editing a record, such as an invoice or a profile: use the Form blocks
- A full page of toggle rows for alert channels, app integrations or workspace options: use the Settings blocks
- A numeric value stepped with plus and minus buttons or scrubbed by dragging: use [Number Field](../number-field.md)

### Agent notes

- `FieldTitle` is a plain div, so a `Checkbox` or `Switch` titled only by it has no accessible name; point a `FieldLabel` at its id instead
- `data-invalid` on `Field` only sets a red text color, which its label inherits; the control turns red from aria-invalid, which no example sets
- Nothing ties `FieldDescription` or `FieldError` to the control; give them ids and list those in the control's aria-describedby
