<!-- Generated from resources/components/sheet/c-sheet-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn No Close Button

> Sheet without a corner close button

- Type: example, free and open source (MIT)
- Component: [Sheet](../sheet.md)
- Page: [local reference](./c-sheet-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/sheet.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sheet.md
- Uses: Button, Field, Input, Sheet

## Best for

The profile editor without the corner X, leaving footer Cancel as the visible way out

## Agent notes

- Save changes is a submit `Button` outside any form, so add the form element and your handler

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Sheet

### When to use

- Edit forms and long scrolling content that slide in from a screen edge over the page
- Panels pinned to the top, right, bottom or left edge, with their own footer actions

### When not to use

- A touch panel the user drags or swipes closed: use [Drawer](../drawer.md)
- A ready made record detail, notification or settings panel: use the Sheet blocks
- A short decision or form that belongs in the middle of the screen: use [Dialog](../dialog.md)

### Agent notes

- `SheetContent` draws its own corner close button; set `showCloseButton` to false when the footer closes it
- Top and bottom sheets grow with their content and have no height cap, so bound them as `c-sheet-3` does
- `SheetTrigger` and `SheetClose` take a `render` element on the base twin and `asChild` on the radix twin
