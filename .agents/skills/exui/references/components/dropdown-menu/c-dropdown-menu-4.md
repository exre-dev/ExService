<!-- Generated from resources/components/dropdown-menu/c-dropdown-menu-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Keyboard Shortcuts

> Dropdown menu with keyboard shortcuts

- Type: example, free and open source (MIT)
- Component: [Dropdown Menu](../dropdown-menu.md)
- Page: [local reference](./c-dropdown-menu-4.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/dropdown-menu.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/dropdown-menu.md
- Uses: Button, Dropdown Menu

## Best for

Key chord hints right aligned on every row of a short account list with no icons

## Agent notes

- `DropdownMenuShortcut` only prints the chord text; nothing listens for those keys, so bind them in your app

## When not to use

- A searchable palette of actions opened from the keyboard and filtered by typing: use [Command](../command.md)

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
