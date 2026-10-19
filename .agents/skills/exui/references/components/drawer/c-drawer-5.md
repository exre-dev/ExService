<!-- Generated from resources/components/drawer/c-drawer-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn All Sides

> Drawers opening from different sides

- Type: example, free and open source (MIT)
- Component: [Drawer](../drawer.md)
- Page: [local reference](./c-drawer-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/drawer.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/drawer.md
- Uses: Button, Drawer

## Best for

A row of 4 triggers, one drawer per edge, for comparing the directions side by side

## Agent notes

- Keep 1 entry of `SIDES` and pass its `swipeDirection`, or `direction` on radix, to `Drawer`; the demo mounts a drawer per edge

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Drawer

### When to use

- Touch panels that slide in from a screen edge and close with a swipe
- Mobile tasks with a scrolling body between a title and footer actions

### When not to use

- A desktop side panel opened by mouse or keyboard with no swipe gesture: use [Sheet](../sheet.md)
- A slide out mini bag with quantity steppers, subtotal and checkout: use the Shopping Cart blocks
- A centered modal for a short form or a confirmation: use [Dialog](../dialog.md)

### Agent notes

- Set the edge with `swipeDirection` down, up, left or right on the base twin and `direction` bottom, top, left or right on radix
- The base `Drawer` draws no grab handle unless you pass `showSwipeHandle`; the radix one draws it on every bottom drawer
- The footer Submit `Button` has no handler and leaves the drawer open, unlike the `DrawerClose` Cancel beside it
