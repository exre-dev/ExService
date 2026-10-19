<!-- Generated from resources/components/badge/c-badge-21.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Dismiss Button

> Badge with a dismiss button

- Type: example, free and open source (MIT)
- Component: [Badge](../badge.md)
- Page: [local reference](./c-badge-21.md)
- Uses: Badge, Button

## Best for

An outline tag ending in an X inside a ghost icon button shrunk to 12px, for removable filters

## Agent notes

- The X `Button` has no click handler and no accessible name; wire the removal and give it an aria-label such as Remove

## When not to use

- A removable tag that also shows whose it is with a photo: use [With Avatar](./c-badge-24.md)

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
