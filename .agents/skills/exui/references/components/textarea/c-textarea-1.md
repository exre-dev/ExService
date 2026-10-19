<!-- Generated from resources/components/textarea/c-textarea-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Basic

> Basic textarea.

- Type: example, free and open source (MIT)
- Component: [Textarea](../textarea.md)
- Page: [local reference](./c-textarea-1.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/textarea.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/textarea.md
- Uses: Textarea

## Best for

The bare multi line box with placeholder text and no label, Field or hint around it

## Agent notes

- Only the `placeholder` names this `Textarea`, and it clears once typing starts; add a visible label as `c-textarea-3` does

## When not to use

- A box drawn in its red error state after a failed check: use [Invalid](./c-textarea-2.md)
- A message box that carries its own Cancel and Post Comment buttons: use [Input Group](../input-group.md)

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
