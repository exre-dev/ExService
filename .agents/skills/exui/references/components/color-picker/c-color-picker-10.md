<!-- Generated from resources/components/color-picker/c-color-picker-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Text & Highlight

> Text and highlight colors

- Type: example, free and open source (MIT)
- Component: [Color Picker](../color-picker.md)
- Page: [local reference](./c-color-picker-10.md)
- Uses: Color Picker, Frame, Separator, Toggle

## Best for

A pair of ghost icon triggers whose underline bar mirrors the choice, each palette closing on a pick via controlled open state

## Agent notes

- The toolbar only restyles a static paragraph from `ink` and `highlight`; route both to your editor's text color and highlight commands
- A `null` in `ink` or `highlight` means the default ink or no highlight, which `ColorPickerClear` sets

## When not to use

- A palette that must also accept any shade beyond its presets: use [Preset Swatches](./c-color-picker-5.md)

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
