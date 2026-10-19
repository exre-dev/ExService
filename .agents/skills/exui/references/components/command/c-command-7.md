<!-- Generated from resources/components/command/c-command-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Action Palette

> Action palette with keyboard shortcuts

- Type: example, free and open source (MIT)
- Component: [Command](../command.md)
- Page: [local reference](./c-command-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/command.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/command.md
- Uses: Button, Command

## Best for

Task verbs grouped as Create, Navigate and System, from New Project and Invite Member to dark mode and sign out

## Agent notes

- No listener binds the `CommandShortcut` hints such as ⌘N and ⌘⇧D; register each key yourself
- `CommandShortcut` lists ⌘N and ⌘Q, which browsers keep for a new window and quit; pick other keys before you bind them

## When not to use

- A jump list of starred and recently visited pages rather than tasks: use [Recent & Favorites](./c-command-8.md)

## Third-party libraries

- cmdk v1: [API reference](https://github.com/dip/cmdk#parts-and-styling), [docs](https://github.com/dip/cmdk), through shadcn Command

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Command

### When to use

- Keyboard driven palettes in a modal that search actions, pages and settings from one input
- Search lists of files, team members, favorites and recent pages that narrow as the user types
- Inline menus kept open in a card or panel, with grouped rows and keyboard shortcut hints

### When not to use

- A form field that keeps the option the user picks, such as a country or an assignee: use [Combobox](../combobox.md)
- A complete product layout with sidebar navigation, where search is only one of its parts: use the App Shell blocks
- A top bar above your page with brand, menus and alerts, where search sits beside them: use the Navbar blocks

### Agent notes

- No example gives a `CommandItem` a select handler, so pressing Enter or clicking a row runs nothing until you add one
- `CommandList` stops at 18rem tall in every style and scrolls the rows past that height inside itself
