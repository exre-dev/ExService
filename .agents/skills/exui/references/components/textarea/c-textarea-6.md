<!-- Generated from resources/components/textarea/c-textarea-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Auto-Resize Counter

> Auto-resize textarea with character count

- Type: example, free and open source (MIT)
- Component: [Textarea](../textarea.md)
- Page: [local reference](./c-textarea-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/textarea.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/textarea.md
- Uses: Field, Textarea

## Best for

A 280 character Bio whose live count by the label turns to the warning tone 20 short of the cap and red at it

## Agent notes

- `handleChange` drops any edit that would pass `MAX_CHARS`, so a long paste is lost whole; set the maxLength attribute to cut it to fit
- Height is set inline from `scrollHeight` only in `handleChange`, so clearing `value` from code leaves the box at its last height
- `text-warning` needs a warning color in your theme; this item installs none, so near the cap the count falls back to the inherited text color

## When not to use

- A character count kept in a row inside the border, under the text: use [Input Group](../input-group.md)

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
