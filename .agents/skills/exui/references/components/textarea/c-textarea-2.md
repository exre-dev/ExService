<!-- Generated from resources/components/textarea/c-textarea-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Invalid

> Invalid textarea.

- Type: example, free and open source (MIT)
- Component: [Textarea](../textarea.md)
- Page: [local reference](./c-textarea-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/textarea.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/textarea.md
- Uses: Textarea

## Best for

The red invalid state set by aria-invalid alone, with no label or message saying what is wrong

## Agent notes

- `aria-invalid` is fixed to true and no text says why; set it from your validation and print the reason under the box

## When not to use

- A neutral box with no error to report yet: use [Basic](./c-textarea-1.md)
- An error message printed under the box along with the red state: use [Field](../field.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Textarea

### When to use

- Messages, feedback and other free text answers that run over several lines
- Labeled long text fields with a hint under the box, an error state or a disabled state
- Profile bios that count characters toward a limit and grow as the user types

### When not to use

- A comment or prompt box with buttons or a live count inside its border: use [Input Group](../input-group.md)
- A modal that asks for a note along with reasons to tick, such as a churn survey: use the Dialog blocks
- A complete page of fields, such as a support ticket or a profile edit, saved together: use the Form blocks

### Agent notes

- `Textarea` grows with its text through `field-sizing-content` with no height cap, and Chromium ignores `rows`; set min-h and max-h classes
- Only `aria-invalid` on `Textarea` turns its border red, in every style; a data-invalid flag on `Field` leaves the border as it was
