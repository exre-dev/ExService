<!-- Generated from resources/components/item.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Item

> Open-source shadcn item row components for list rows, settings items, and action rows.

- Type: shadcn/ui component, free
- Page: [local reference](./item.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/item.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/item.md
- Examples: 12

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Item`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Item } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Item>) {
  return <Item {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Rows of people, files, services or events, each an avatar or icon beside text, a badge or a button
- Clickable menus of account pages, mailbox folders or commands, ending in a chevron, count or key
- A compact record card with a header and footer, such as a project with status, team and progress

## When not to use

- A finished dashboard panel of KPIs, transactions or integrations with data on every row: use the List blocks
- A whole page of account options in labeled rows, each with its own switch, select or input: use the Settings blocks
- Rows the user reorders by dragging them up or down the page: use [Sortable](./sortable.md)

## Agent notes

- Make a row a link through `render` on the base twin or `asChild` on radix; every style draws the hover fill only when the row is an anchor
- `ItemGroup` sets `role` list but `Item` sets no listitem role, so wrap each row in an element that carries it
- `ItemTitle` clamps to 1 line and `ItemDescription` to 2, so longer text is cut off until a `className` lifts the clamp

## Examples

- [Variants](./item/c-item-1.md): Basic item with title and description. Best for the 3 row variants stacked for comparison, default, outline and muted, as text only rows with no media or actions.
- [Icon & Actions](./item/c-item-2.md): Items with icon media and action buttons. Best for notification channel rows at the default size, each a leading icon and 1 button, outline Configure or filled Enable.
- [User Follow](./item/c-item-3.md): User item with avatar, info, and follow button. Best for compact people rows with a photo and job title that show the follow button in both states, Follow and Following.
- [Navigation Links](./item/c-item-4.md): Clickable navigation items with icons and chevron. Best for account menu links, Profile, Security and Billing, where each whole row is an anchor and separators divide them.
- [Status Badges](./item/c-item-5.md): Item group with status badges. Best for team presence rows in a spaced group, each with a photo, a role and an Online, Away or Offline badge.
- [File Rows](./item/c-item-6.md): File items with icon media, size, and actions. Best for file rows with size and last update, a Final, Draft or Review badge and an Open button on each.
- [Keyboard Shortcuts](./item/c-item-7.md): Items with keyboard shortcuts. Best for a narrow command menu of 5 link rows, each an icon and label with its key combination in a Kbd on the right.
- [Small Count Badges](./item/c-item-8.md): Small-size items with badges. Best for mailbox folder links from Inbox to Trash in a narrow column, with a rounded count badge on Inbox and Drafts only.
- [Team Roles](./item/c-item-9.md): Team members with roles and multiple actions. Best for member rows with email under the name, a role badge and a dots menu of Change Role, View Profile and Remove.
- [Header & Footer](./item/c-item-10.md): Item with header and footer sections. Best for a narrow project card: kind label and In Progress badge on top, avatar stack and a 65% progress bar below.
- [Integrations](./item/c-item-11.md): Integration items with connect actions. Best for data source rows where linked services show a Connected badge and the rest offer a Connect button.
- [Activity Feed](./item/c-item-12.md): Activity feed items with avatars and actions. Best for a team log of deploys, merges and issues: a small photo, the person, a colored verb badge, the target and a relative time.
