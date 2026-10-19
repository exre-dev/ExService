<!-- Generated from resources/components/popover.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Popover

> Open-source shadcn popover components for inline settings, contextual actions, and lightweight overlays.

- Type: shadcn/ui component, free
- Page: [local reference](./popover.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/popover.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/popover.md
- Examples: 11

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `PopoverContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { PopoverContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof PopoverContent>) {
  return <PopoverContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Quick edits and settings opened from a button, such as layer dimensions, switches or a volume slider
- Previews opened by a click, such as a person's bio card, a template image with actions or an AI feature pitch
- Inline details and short guides, such as exact times behind a relative date or a stepped feature tour

## When not to use

- A full account page that edits a person's name, avatar, email, team and billing: use the Profile blocks
- A full page of record fields, such as an invoice or a product, ending in a submit row: use the Form blocks
- A task that must block the page and hold focus until the user answers: use [Dialog](./dialog.md)

## Agent notes

- Compose `PopoverTrigger` through `render` on the base twin and `asChild` on the radix twin, as every example does; the other twin's prop does not compose
- `PopoverContent` is w-72 in both twins whatever it holds; size it with a width class such as `w-auto` or `w-64`
- The base `PopoverTitle` names the popup for screen readers; the radix one is a plain div, so give radix `PopoverContent` an `aria-label`

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started), used by 1 of 11 examples

## Examples

- [Basic](./popover/c-popover-1.md): Basic popover.. Best for the minimal anatomy: a title and a one line description in the header part, with no body or actions.
- [Opening Sides](./popover/c-popover-2.md): Popovers opening from different sides.. Best for one trigger per side in a button grid, each opening a narrow panel on that side to compare placements.
- [Inline Form](./popover/c-popover-3.md): Popover with form.. Best for a Dimensions header over 2 inline label and input rows for width and height, with no submit button.
- [Alignment](./popover/c-popover-4.md): Popover alignment positions.. Best for a row of 3 small buttons whose auto width panels line up with the start, center or end of their trigger.
- [In Dialog](./popover/c-popover-5.md): Popover within a dialog.. Best for a second layer nested in an open modal: a button in the modal body opens a title and description panel.
- [Profile Card](./popover/c-popover-6.md): Popover with user profile details.. Best for a person chip with avatar, name and handle that opens a bio card with follower counts and a Follow button.
- [Feature Pitch](./popover/c-popover-7.md): Popover with custom content. Best for a feature pitch with a primary tinted header bar, a short explainer and Enable AI and Learn more buttons.
- [Media Preview](./popover/c-popover-8.md): Popover with media preview.. Best for an edge to edge 16:9 image that zooms on hover, above a template name, a one line summary and 2 action buttons.
- [Relative Time](./popover/c-popover-9.md): Relative time popover with timezone details. Best for a relative time inside a sentence, behind a dashed underline, that opens exact dates and clock times updating each second.
- [Controls](./popover/c-popover-10.md): Popover with controls. Best for an icon only settings button opening 2 labeled switches and a volume slider with a live percent readout.
- [Step Tour](./popover/c-popover-11.md): Popover with navigation. Best for a 4 step tour opening above its button, with a step counter and back and next arrows that stop at either end.
