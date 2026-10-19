<!-- Generated from resources/components/command.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Command

> Open-source shadcn command menu components for command palettes, global search, and power-user navigation.

- Type: shadcn/ui component, free
- Page: [local reference](./command.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/command.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/command.md
- Examples: 8

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Compact component padding

ExUI uses `1rem` padding (16px at a 16px root) for default Card insets, all sides of `AlertDialogContent`, `SheetHeader` and `SheetFooter`, vertical padding in `CommandEmpty` and DataGrid empty-table/filter messages, all sides of Gantt's no-resource message, and bottom padding between vertical `TimelineItem` entries. Empty-state padding appears only when that state is rendered; Timeline's last item has no added bottom padding. Caller classes can override these defaults.

Card's default and `sm` sizes both use `1rem` insets. `--card-spacing` controls those insets; `--card-gap` controls the separate section gap, which remains `1.5rem` by default and `1rem` for `sm`. Header bottom and Footer top insets appear when the corresponding border is added; a leading image still removes the Card's top inset.

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Command`, `CommandDialog`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Command } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Command>) {
  return <Command {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Keyboard driven palettes in a modal that search actions, pages and settings from one input
- Search lists of files, team members, favorites and recent pages that narrow as the user types
- Inline menus kept open in a card or panel, with grouped rows and keyboard shortcut hints

## When not to use

- A form field that keeps the option the user picks, such as a country or an assignee: use [Combobox](./combobox.md)
- A complete product layout with sidebar navigation, where search is only one of its parts: use the App Shell blocks
- A top bar above your page with brand, menus and alerts, where search sits beside them: use the Navbar blocks

## Agent notes

- No example gives a `CommandItem` a select handler, so pressing Enter or clicking a row runs nothing until you add one
- `CommandList` stops at 18rem tall in every style and scrolls the rows past that height inside itself

## Third-party libraries

- cmdk v1: [API reference](https://github.com/dip/cmdk#parts-and-styling), [docs](https://github.com/dip/cmdk)

## Examples

- [Basic](./command/c-command-1.md): Basic command. Best for an always open list inside a narrow Card, with a disabled Calculator row and shortcut hints on the Settings rows only.
- [Shortcuts](./command/c-command-2.md): Command with shortcuts. Best for the smallest modal palette, a single Settings group of 3 rows with a shortcut hint on each.
- [Groups](./command/c-command-3.md): Command with groups. Best for a modal with 2 groups, Suggestions as plain rows and Settings rows with shortcut hints, split by a separator.
- [Many Groups](./command/c-command-4.md): Command with many groups. Best for a dense palette of 5 groups and 23 rows, from navigation and file actions to view, account and tools.
- [File Search](./command/c-command-5.md): File search command palette. Best for a file finder whose rows show name, muted path and a type Badge, opened from a search style trigger with a Kbd hint.
- [User Search](./command/c-command-6.md): User search command with avatars. Best for a people search with avatar, name over email, and a role Badge tinted per Admin, Editor or Viewer.
- [Action Palette](./command/c-command-7.md): Action palette with keyboard shortcuts. Best for task verbs grouped as Create, Navigate and System, from New Project and Invite Member to dark mode and sign out.
- [Recent & Favorites](./command/c-command-8.md): Command with recent and favorites sections. Best for a jump list of starred favorites, recent pages stamped 2m to 2h ago and help links, opened as Search Everything.
