<!-- Generated from resources/components/sidebar/c-sidebar-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Docs Navigation

> Documentation nav with sub-menus

- Type: example, free and open source (MIT)
- Component: [Sidebar](../sidebar.md)
- Page: [local reference](./c-sidebar-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/sidebar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sidebar.md
- Uses: Collapsible, Sidebar

## Best for

An always open panel with no toggle where typing opens every section that still matches, with the current page trail open on load

## Agent notes

- Replace `SECTIONS` with your page tree; sections and sub-trees start open around the child marked `isActive`, so set it from the current route
- With `collapsible` none the panel stays a 16rem column on phones and never becomes a `Sheet`; add your own mobile toggle

## When not to use

- Page hierarchies nested more than 2 levels deep: use [Tree](../tree.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Sidebar

### When to use

- The persistent navigation column of an app, which can narrow to an icon rail or slide off screen
- Documentation trees with collapsible sections and sub-pages, or project lists narrowed by a search field
- A right side inspector that shows the details of the record open beside it

### When not to use

- A complete multi page product layout with header, nav and content area already built: use the App Shell blocks
- Account settings pages that switch between personal details, billing and team panels: use the Profile blocks
- A shop catalog facet panel with price range, brand counts, color swatches and sizes: use the Filter Sidebar blocks

### Agent notes

- Menu links are anchors passed through `render` on the base twin and `asChild` on radix; point each # `href` at your route
- `SidebarProvider` listens for Cmd or Ctrl+B on the whole window, so pressing it in a text editor on the page toggles its `open` state too
