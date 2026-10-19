<!-- Generated from resources/components/sidebar/c-sidebar-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Filter & Loading

> Filtering, loading and empty states

- Type: example, free and open source (MIT)
- Component: [Sidebar](../sidebar.md)
- Page: [local reference](./c-sidebar-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/sidebar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sidebar.md
- Uses: Button, Card, Input Group, Sidebar

## Best for

A project list whose pinned rows survive any query, with a refresh spinner, a clear button in the search box and a plan usage footer

## Agent notes

- `startRefresh` only shows skeletons for 900 ms on a `setTimeout`; replace it with your fetch and drive `loading` from that request
- Keep `loading` false on the first render: `SidebarMenuSkeleton` picks a random width, so server and client HTML would differ
- Replace `PINNED`, `PROJECTS` and `RUNS`; each `open` count and the 8 of 10 projects line are fixed, and Upgrade plan has no handler

## When not to use

- A search over nested pages that also expands the sections holding each match: use [Docs Navigation](./c-sidebar-3.md)

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
