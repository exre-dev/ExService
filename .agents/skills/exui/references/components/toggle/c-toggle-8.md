<!-- Generated from resources/components/toggle/c-toggle-8.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Icon Sizes

> Toggle size variants showcase

- Type: example, free and open source (MIT)
- Component: [Toggle](../toggle.md)
- Page: [local reference](./c-toggle-8.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/toggle.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/toggle.md
- Uses: Toggle

## Best for

An icon only star toggle repeated at sm, default and lg, each row captioned in muted text

## When not to use

- Comparing the 3 sizes on controls that carry a text label: use [Text Sizes](./c-toggle-3.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Toggle

### When to use

- Editor formatting controls that stay pressed, such as bold, italic, underline and strikethrough
- Reaction and save controls, such as like, retweet, share and bookmark, with or without a count
- Media and app controls with an on and off state, such as mute, pin to sidebar or a notifications bell

### When not to use

- A one time action such as Save, Send or Delete that keeps no pressed state: use [Button](../button.md)
- Related actions joined edge to edge into one strip, such as playback or zoom controls: use [Button Group](../button-group.md)
- A set of options read as one value and crossed with arrow keys, such as text alignment: use [Toggle Group](../toggle-group.md)

### Agent notes

- Pressed state lives inside each `Toggle` or a local `useState` and nothing saves it; read changes from `onPressedChange` to persist them
- Every `Toggle` here is named by `aria-label`, which wins over its visible text for screen readers, so update both when relabelling
