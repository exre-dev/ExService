<!-- Generated from resources/components/hover-card.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Hover Card

> Open-source shadcn hover card components for profile previews, rich link previews, and contextual details.

- Type: shadcn/ui component, free
- Page: [local reference](./hover-card.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/hover-card.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/hover-card.md
- Examples: 8

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `HoverCardContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { HoverCardContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof HoverCardContent>) {
  return <HoverCardContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Profile previews on a person's name or avatar, with photo, handle, role and join date
- Feature, image and release note previews shown on hover or focus of a button or link
- Exact dates and times behind a short inline label, such as a relative deploy time in a sentence

## When not to use

- Content opened by a click or tap, such as a form or settings to change: use [Popover](./popover.md)
- A one line label that names an icon button or a control: use [Tooltip](./tooltip.md)
- Content that stays visible in the page layout without a pointer over it: use [Card](./card.md)

## Agent notes

- Timing is `delay` and `closeDelay` on the base `HoverCardTrigger` but `openDelay` and `closeDelay` on the radix `HoverCard` root
- Without `render` on the base twin or `asChild` on radix, `HoverCardTrigger` renders a link with no href, which Tab skips
- The radix `HoverCardContent` sets tabindex -1 on every link and button inside it, so keep keyboard actions outside the card

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started), used by 1 of 8 examples

## Examples

- [Basic](./hover-card/c-hover-card-1.md): Basic hover card.. Best for the minimal anatomy: an outline Button trigger and a card holding a heading over one muted line.
- [Positions](./hover-card/c-hover-card-2.md): Hover card with positions.. Best for a grid of outline triggers, one per placement, each opening its card on the side its label names.
- [Profile](./hover-card/c-hover-card-3.md): Hover card with profile information.. Best for a person's avatar, name and handle as the trigger, opening a larger photo with role and join date.
- [Icon](./hover-card/c-hover-card-4.md): Hover card with icon. Best for a feature callout on an outline button, an amber bolt icon beside a short title and a muted blurb.
- [Image & Text](./hover-card/c-hover-card-5.md): Hover card with an image and text content.. Best for an edge to edge 16:9 picture across the top of a 320px wide card, captioned by a title and one line.
- [In Dialog](./hover-card/c-hover-card-6.md): Hover card inside a dialog.. Best for a trigger set in the body of an open Dialog, below its title and description, for previews inside a modal.
- [Live Timestamp](./hover-card/c-hover-card-7.md): Timestamp hover card with active relative time. Best for a dashed underline relative time inside a sentence, opening the exact deploy time over a live clock that ticks each second.
- [Release Notes](./hover-card/c-hover-card-8.md): Hover card with paginated release notes. Best for a dashed What's new link opening release entries stepped through with arrow buttons and a dot per entry.
