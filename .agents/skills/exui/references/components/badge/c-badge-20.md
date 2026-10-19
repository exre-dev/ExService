<!-- Generated from resources/components/badge/c-badge-20.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn With Icon

> Badge with an icon

- Type: example, free and open source (MIT)
- Component: [Badge](../badge.md)
- Page: [local reference](./c-badge-20.md)
- Uses: Badge

## Best for

An outline label led by a check glyph that the primitive sizes to 12px with no class of its own

## Agent notes

- An svg child with no size class of its own is forced to `size-3`, so give a larger icon its own size utility

## When not to use

- A person tag with a profile photo and a remove control: use [With Avatar](./c-badge-24.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Badge

### When to use

- Status and severity labels in solid, light and outline tones for success, warning, info and errors
- Counts and short tags such as an unread number or a New marker, sized to the text around them
- Compact chips pairing a label with an icon, a dot, an avatar, a flag or a remove control, or acting as a link

### When not to use

- An action that saves, opens or submits a form when pressed: use [Button](../button.md)
- Helper text revealed when a control is hovered or focused: use [Tooltip](../tooltip.md)
- A finished KPI or profile tile with a trend or status chip as one detail: use the Card blocks

### Agent notes

- Import `Badge` from `@exre/exui`; the shadcn `Badge` of the same name lacks `size`, `radius` and the success, info and warning variants
- The default `radius` follows the style, square in lyra and sera and a pill in maia, luma and rhea; `radius` full gives a pill in every style
