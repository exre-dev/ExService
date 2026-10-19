<!-- Generated from resources/components/badge/c-badge-23.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn As Link

> Badge rendered as a link

- Type: example, free and open source (MIT)
- Component: [Badge](../badge.md)
- Page: [local reference](./c-badge-23.md)
- Uses: Badge

## Best for

An outline label rendered as an anchor, so the whole chip navigates and takes keyboard focus

## Agent notes

- The anchor goes through `render` on the base twin and `asChild` on the radix twin; replace the `href` placeholder with your route

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
