<!-- Generated from resources/components/icon-tile/c-icon-tile-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Custom Sizing

> Custom sizing

- Type: example, free and open source (MIT)
- Component: [Icon Tile](../icon-tile.md)
- Page: [local reference](./c-icon-tile-7.md)
- Uses: Icon Tile

## Best for

Resizing outside the size prop 2 ways, size classes on tile and glyph or both size variables in one class

## Agent notes

- `size-14` on the tile resizes only the box; the glyph keeps the default step's size unless it carries its own `size-7`

## When not to use

- A box that matches one of the built in steps from xs to xl: use [Sizes](./c-icon-tile-5.md)

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
