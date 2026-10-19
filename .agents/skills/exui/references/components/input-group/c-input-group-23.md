<!-- Generated from resources/components/input-group/c-input-group-23.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sparkles Shortcut

> Input group with Sparkles icon and complex Kbd shortcut

- Type: example, free and open source (MIT)
- Component: [Input Group](../input-group.md)
- Page: [local reference](./c-input-group-23.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input-group.md
- Uses: Field, Input Group, Kbd

## Best for

An AI generate field led by a green sparkles icon and ending in a Command plus Enter key chord

## Agent notes

- The `KbdGroup` chord is display only; nothing runs on Command Enter, so add the key handler yourself

## When not to use

- A documentation search showing one Command K key hint: use [Keyboard Shortcut](./c-input-group-13.md)

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
