<!-- Generated from resources/components/hover-card/c-hover-card-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Live Timestamp

> Timestamp hover card with active relative time

- Type: example, free and open source (MIT)
- Component: [Hover Card](../hover-card.md)
- Page: [local reference](./c-hover-card-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/hover-card.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/hover-card.md
- Uses: Badge, Hover Card, Separator

## Best for

A dashed underline relative time inside a sentence, opening the exact deploy time over a live clock that ticks each second

## Agent notes

- `referenceTime` is always 2 hours before `now`; set it from your real deploy timestamp
- The UTC row runs `referenceTime` through date-fns `format`, which prints local time; convert it to UTC or relabel that row

## When not to use

- The same timestamp detail opened with a tap on a touch screen: use [Popover](../popover.md)

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Hover Card

### When to use

- Profile previews on a person's name or avatar, with photo, handle, role and join date
- Feature, image and release note previews shown on hover or focus of a button or link
- Exact dates and times behind a short inline label, such as a relative deploy time in a sentence

### When not to use

- Content opened by a click or tap, such as a form or settings to change: use [Popover](../popover.md)
- A one line label that names an icon button or a control: use [Tooltip](../tooltip.md)
- Content that stays visible in the page layout without a pointer over it: use [Card](../card.md)

### Agent notes

- Timing is `delay` and `closeDelay` on the base `HoverCardTrigger` but `openDelay` and `closeDelay` on the radix `HoverCard` root
- Without `render` on the base twin or `asChild` on radix, `HoverCardTrigger` renders a link with no href, which Tab skips
- The radix `HoverCardContent` sets tabindex -1 on every link and button inside it, so keep keyboard actions outside the card
