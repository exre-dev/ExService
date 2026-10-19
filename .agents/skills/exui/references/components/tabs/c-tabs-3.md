<!-- Generated from resources/components/tabs/c-tabs-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Vertical

> Tabs with vertical orientation.

- Type: example, free and open source (MIT)
- Component: [Tabs](../tabs.md)
- Page: [local reference](./c-tabs-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/tabs.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/tabs.md
- Uses: Button, Card, Input, Label, Tabs

## Best for

A muted column of 3 triggers on the left, with the matching form card opening to its right

## Agent notes

- Each `Input` is uncontrolled, with Emma Wilson as the sample account, and none of the 3 footer buttons has a handler

## When not to use

- A side column with no muted track, where a thin bar marks the open section: use [Vertical Line](./c-tabs-4.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Tabs

### When to use

- Account, password and settings forms split into panels so only one shows at a time
- Side navigation inside a page, with sections stacked in a column beside the open panel
- Views of one surface, such as dashboard sections, mail folders or visitor stats by period

### When not to use

- A finished account settings page with workspace, team and billing sections built in: use the Profile blocks
- A metric card whose period switch redraws a plotted trend: use the Line Chart blocks
- A project header with a breadcrumb on top and a row of sections with avatars below: use the Navbar blocks

### Agent notes

- Only the active `TabsContent` renders in either twin, so other panels ship no server HTML and lose typed values on a switch
- Arrow keys only move focus across `TabsTrigger` items on the base twin, where Enter or Space selects; radix selects on focus
