<!-- Generated from resources/components/command/c-command-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Basic

> Basic command

- Type: example, free and open source (MIT)
- Component: [Command](../command.md)
- Page: [local reference](./c-command-1.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/command.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/command.md
- Uses: Card, Command

## Best for

An always open list inside a narrow Card, with a disabled Calculator row and shortcut hints on the Settings rows only

## Agent notes

- `disabled` on the Calculator `CommandItem` drops it from arrow key navigation and ignores clicks on it

## When not to use

- The same Suggestions and Settings groups opened in a modal from a button: use [Groups](./c-command-3.md)

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
