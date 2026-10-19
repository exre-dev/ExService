<!-- Generated from resources/components/icon-tile/c-icon-tile-12.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Empty State

> Empty state

- Type: example, free and open source (MIT)
- Component: [Icon Tile](../icon-tile.md)
- Page: [local reference](./c-icon-tile-12.md)
- Uses: Empty, Icon Tile

## Best for

The largest tile in its nested card surface as the media of an Empty header, above a no files title and hint

## Agent notes

- Leave `EmptyMedia` on its default variant; its icon variant is a fixed muted box smaller than this xl tile

## When not to use

- A layered isometric drawing as the focal art of a first run screen: use [Icon Stack](../icon-stack.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Icon Tile

### When to use

- Square media for list rows, feature cards and empty states, held to one size and radius
- Status and brand markers in a soft tint, a solid fill or a theme or Tailwind palette color
- Compact links, initials or counts, and glyphs with a status dot pinned to one corner

### When not to use

- A finished first run screen with heading, message and actions around the glyph: use the Empty State blocks
- A finished KPI or feature tile with a value, a label and a trend beside the glyph: use the Card blocks
- Markers for each step of a multi step flow, with active and completed states: use [Stepper](../stepper.md)
