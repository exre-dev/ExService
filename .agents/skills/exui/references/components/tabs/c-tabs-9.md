<!-- Generated from resources/components/tabs/c-tabs-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Segmented Control

> Segmented control tabs

- Type: example, free and open source (MIT)
- Component: [Tabs](../tabs.md)
- Page: [local reference](./c-tabs-9.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/tabs.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/tabs.md
- Uses: Card, Tabs

## Best for

A controlled Daily to Yearly switch kept in React state, each panel showing one large visitor total

## Agent notes

- The 4 visitor totals are fixed text in each `TabsContent`; read `period` to load the figure for the chosen range

## When not to use

- A period switch that filters data shown elsewhere, with no panel of its own: use [Toggle Group](../toggle-group.md)
- Panels that hold forms with their own save buttons: use [Basic](./c-tabs-1.md)

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
