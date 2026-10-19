<!-- Generated from resources/components/dropdown-menu/c-dropdown-menu-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Workspace Switcher

> Workspace switcher dropdown menu

- Type: example, free and open source (MIT)
- Component: [Dropdown Menu](../dropdown-menu.md)
- Page: [local reference](./c-dropdown-menu-10.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/dropdown-menu.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/dropdown-menu.md
- Uses: Avatar, Button, Dropdown Menu

## Best for

Switching among 3 workspaces shown by logo or avatar, name and plan, with a check on the active one and create or manage rows

## Agent notes

- Rows set `activeWorkspaceId` from `onSelect`, which Base UI never fires on a click; move that call to a click handler on the base twin
- `workspaces` is sample data with brand logos; replace it with the user's own workspaces and their images

## When not to use

- A switcher at the head of a full side navigation with grouped links: use [Sidebar](../sidebar.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Dropdown Menu

### When to use

- Action and overflow menus on a button or a dots icon, such as edit, duplicate, share, export and delete
- Account, workspace and create menus showing the signed in user, workspace switching and sign out
- Toggles, exclusive choices and short lists, such as panel layout, theme, AI models or recent alerts

### When not to use

- Actions opened by right clicking or long pressing a surface, with no button to press: use [Context Menu](../context-menu.md)
- A whole top bar with search, alerts, switchers and the user dropdown already placed: use the Navbar blocks
- The account settings page an avatar link opens, with identity, team and billing forms: use the Profile blocks

### Agent notes

- `DropdownMenuLabel` throws on the base twin unless it sits inside a `DropdownMenuGroup` or `DropdownMenuRadioGroup`
- On the base twin run an item's action from `onClick`; `onSelect` is a Radix item event that Base UI never fires
- Pass the trigger element through `render` on the base twin and as the `asChild` child on radix; the prop meant for the other twin does nothing
