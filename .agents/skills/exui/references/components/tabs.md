<!-- Generated from resources/components/tabs.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Tabs

> Open-source shadcn tabs components for segmented content, settings views, and dashboard sections.

- Type: shadcn/ui component, free
- Page: [local reference](./tabs.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/tabs.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/tabs.md
- Examples: 9

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### ExUI tab appearance

`TabsList` supports `variant="default"`, `"primary"` and `"line"`. The filled variants use pill-shaped horizontal tracks and triggers. Vertical triggers stay pill-shaped; the track's corners account for one trigger's height and the surrounding padding, so the first and last items fit inside its curve.

Only the active trigger has a small, theme-aware shadow. The `primary` variant also uses the primary fill and foreground. The `line` variant retains its transparent background and selection indicator without the active shadow. Keyboard focus remains visible on the active item.

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `TabsList`, `TabsTrigger`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { TabsList } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof TabsList>) {
  return <TabsList {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Account, password and settings forms split into panels so only one shows at a time
- Side navigation inside a page, with sections stacked in a column beside the open panel
- Views of one surface, such as dashboard sections, mail folders or visitor stats by period

## When not to use

- A finished account settings page with workspace, team and billing sections built in: use the Profile blocks
- A metric card whose period switch redraws a plotted trend: use the Line Chart blocks
- A project header with a breadcrumb on top and a row of sections with avatars below: use the Navbar blocks

## Agent notes

- Only the active `TabsContent` renders in either twin, so other panels ship no server HTML and lose typed values on a switch
- Arrow keys only move focus across `TabsTrigger` items on the base twin, where Enter or Space selects; radix selects on focus

## Examples

- [Basic](./tabs/c-tabs-1.md): Basic tabs.. Best for the smallest setup: 2 triggers on a muted track switching between an account card and a password card.
- [Line Variant](./tabs/c-tabs-2.md): Tabs with line variant.. Best for an underlined row stretched full width over 3 cards for account, password and preference forms.
- [Vertical](./tabs/c-tabs-3.md): Tabs with vertical orientation.. Best for a muted column of 3 triggers on the left, with the matching form card opening to its right.
- [Vertical Line](./tabs/c-tabs-4.md): Tabs with vertical orientation and line variant.. Best for a transparent left column where a thin bar on its right edge marks the active section, beside wider cards.
- [Icons](./tabs/c-tabs-5.md): Tabs with icons.. Best for user, lock and gear icons ahead of each label on a muted track sized to its content, over 3 form cards.
- [Full Width Icons](./tabs/c-tabs-6.md): Tabs with icons. Best for a full width muted track of Overview, Analytics and Settings with icons, over 1 line placeholder cards.
- [Badge Counts](./tabs/c-tabs-7.md): Tabs with badge counts. Best for mail folders on an underlined row, with tinted count badges on Inbox, Drafts and Spam and none on Sent.
- [Side List Icons](./tabs/c-tabs-8.md): Tabs with icons and line variant. Best for a side list of Projects, Tasks, Team and Reports, each led by an icon, 2 ending in a right aligned count badge.
- [Segmented Control](./tabs/c-tabs-9.md): Segmented control tabs. Best for a controlled Daily to Yearly switch kept in React state, each panel showing one large visitor total.
