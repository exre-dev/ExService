<!-- Generated from resources/components/button-group/c-button-group-53.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Publish Controls

> Publish controls with split button and overflow

- Type: example, free and open source (MIT)
- Component: [Button Group](../button-group.md)
- Page: [local reference](./c-button-group-53.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/button-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/button-group.md
- Uses: Avatar, Button, Button Group, Dropdown Menu, Separator

## Best for

A publishing header row: 2 viewer avatars, a Preview button, a filled Publish split and a ghost overflow menu

## Agent notes

- Only Publish and its chevron sit in `ButtonGroup`; the avatars, Preview and overflow menu are a plain flex row
- Replace `viewers`, whose avatars load from images.unsplash.com, with the people viewing the document
- Below `md` the Preview `Button` hides its text and is left with no accessible name

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
