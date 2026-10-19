<!-- Generated from resources/components/drawer.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Drawer

> Open-source shadcn drawer components for mobile panels, slide-over forms, and secondary workflows.

- Type: shadcn/ui component, free
- Page: [local reference](./drawer.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/drawer.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/drawer.md
- Examples: 5

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `DrawerContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { DrawerContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof DrawerContent>) {
  return <DrawerContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Touch panels that slide in from a screen edge and close with a swipe
- Mobile tasks with a scrolling body between a title and footer actions

## When not to use

- A desktop side panel opened by mouse or keyboard with no swipe gesture: use [Sheet](./sheet.md)
- A slide out mini bag with quantity steppers, subtotal and checkout: use the Shopping Cart blocks
- A centered modal for a short form or a confirmation: use [Dialog](./dialog.md)

## Agent notes

- Set the edge with `swipeDirection` down, up, left or right on the base twin and `direction` bottom, top, left or right on radix
- The base `Drawer` draws no grab handle unless you pass `showSwipeHandle`; the radix one draws it on every bottom drawer
- The footer Submit `Button` has no handler and leaves the drawer open, unlike the `DrawerClose` Cancel beside it

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Vaul v1: [API reference](https://vaul.emilkowal.ski/api), [docs](https://vaul.emilkowal.ski/getting-started), through the Radix UI twin (its repo is marked unmaintained by its author)

## Examples

- [Scrollable Content](./drawer/c-drawer-1.md): A basic drawer with scrollable content. Best for the default bottom panel, capped at 80vh, that a downward swipe dismisses.
- [Right Side](./drawer/c-drawer-2.md): A drawer that opens from the right side. Best for a panel docked to the right edge that the user swipes right to dismiss.
- [Left Side](./drawer/c-drawer-3.md): A drawer that opens from the left side. Best for a panel docked to the left edge, closed by a swipe toward the left.
- [Top Side](./drawer/c-drawer-4.md): A drawer that opens from the top side. Best for a drawer that drops from the top edge, capped at 80vh, and closes with an upward swipe.
- [All Sides](./drawer/c-drawer-5.md): Drawers opening from different sides. Best for a row of 4 triggers, one drawer per edge, for comparing the directions side by side.
