<!-- Generated from resources/components/input/c-input-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Character Counter

> Input with character counter

- Type: example, free and open source (MIT)
- Component: [Input](../input.md)
- Page: [local reference](./c-input-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input.md
- Uses: Field, Input

## Best for

A 50 character project description with a live typed count across from the label

## Agent notes

- `maxLength` drives both the browser cap and the counter text, so change that one constant to move the limit

## When not to use

- A description that runs over several lines of text: use [Textarea](../textarea.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Input

### When to use

- Labeled text, email and search fields, plain or restyled as a pill, an underline or borderless
- Native typed fields for passwords, phones, URLs, numbers, dates, times, files, colors and ranges
- Field states and hints: disabled, required or optional marks, errors, character counts and password strength

### When not to use

- Icons, buttons, units or a prefix that sit inside the border of the box: use [Input Group](../input-group.md)
- International numbers chosen by country flag and formatted as the user types: use [Phone Input](../phone-input.md)
- A whole create or edit page that gathers many fields under one save action: use the Form blocks

### Agent notes

- The red invalid border comes from `aria-invalid` on `Input` in every style; `FieldError` only prints the message
