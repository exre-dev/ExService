<!-- Generated from resources/components/input-group/c-input-group-26.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Textarea Actions

> Textarea input group with action buttons

- Type: example, free and open source (MIT)
- Component: [Input Group](../input-group.md)
- Page: [local reference](./c-input-group-26.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input-group.md
- Uses: Field, Input Group

## Best for

A comment box with Cancel at the left and Post Comment at the right of its bottom row

## Agent notes

- Cancel and Post Comment have no handlers and the `InputGroupTextarea` is uncontrolled; read and clear the text yourself

## When not to use

- A description box that counts characters against a limit: use [Character Limit](./c-input-group-17.md)
- A multi line field with no actions inside its border: use [Textarea](../textarea.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Input Group

### When to use

- Text fields with a leading icon, prefix or suffix text, a unit or a status mark inside one border
- Search, link and API bars that end in a copy, clear, filter, menu or send control
- Prompt and comment composers: a text area with a toolbar row above or below the text

### When not to use

- Selects, fields and actions joined edge to edge, each keeping its own border: use [Button Group](../button-group.md)
- A plain text field with no icon, text or action inside its border: use [Input](../input.md)
- A complete assistant screen with a message thread above the prompt box: use the AI Chat blocks

### Agent notes

- The border turns red from `aria-invalid` on the control; `data-invalid` on `Field` only tints text, so set both as `c-input-group-3` does
- Addon icons and text never name the control; tie a `FieldLabel` to the input or textarea id as `c-input-group-20` does, or give it an aria label
- `InputGroupButton` defaults `type` to button, so pass submit when it should send the surrounding form
