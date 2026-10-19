<!-- Generated from resources/components/sheet.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sheet

> Open-source shadcn sheet components for slide-over details, side panels, and task flows.

- Type: shadcn/ui component, free
- Page: [local reference](./sheet.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/sheet.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sheet.md
- Examples: 4

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Compact component padding

ExUI uses `1rem` padding (16px at a 16px root) for default Card insets, all sides of `AlertDialogContent`, `SheetHeader` and `SheetFooter`, vertical padding in `CommandEmpty` and DataGrid empty-table/filter messages, all sides of Gantt's no-resource message, and bottom padding between vertical `TimelineItem` entries. Empty-state padding appears only when that state is rendered; Timeline's last item has no added bottom padding. Caller classes can override these defaults.

Card's default and `sm` sizes both use `1rem` insets. `--card-spacing` controls those insets; `--card-gap` controls the separate section gap, which remains `1.5rem` by default and `1rem` for `sm`. Header bottom and Footer top insets appear when the corresponding border is added; a leading image still removes the Card's top inset.

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `SheetContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { SheetContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof SheetContent>) {
  return <SheetContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Edit forms and long scrolling content that slide in from a screen edge over the page
- Panels pinned to the top, right, bottom or left edge, with their own footer actions

## When not to use

- A touch panel the user drags or swipes closed: use [Drawer](./drawer.md)
- A ready made record detail, notification or settings panel: use the Sheet blocks
- A short decision or form that belongs in the middle of the screen: use [Dialog](./dialog.md)

## Agent notes

- `SheetContent` draws its own corner close button; set `showCloseButton` to false when the footer closes it
- Top and bottom sheets grow with their content and have no height cap, so bound them as `c-sheet-3` does
- `SheetTrigger` and `SheetClose` take a `render` element on the base twin and `asChild` on the radix twin

## Examples

- [Profile Editor](./sheet/c-sheet-1.md): Sheet containing a form for editing profile information. Best for a right side profile editor with 2 fields, Save changes, Cancel and the corner X.
- [No Close Button](./sheet/c-sheet-2.md): Sheet without a corner close button. Best for the profile editor without the corner X, leaving footer Cancel as the visible way out.
- [Any Side](./sheet/c-sheet-3.md): Sheets that open from any side. Best for one trigger per edge, top, right, bottom and left, with top and bottom sheets held to half the screen.
- [Scrollable Content](./sheet/c-sheet-4.md): Sheet with scrollable content. Best for a long body in a ScrollArea between a pinned header and a Save and Cancel footer.
