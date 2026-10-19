<!-- Generated from resources/components/field/c-field-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Responsive Layout

> Responsive field layout

- Type: example, free and open source (MIT)
- Component: [Field](../field.md)
- Page: [local reference](./c-field-9.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/field.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/field.md
- Uses: Button, Field, Input, Select

## Best for

A member invite whose labels sit beside the inputs on a wide container and stack above them when narrow

## Agent notes

- `orientation` responsive follows the width of the enclosing `FieldGroup`, not the viewport, so keep each `Field` inside one
- On the base twin the role trigger shows the raw value member; give `Select` an items map so it shows the label

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
