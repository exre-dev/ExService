<!-- Generated from resources/components/menubar.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Menubar

> Open-source shadcn menubar components for desktop navigation, editor menus, and app commands.

- Type: shadcn/ui component, free
- Page: [local reference](./menubar.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/menubar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/menubar.md
- Examples: 5

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Menubar`, `MenubarContent`, `MenubarSubContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Menubar } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Menubar>) {
  return <Menubar {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Desktop style command bars of File, Edit and Account lists, with key hints and side flyouts
- Formatting and insert lists for a document editor, such as Bold, Italic, Media and Link
- View toggles and a single choice setting kept in the top bar, such as bookmarks or the theme

## When not to use

- A single list of actions or account options opened from one button: use [Dropdown Menu](./dropdown-menu.md)
- Commands opened by right clicking a file, row or canvas, with no visible trigger: use [Context Menu](./context-menu.md)
- A signed in product header holding the logo, search, alerts and the user avatar: use the Navbar blocks

## Agent notes

- Give each `MenubarItem` its command through onClick, which both twins fire; Base UI never fires the Radix onSelect event
- `MenubarShortcut` is a plain span that prints the chord only; register the keys in your own keydown listener
- `MenubarLabel` throws on the base twin unless it sits inside a `MenubarGroup` or `MenubarRadioGroup`

## Examples

- [Basic](./menubar/c-menubar-1.md): Basic menubar.. Best for file and Edit lists of plain text rows with key hints, dividers and a disabled New Incognito Window.
- [Submenus](./menubar/c-menubar-2.md): Menubar with dropdown submenus.. Best for a side flyout in each list, Share with 3 channels under File and Find with 3 search commands under Edit.
- [Checkbox & Radio](./menubar/c-menubar-3.md): Menubar with checkbox & radio items.. Best for a View list of 2 browser toggles beside a Theme list whose Light, Dark or System pick is held in state.
- [Icons](./menubar/c-menubar-4.md): Menubar with icons.. Best for a leading icon on every row, with Profile and a destructive Sign out grouped under Account.
- [Formatting & Media](./menubar/c-menubar-5.md): Menubar for formatting and media.. Best for bold and Italic rows, Strikethrough and Code toggles and an Insert list with a Media flyout and Link.
