<!-- Generated from resources/components/context-menu/c-context-menu-8.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Destructive Actions

> Context menu with destructive actions.

- Type: example, free and open source (MIT)
- Component: [Context Menu](../context-menu.md)
- Page: [local reference](./c-context-menu-8.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/context-menu.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/context-menu.md
- Uses: Context Menu

## Best for

Edit and Share over a divider, then Archive and a destructive Delete, every row led by an icon

## Agent notes

- The destructive `variant` only colors Delete; it runs nothing and asks for no confirmation, so open an alert dialog from it

## When not to use

- Copy, cut and paste commands for selected text or files: use [Icons](./c-context-menu-2.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Context Menu

### When to use

- Right click actions on a file, row or canvas area, such as copy, paste, share and delete
- Toggles and single choice settings changed from a right click, such as visible bars or the theme
- Long command lists split into headed sections, key hints or a nested flyout of extra tools

### When not to use

- Actions that must stay discoverable, opened from a visible button like a row's more icon: use [Dropdown Menu](../dropdown-menu.md)
- A persistent bar of File, Edit and View lists across the top of an app window: use [Menubar](../menubar.md)
- Site links in a header bar whose panels open on hover or click: use [Navigation Menu](../navigation-menu.md)

### Agent notes

- Each dashed `ContextMenuTrigger` stands in for your target; wrap the row or card in it, or pass it through `render` on base and `asChild` on radix
- `ContextMenuLabel` throws on the base twin outside a `ContextMenuGroup` or `ContextMenuRadioGroup`; the radix one renders anywhere
