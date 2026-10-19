<!-- Generated from resources/components/hover-card/c-hover-card-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Profile

> Hover card with profile information.

- Type: example, free and open source (MIT)
- Component: [Hover Card](../hover-card.md)
- Page: [local reference](./c-hover-card-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/hover-card.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/hover-card.md
- Uses: Avatar, Hover Card

## Best for

A person's avatar, name and handle as the trigger, opening a larger photo with role and join date

## Agent notes

- `HoverCardTrigger` renders as a plain `div` here, which is not focusable, so keyboard users never open the card; make it a profile link
- Name, handle and the Unsplash photo URL are typed twice, in the trigger and in `HoverCardContent`; feed both from one user object

## When not to use

- An avatar that opens a list of account actions on click: use [Dropdown Menu](../dropdown-menu.md)

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
