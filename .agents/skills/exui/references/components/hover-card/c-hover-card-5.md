<!-- Generated from resources/components/hover-card/c-hover-card-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Image & Text

> Hover card with an image and text content.

- Type: example, free and open source (MIT)
- Component: [Hover Card](../hover-card.md)
- Page: [local reference](./c-hover-card-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/hover-card.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/hover-card.md
- Uses: Button, Hover Card

## Best for

An edge to edge 16:9 picture across the top of a 320px wide card, captioned by a title and one line

## Agent notes

- The `img` loads a random grayscale picsum.photos image with alt Card Image; swap in your preview and a real description

## When not to use

- An image tile with its caption that stays on the page at all times: use [Card](../card.md)

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
