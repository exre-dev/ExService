<!-- Generated from resources/components/color-picker.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Color Picker

> Open-source shadcn color picker components for brand settings, theme editors, label colors, and design tools.

- Type: upstream component, free
- Page: [local reference](./color-picker.md)
- Examples: 15

## When to use

- Brand, accent and theme token settings kept as a hex, rgb or oklch string
- Label, text and highlight colors chosen from a fixed palette of named presets
- Design and drawing tools: fill and stroke inspectors, brush pickers, contrast checks and shade scales

## When not to use

- A whole settings, profile or data entry screen with many fields and a save bar: use the Form blocks
- A full document writing surface with a formatting toolbar, lists and links: use the Rich Text Editor blocks

## Agent notes

- `ColorPicker` renders no wrapper element, so its children lay out in the parent; `className` on it styles only the trigger it draws when given no children
- A value passed in any syntax `parseColor` reads is accepted, but the next change comes back written in the root `format`
- Without `alpha`, opacity in a passed value is ignored on screen and every value the picker emits is opaque

## Examples

- [Inline Panel](./color-picker/c-color-picker-1.md): Inline color panel. Best for the default panel left open in a card, with opacity and 8 presets switched on through 2 root props.
- [Popover](./color-picker/c-color-picker-2.md): Popover picker. Best for a root with no children, so it draws its own trigger and popover, uncontrolled from a default value in a Field.
- [Color Input](./color-picker/c-color-picker-3.md): Color input. Best for typed color codes in an uncontrolled ColorPickerInput, whose swatch button opens the default popover.
- [Opacity](./color-picker/c-color-picker-4.md): Opacity. Best for a translucent scrim laid over a gradient banner and previewed live through an inline style.
- [Preset Swatches](./color-picker/c-color-picker-5.md): Preset swatches. Best for an issue label editor with 9 named preset chips, a custom color fallback and Badge ink chosen for contrast.
- [OKLCH Token](./color-picker/c-color-picker-6.md): OKLCH theme token. Best for a theme token editor in OKLCH that flags colors outside sRGB and prints the CSS line, its copy button taking the bare value.
- [Format Converter](./color-picker/c-color-picker-7.md): Format converter. Best for a custom readout built on useColorPicker and formatColor that moves beside the area once its card is wide enough.
- [Hue Wheel](./color-picker/c-color-picker-8.md): Hue wheel. Best for a ring layout for a brush, with the area filling the wheel's hole and the format menu cut to 3 entries.
- [Recent Colors](./color-picker/c-color-picker-9.md): Recent colors. Best for a hand composed popover whose history row dedupes picks and keeps the latest 8, newest first.
- [Text & Highlight](./color-picker/c-color-picker-10.md): Text and highlight colors. Best for a pair of ghost icon triggers whose underline bar mirrors the choice, each palette closing on a pick via controlled open state.
- [Channel Sliders](./color-picker/c-color-picker-11.md): Channel sliders. Best for channel by channel RGB mixing headed by a round preview chip and the live rgb string in monospace.
- [Design Inspector](./color-picker/c-color-picker-12.md): Design inspector. Best for a card of 3 independent, uncontrolled pickers whose triggers print the hex apart from its opacity percent.
- [Contrast Checker](./color-picker/c-color-picker-13.md): Contrast checker. Best for a swappable pair of default pickers scored by getContrastRatio against 3 WCAG thresholds for body and large text.
- [Brand Scale](./color-picker/c-color-picker-14.md): Brand scale. Best for one typed base color expanded into a palette of standalone ColorPickerSwatch chips, each named for screen readers.
- [Form Validation](./color-picker/c-color-picker-15.md): Form field with validation. Best for a plain HTML form read through FormData, where the picker posts under name and Field swaps its hint for the error.
