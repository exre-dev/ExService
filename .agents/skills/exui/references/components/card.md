<!-- Generated from resources/components/card.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Card

> Open-source shadcn card components for content previews, dashboard widgets, and product summaries.

- Type: shadcn/ui component, free
- Page: [local reference](./card.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/card.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/card.md
- Examples: 18

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Compact component padding

ExUI uses `1rem` padding (16px at a 16px root) for default Card insets, all sides of `AlertDialogContent`, `SheetHeader` and `SheetFooter`, vertical padding in `CommandEmpty` and DataGrid empty-table/filter messages, all sides of Gantt's no-resource message, and bottom padding between vertical `TimelineItem` entries. Empty-state padding appears only when that state is rendered; Timeline's last item has no added bottom padding. Caller classes can override these defaults.

Card's default and `sm` sizes both use `1rem` insets. `--card-spacing` controls those insets; `--card-gap` controls the separate section gap, which remains `1.5rem` by default and `1rem` for `sm`. Header bottom and Footer top insets appear when the corresponding border is added; a leading image still removes the Card's top inset.

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Card`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Card } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Card>) {
  return <Card {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Titled sections with body copy and footer actions, such as a help notice or a sign in form
- Image tiles with a photo above the copy or filling the tile under a dark text overlay
- Dashboard widgets such as a KPI with a trend, a usage meter or a deployment or integration status

## When not to use

- A finished grid of KPI tiles, feature links or profile records ready to drop in: use the Card blocks
- A KPI panel with a range filter, a segmented meter or an activity feed beneath it: use the Stats blocks
- A preview that pops up over a link while the pointer rests on it: use [Hover Card](./hover-card.md)

## Agent notes

- Each example caps `Card` with `max-w-xs`, `max-w-sm` or `max-w-md`; drop the cap when the card should fill a grid cell or column
- `size` sm on `Card` tightens padding and gaps in every style; none of these examples sets it, so try it before padding overrides

## Examples

- [Basic](./card/c-card-1.md): Basic card. Best for the plain anatomy of title, description, body text and a full width outline button in the footer.
- [Bordered Header](./card/c-card-2.md): Card header with border. Best for a header ruled off from the body by a bottom border, with a description line and no footer.
- [Border Separation](./card/c-card-3.md): Card with border separation. Best for tight zero gap sections: a slim header with its own button, a body ruled above and below, and a footer button.
- [Header & Footer](./card/c-card-4.md): Card with header and footer. Best for a titled header and a footer button, each split from the body by a rule, with no description line.
- [Link Action](./card/c-card-5.md): Card with link. Best for a help notice whose only action is a link style button with an external link icon.
- [Dropdown Menu](./card/c-card-6.md): Card with dropdown menu. Best for a help notice with an overflow menu of team actions in the header and an avatar chip button in the footer.
- [Inset Image](./card/c-card-7.md): Card with image. Best for a rounded photo inset above a Trending badge, a Featured tag, a blurb and a Get Started button.
- [Image Hover Zoom](./card/c-card-8.md): Card with image scale hover effect. Best for a full bleed photo that zooms on hover under a bottom dark gradient holding a white title and line.
- [Full Image](./card/c-card-9.md): Card with full image. Best for an edge to edge photo flush with the top, then a centered badge, blurb and a fit width call to action.
- [Image Shadow Fade](./card/c-card-10.md): Full card with image and shadow fade effect. Best for a tall photo with dark fades top and bottom and an author row of verified avatar, email and New badge over it.
- [Stacked Depth](./card/c-card-11.md): Card with stacked depth effect. Best for a stacked deck look from 2 blank layers peeking out below the bottom edge, behind a standard title, body and footer.
- [Login Form](./card/c-card-12.md): Advanced clean login form card. Best for a sign in form with email, a password field that toggles visibility, a forgot link, a GitHub button and terms.
- [Billing Usage](./card/c-card-13.md): Expandable billing usage card. Best for credit used against the plan on a progress bar over 5 cost rows that fade out until a round toggle expands them.
- [Deployment Status](./card/c-card-14.md): Deployment status summary card. Best for a deployment success message under a glowing terminal icon on a fuchsia fade, then 4 striped label and value rows.
- [Stat Trend](./card/c-card-15.md): Stat card with trend and overflow menu. Best for a single KPI with label, large figure, a trend badge that flips color and arrow for a drop, last month value and a 5 item menu.
- [Badge & Actions](./card/c-card-16.md): Card with header badge and actions. Best for an integration tile: a Live strip with a dots menu, an Installed badge, 3 avatars plus a count, and a full width Open button.
- [Icon & Link](./card/c-card-17.md): Card with icon, title and link. Best for a solid primary icon tile above a linked title, a muted summary and a small View link with a chevron.
- [Label & Link](./card/c-card-18.md): Card with header label and link. Best for a muted icon and label in a bordered top strip, then a summary and a small link with a leading chain icon.
