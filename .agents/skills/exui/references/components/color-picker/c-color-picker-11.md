<!-- Generated from resources/components/color-picker/c-color-picker-11.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Channel Sliders

> Channel sliders

- Type: example, free and open source (MIT)
- Component: [Color Picker](../color-picker.md)
- Page: [local reference](./c-color-picker-11.md)
- Uses: Card, Color Picker, Input Group

## Best for

Channel by channel RGB mixing headed by a round preview chip and the live rgb string in monospace

## When not to use

- Perceptual lightness, chroma and hue tracks for a theme token: use [OKLCH Token](./c-color-picker-6.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Color Picker

### When to use

- Brand, accent and theme token settings kept as a hex, rgb or oklch string
- Label, text and highlight colors chosen from a fixed palette of named presets
- Design and drawing tools: fill and stroke inspectors, brush pickers, contrast checks and shade scales

### When not to use

- A whole settings, profile or data entry screen with many fields and a save bar: use the Form blocks
- A full document writing surface with a formatting toolbar, lists and links: use the Rich Text Editor blocks

### Agent notes

- `ColorPicker` renders no wrapper element, so its children lay out in the parent; `className` on it styles only the trigger it draws when given no children
- A value passed in any syntax `parseColor` reads is accepted, but the next change comes back written in the root `format`
- Without `alpha`, opacity in a passed value is ignored on screen and every value the picker emits is opaque
