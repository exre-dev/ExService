<!-- Generated from resources/components/popover/c-popover-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Opening Sides

> Popovers opening from different sides.

- Type: example, free and open source (MIT)
- Component: [Popover](../popover.md)
- Page: [local reference](./c-popover-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/popover.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/popover.md
- Uses: Button, Popover

## Best for

One trigger per side in a button grid, each opening a narrow panel on that side to compare placements

## Agent notes

- The base `sides` list adds `inline-start` and `inline-end`, logical sides that follow text direction, which the radix `PopoverContent` does not accept

## When not to use

- Sliding the panel along one edge of the trigger rather than changing the edge: use [Alignment](./c-popover-4.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Popover

### When to use

- Quick edits and settings opened from a button, such as layer dimensions, switches or a volume slider
- Previews opened by a click, such as a person's bio card, a template image with actions or an AI feature pitch
- Inline details and short guides, such as exact times behind a relative date or a stepped feature tour

### When not to use

- A full account page that edits a person's name, avatar, email, team and billing: use the Profile blocks
- A full page of record fields, such as an invoice or a product, ending in a submit row: use the Form blocks
- A task that must block the page and hold focus until the user answers: use [Dialog](../dialog.md)

### Agent notes

- Compose `PopoverTrigger` through `render` on the base twin and `asChild` on the radix twin, as every example does; the other twin's prop does not compose
- `PopoverContent` is w-72 in both twins whatever it holds; size it with a width class such as `w-auto` or `w-64`
- The base `PopoverTitle` names the popup for screen readers; the radix one is a plain div, so give radix `PopoverContent` an `aria-label`
