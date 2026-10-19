<!-- Generated from resources/components/card/c-card-15.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Stat Trend

> Stat card with trend and overflow menu

- Type: example, free and open source (MIT)
- Component: [Card](../card.md)
- Page: [local reference](./c-card-15.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/card.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/card.md
- Uses: Badge, Button, Card, Dropdown Menu, Separator

## Best for

A single KPI with label, large figure, a trend badge that flips color and arrow for a drop, last month value and a 5 item menu

## Agent notes

- Lift `title`, `value`, `delta`, `positive` and `lastMonth` into props; they are constants inside the component
- `positive` picks the badge variant and arrow; derive it from the sign of `delta` so the two cannot disagree
- None of the 5 `DropdownMenuItem` actions has a handler, including the destructive Remove

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Card

### When to use

- Titled sections with body copy and footer actions, such as a help notice or a sign in form
- Image tiles with a photo above the copy or filling the tile under a dark text overlay
- Dashboard widgets such as a KPI with a trend, a usage meter or a deployment or integration status

### When not to use

- A finished grid of KPI tiles, feature links or profile records ready to drop in: use the Card blocks
- A KPI panel with a range filter, a segmented meter or an activity feed beneath it: use the Stats blocks
- A preview that pops up over a link while the pointer rests on it: use [Hover Card](../hover-card.md)

### Agent notes

- Each example caps `Card` with `max-w-xs`, `max-w-sm` or `max-w-md`; drop the cap when the card should fill a grid cell or column
- `size` sm on `Card` tightens padding and gaps in every style; none of these examples sets it, so try it before padding overrides
