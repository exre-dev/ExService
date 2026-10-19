<!-- Generated from resources/components/button-group/c-button-group-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Basic Pagination

> Button group used for standard pagination

- Type: example, free and open source (MIT)
- Component: [Button Group](../button-group.md)
- Page: [local reference](./c-button-group-10.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/button-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/button-group.md
- Uses: Button, Button Group

## Best for

Previous and Next text buttons with arrows around small page numbers 1 to 3, none marked as current

## When not to use

- Page navigation that needs real links, an ellipsis and a marked current page: use [Pagination](../pagination.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Button Group

### When to use

- Toolbars of related actions joined into one strip, such as editor, media, zoom or export controls
- Split buttons that pair a main action with a chevron menu of its variants, such as Save or Publish
- Segmented pickers and filter bars that join buttons to selects, inputs, counters and status text

### When not to use

- Segmented choices whose pressed option screen readers must hear announced: use [Toggle Group](../toggle-group.md)
- A text field with an icon, prefix or action drawn inside its own border: use [Input Group](../input-group.md)
- A single standalone action, or actions spaced apart with no shared border: use [Button](../button.md)

### Agent notes

- On the base twin only children with a `data-slot` join at the seams, while radix joins every child; wrap custom markup in `ButtonGroupText`
- `ButtonGroup` sets `role` group but no name; pass `aria-label` so screen readers say what the set controls
