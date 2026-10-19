<!-- Generated from resources/components/tooltip.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Tooltip

> Open-source shadcn tooltip components for inline hints, contextual guidance, and helper text.

- Type: shadcn/ui component, free
- Page: [local reference](./tooltip.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/tooltip.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/tooltip.md
- Examples: 16

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `TooltipContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { TooltipContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof TooltipContent>) {
  return <TooltipContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Short labels for buttons and icon only toolbar actions, with a keyboard shortcut where one exists
- Help text on an info icon, a warning, a verified mark, a locked feature or a disabled button
- Compact summaries behind a trigger, such as service status, notifications, file details or a person

## When not to use

- Content with links or buttons that keyboard users must be able to reach: use [Popover](./popover.md)
- A rich profile or page preview with a large photo, bio and dates: use [Hover Card](./hover-card.md)
- A status or count that stays readable without pointing at anything: use [Badge](./badge.md)

## Agent notes

- Outside a `TooltipProvider` the base `Tooltip` opens after 600ms and inside one at once; the radix `Tooltip` throws without one
- `TooltipTrigger` renders a `button` of its own, so a `Button` nested in it without `render` or radix `asChild` makes a button in a button
- `TooltipContent` is portaled to the end of the body with no focus guards, so a link or button in it is not next in Tab order after its trigger

## Examples

- [Basic](./tooltip/c-tooltip-1.md): Basic tooltip.. Best for the bare minimum: an outline text Button and a single line hint, Add to library, opening on the default top side.
- [Placements](./tooltip/c-tooltip-2.md): Tooltips opening from different sides.. Best for a 3 column grid of 6 outline buttons, one per placement, including the 2 logical sides that follow text direction.
- [Icon Trigger](./tooltip/c-tooltip-3.md): Tooltip with icon trigger.. Best for a ghost info button with no visible text, named by its aria-label, opening a centered line of help copy.
- [Keyboard Shortcut](./tooltip/c-tooltip-4.md): Tooltip with keyboard shortcut.. Best for a small outline save icon button whose hint pairs the action name with its key in a Kbd cap.
- [Bell With Count](./tooltip/c-tooltip-5.md): Tooltip on notification bell with badge count. Best for an icon button with a destructive count Badge that opens a 3 item activity digest under a header and a View all link.
- [Status Badges](./tooltip/c-tooltip-6.md): Tooltip with status badge. Best for a System Status button whose hint lists 3 services with Operational or Degraded badges and an updated time.
- [Verified Domain](./tooltip/c-tooltip-7.md): Tooltip with icon and description. Best for a check mark set inside a sentence after Verified domain, revealing a Verified badge and a one line explanation.
- [Toolbar Actions](./tooltip/c-tooltip-8.md): Toolbar with tooltip actions. Best for bold, italic, underline and image buttons in one ghost toolbar, each named by aria-label, under a single provider.
- [Warning](./tooltip/c-tooltip-9.md): Tooltip with warning badge. Best for a triangle alert icon button whose hint warns, behind a matching glyph, that the action cannot be undone.
- [Upgrade Prompt](./tooltip/c-tooltip-10.md): Tooltip with feature badge and upgrade link. Best for a lock icon button opening a Pro tagged feature pitch with a short blurb and an Upgrade to Pro button.
- [Avatar Role Badge](./tooltip/c-tooltip-11.md): Tooltip with avatar and role badge. Best for an avatar trigger that opens the same photo with the person's name, an Admin role badge and an email address.
- [Disabled Button](./tooltip/c-tooltip-12.md): Tooltip on disabled button with wrapper. Best for a disabled Delete Project button wrapped in a span trigger, so the reason it is locked still shows on hover.
- [Online Status](./tooltip/c-tooltip-13.md): Tooltip with online status indicator. Best for an avatar with a green presence dot whose hint repeats the photo beside the name and an Online now line.
- [File Info](./tooltip/c-tooltip-14.md): Tooltip with file info and badges. Best for a muted file name in text that opens its size, upload age and PDF and Verified tags next to a document glyph.
- [Label Badges](./tooltip/c-tooltip-15.md): Tooltip with label badges. Best for a compact 3 labels count with a tag glyph that expands into 3 colored chips under a Labels heading.
- [Unread Bell](./tooltip/c-tooltip-16.md): Tooltip with action button inside. Best for a ghost bell button with an unread dot whose hint gives the new count above a View all link.
