<!-- Generated from resources/components/menubar/c-menubar-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Icons

> Menubar with icons.

- Type: example, free and open source (MIT)
- Component: [Menubar](../menubar.md)
- Page: [local reference](./c-menubar-4.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/menubar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/menubar.md
- Uses: Menubar

## Best for

A leading icon on every row, with Profile and a destructive Sign out grouped under Account

## When not to use

- A list of plain text rows with key hints and no leading glyph: use [Basic](./c-menubar-1.md)

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
