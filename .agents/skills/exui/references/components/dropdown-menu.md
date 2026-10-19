<!-- Generated from resources/components/dropdown-menu.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Dropdown Menu

> Open-source shadcn dropdown menu components for action menus, profile menus, and toolbar menus.

- Type: shadcn/ui component, free
- Page: [local reference](./dropdown-menu.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/dropdown-menu.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/dropdown-menu.md
- Examples: 18

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `DropdownMenuContent`, `DropdownMenuSubContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { DropdownMenuContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof DropdownMenuContent>) {
  return <DropdownMenuContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Action and overflow menus on a button or a dots icon, such as edit, duplicate, share, export and delete
- Account, workspace and create menus showing the signed in user, workspace switching and sign out
- Toggles, exclusive choices and short lists, such as panel layout, theme, AI models or recent alerts

## When not to use

- Actions opened by right clicking or long pressing a surface, with no button to press: use [Context Menu](./context-menu.md)
- A whole top bar with search, alerts, switchers and the user dropdown already placed: use the Navbar blocks
- The account settings page an avatar link opens, with identity, team and billing forms: use the Profile blocks

## Agent notes

- `DropdownMenuLabel` throws on the base twin unless it sits inside a `DropdownMenuGroup` or `DropdownMenuRadioGroup`
- On the base twin run an item's action from `onClick`; `onSelect` is a Radix item event that Base UI never fires
- Pass the trigger element through `render` on the base twin and as the `asChild` child on radix; the prop meant for the other twin does nothing

## Examples

- [Basic](./dropdown-menu/c-dropdown-menu-1.md): Basic dropdown menu. Best for plain text rows in 2 groups, the first headed My Account, with a disabled API row.
- [Opening Positions](./dropdown-menu/c-dropdown-menu-2.md): Dropdown menus opening positions. Best for one trigger per placement side, each opening the same 3 rows so the sides can be compared.
- [Icons](./dropdown-menu/c-dropdown-menu-3.md): Dropdown menu with icons. Best for a leading icon on each row and a destructive Log out set apart below a separator.
- [Keyboard Shortcuts](./dropdown-menu/c-dropdown-menu-4.md): Dropdown menu with keyboard shortcuts. Best for key chord hints right aligned on every row of a short account list with no icons.
- [Nested Submenus](./dropdown-menu/c-dropdown-menu-5.md): Dropdown menu with nested submenus. Best for a single Invite users row between Team and New Team, opening a side flyout of Email, Message and a More row.
- [Checkboxes](./dropdown-menu/c-dropdown-menu-6.md): Dropdown menu with checkboxes. Best for layout toggles for 3 panels, each bound to its own boolean, with the Activity Bar one disabled.
- [Radio Groups](./dropdown-menu/c-dropdown-menu-7.md): Dropdown menu with radio groups. Best for an exclusive pick of panel position among 3 arrow icon options, with Right disabled.
- [All Item Types](./dropdown-menu/c-dropdown-menu-8.md): Advance dropdown menu. Best for every item kind together: an Open Recent flyout, a theme radio set in a flyout, a checkbox and a delete.
- [User Profile](./dropdown-menu/c-dropdown-menu-9.md): User profile dropdown menu. Best for a named account button opening an avatar and email header over profile, team, help and log out rows.
- [Workspace Switcher](./dropdown-menu/c-dropdown-menu-10.md): Workspace switcher dropdown menu. Best for switching among 3 workspaces shown by logo or avatar, name and plan, with a check on the active one and create or manage rows.
- [Notification Feed](./dropdown-menu/c-dropdown-menu-11.md): Notifications dropdown menu. Best for a bell with a count badge, 3 avatar activity rows with times and unread dots, and a Mark all as read button.
- [Record Actions](./dropdown-menu/c-dropdown-menu-12.md): Actions dropdown menu. Best for record actions on a vertical dots button: edit, duplicate, a move to flyout, share, copy link and delete.
- [Share & Export](./dropdown-menu/c-dropdown-menu-13.md): Share and export dropdown menu. Best for a labelled Share button whose rows split into share channels and PDF, CSV or PNG export, ending in Print.
- [Theme & Status](./dropdown-menu/c-dropdown-menu-14.md): User profile dropdown menu with theme toggle and status selector. Best for an account popover with an icon Tabs theme switch, count badges and a presence status flyout with colored dots.
- [User & Create](./dropdown-menu/c-dropdown-menu-15.md): User and create menu. Best for a New button for customer, order and invoice records beside a bare avatar trigger for profile, billing and sign out.
- [Quick Actions](./dropdown-menu/c-dropdown-menu-16.md): Quick action menu. Best for a borderless horizontal dots button named More options, with Settings, Share and a destructive Remove.
- [Notification Items](./dropdown-menu/c-dropdown-menu-17.md): Notifications dropdown with items. Best for a ghost bell button opening 3 one line text alerts, the first with a trailing check mark.
- [AI Model Selector](./dropdown-menu/c-dropdown-menu-18.md): AI model selector with provider icons. Best for a Select model button listing 3 AI models by provider logo, with a dark variant for the logo that needs one.
