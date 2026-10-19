<!-- Generated from resources/components/context-menu.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Context Menu

> Open-source shadcn context menu components for right-click menus, file actions, and table row actions.

- Type: shadcn/ui component, free
- Page: [local reference](./context-menu.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/context-menu.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/context-menu.md
- Examples: 10

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `ContextMenuContent`, `ContextMenuSubContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { ContextMenuContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof ContextMenuContent>) {
  return <ContextMenuContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Right click actions on a file, row or canvas area, such as copy, paste, share and delete
- Toggles and single choice settings changed from a right click, such as visible bars or the theme
- Long command lists split into headed sections, key hints or a nested flyout of extra tools

## When not to use

- Actions that must stay discoverable, opened from a visible button like a row's more icon: use [Dropdown Menu](./dropdown-menu.md)
- A persistent bar of File, Edit and View lists across the top of an app window: use [Menubar](./menubar.md)
- Site links in a header bar whose panels open on hover or click: use [Navigation Menu](./navigation-menu.md)

## Agent notes

- Each dashed `ContextMenuTrigger` stands in for your target; wrap the row or card in it, or pass it through `render` on base and `asChild` on radix
- `ContextMenuLabel` throws on the base twin outside a `ContextMenuGroup` or `ContextMenuRadioGroup`; the radix one renders anywhere

## Examples

- [Basic](./context-menu/c-context-menu-1.md): Basic context menu.. Best for the bare minimum of 3 plain text rows in a single group, with the middle row disabled.
- [Icons](./context-menu/c-context-menu-2.md): Context menu with icons for common actions.. Best for clipboard commands, Copy, Cut and Paste, each with a leading icon, and a destructive Delete below a divider.
- [Shortcuts](./context-menu/c-context-menu-3.md): Context menu with keyboard shortcuts.. Best for navigation and save commands with a trailing key hint on each row and Forward disabled.
- [Nested Submenus](./context-menu/c-context-menu-4.md): Context menu with nested submenus.. Best for a More Tools flyout of 3 divided groups, Delete last, below 2 clipboard rows with key hints.
- [Labels & Separators](./context-menu/c-context-menu-5.md): Context menu labels and separators.. Best for a list of 4 groups, File and Edit headed by labels, with a key hint on every row down to a destructive Delete.
- [Checkbox Items](./context-menu/c-context-menu-6.md): Context menu with checkbox items.. Best for a list of 3 browser view toggles that show a check when on, 2 of them on at load.
- [Radio Items](./context-menu/c-context-menu-7.md): Context menu with radio items.. Best for a person picker and a Light, Dark or System theme switch, each a headed radio set held in state.
- [Destructive Actions](./context-menu/c-context-menu-8.md): Context menu with destructive actions.. Best for edit and Share over a divider, then Archive and a destructive Delete, every row led by an icon.
- [Alignment Sides](./context-menu/c-context-menu-9.md): Context menu with different alignment sides.. Best for a row of 6 triggers that each open on a different side, the logical inline start and end included.
- [Inside Dialog](./context-menu/c-context-menu-10.md): Context menu used inside a dialog component.. Best for a right click area inside a modal window, with icon rows, a More Options flyout and a destructive Delete.
