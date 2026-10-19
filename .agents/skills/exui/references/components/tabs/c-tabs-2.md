<!-- Generated from resources/components/tabs/c-tabs-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Line Variant

> Tabs with line variant.

- Type: example, free and open source (MIT)
- Component: [Tabs](../tabs.md)
- Page: [local reference](./c-tabs-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/tabs.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/tabs.md
- Uses: Button, Card, Input, Label, Tabs

## Best for

An underlined row stretched full width over 3 cards for account, password and preference forms

## Agent notes

- Theme and Language are free text `Input` fields seeded with Light and English; swap in a select for real options
- Save changes, Update password and Save settings are `Button` elements with no handler or form around them

## When not to use

- The underlined style stacked as a column on the left of the panel: use [Vertical Line](./c-tabs-4.md)

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
