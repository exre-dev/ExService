<!-- Generated from resources/components/icon-tile.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Icon Tile

> Open-source shadcn icon tile components for list row media, feature cards, empty states, and dashboard tiles.

- Type: upstream component, free
- Page: [local reference](./icon-tile.md)
- Examples: 17

## When to use

- Square media for list rows, feature cards and empty states, held to one size and radius
- Status and brand markers in a soft tint, a solid fill or a theme or Tailwind palette color
- Compact links, initials or counts, and glyphs with a status dot pinned to one corner

## When not to use

- A finished first run screen with heading, message and actions around the glyph: use the Empty State blocks
- A finished KPI or feature tile with a value, a label and a trend beside the glyph: use the Card blocks
- Markers for each step of a multi step flow, with active and completed states: use [Stepper](./stepper.md)

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin

## Examples

- [Default](./icon-tile/c-icon-tile-1.md): Default icon tile. Best for every variant prop left at its default, giving an outline surface at style radius around a folder glyph.
- [Elevated](./icon-tile/c-icon-tile-2.md): Elevated icon tile. Best for a lone raised chip with a muted fill, a page colored ring and a soft shadow, around a package glyph.
- [Framed](./icon-tile/c-icon-tile-3.md): Framed icon tile. Best for a muted outer ring around an inset card, the double surface that echoes the Frame primitive, around a dashboard glyph.
- [All Variants](./icon-tile/c-icon-tile-4.md): All variants. Best for the 5 surface treatments in one row around the same package glyph, for comparing them before picking one.
- [Sizes](./icon-tile/c-icon-tile-5.md): Sizes. Best for elevated tiles at xs, sm, default, lg and xl, bottom aligned so box and glyph growth compare step by step.
- [Circular](./icon-tile/c-icon-tile-6.md): Circular tiles. Best for large round tiles in the outline, elevated and nested card surfaces, with globe, star and check glyphs.
- [Custom Sizing](./icon-tile/c-icon-tile-7.md): Custom sizing. Best for resizing outside the size prop 2 ways, size classes on tile and glyph or both size variables in one class.
- [Color Tones](./icon-tile/c-icon-tile-8.md): Color tones. Best for outline tiles tinted by hand with fill, border and glyph classes for primary, success, warning and destructive.
- [Text Content](./icon-tile/c-icon-tile-9.md): Text content. Best for initials and a count in place of a glyph, the first on a raised tile and the second in a round outline with muted text.
- [List Row](./icon-tile/c-icon-tile-10.md): List row. Best for a small raised tile in the media slot of an outlined Item row, beside a file title and an updated by line.
- [Feature Card](./icon-tile/c-icon-tile-11.md): Feature card. Best for a large raised tile heading a Frame panel, stacked over a feature title and one sentence of copy.
- [Empty State](./icon-tile/c-icon-tile-12.md): Empty state. Best for the largest tile in its nested card surface as the media of an Empty header, above a no files title and hint.
- [Interactive](./icon-tile/c-icon-tile-13.md): Interactive tile. Best for a raised tile rendered as a link with its own accessible name, a hover fill and a keyboard focus ring.
- [Status Overlay](./icon-tile/c-icon-tile-14.md): Status overlay. Best for a raised globe tile with a green dot pinned to its top end corner, cut out by a page colored ring.
- [Soft Tones](./icon-tile/c-icon-tile-15.md): Soft tones. Best for soft tiles retinted through 1 text color class each, from the primary default to the info and status tones.
- [Solid Tones](./icon-tile/c-icon-tile-16.md): Solid tones. Best for filled tiles that swap the primary fill for an info, success, warning or destructive bg class with a white glyph.
- [Brand Colors](./icon-tile/c-icon-tile-17.md): Brand colors. Best for raised tiles whose fill is swapped for indigo, amber, emerald and rose palette colors while the ring and shadow stay.
