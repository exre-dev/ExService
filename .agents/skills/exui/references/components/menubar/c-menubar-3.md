<!-- Generated from resources/components/menubar/c-menubar-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Checkbox & Radio

> Menubar with checkbox & radio items.

- Type: example, free and open source (MIT)
- Component: [Menubar](../menubar.md)
- Page: [local reference](./c-menubar-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/menubar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/menubar.md
- Uses: Menubar

## Best for

A View list of 2 browser toggles beside a Theme list whose Light, Dark or System pick is held in state

## Agent notes

- `theme` only moves the radio tick; hand the Light, Dark or System pick to your theme provider
- Neither `MenubarCheckboxItem` is held in state, so Full URLs never unticks and on radix Bookmarks Bar never ticks

## When not to use

- Browser view toggles opened with a right click on the page, with no top bar: use [Context Menu](../context-menu.md)
- Options a user ticks inside a form that is always on screen: use [Checkbox](../checkbox.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Menubar

### When to use

- Desktop style command bars of File, Edit and Account lists, with key hints and side flyouts
- Formatting and insert lists for a document editor, such as Bold, Italic, Media and Link
- View toggles and a single choice setting kept in the top bar, such as bookmarks or the theme

### When not to use

- A single list of actions or account options opened from one button: use [Dropdown Menu](../dropdown-menu.md)
- Commands opened by right clicking a file, row or canvas, with no visible trigger: use [Context Menu](../context-menu.md)
- A signed in product header holding the logo, search, alerts and the user avatar: use the Navbar blocks

### Agent notes

- Give each `MenubarItem` its command through onClick, which both twins fire; Base UI never fires the Radix onSelect event
- `MenubarShortcut` is a plain span that prints the chord only; register the keys in your own keydown listener
- `MenubarLabel` throws on the base twin unless it sits inside a `MenubarGroup` or `MenubarRadioGroup`
