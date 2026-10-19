<!-- Generated from resources/components/sidebar/c-sidebar-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Icon Rail

> Icon rail that collapses

- Type: example, free and open source (MIT)
- Component: [Sidebar](../sidebar.md)
- Page: [local reference](./c-sidebar-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/sidebar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sidebar.md
- Uses: Avatar, Button, Sidebar

## Best for

Narrowing the nav to icons while the brand tile and account avatar stay in view, toggled by an edge strip or a header button

## Agent notes

- On the radix twin a row `tooltip` throws without a `TooltipProvider` above it; keep the one the example mounts or hoist it to your app root
- Give each new row a `tooltip`, since at 3rem the label is clipped and the tooltip is the only name a pointer user sees
- The collapsed state resets on reload; read the `sidebar_state` cookie on the server and pass it as `defaultOpen`

## When not to use

- A nav with no icon state that holds a workspace switcher and project row menus: use [Workspace Switcher](./c-sidebar-1.md)

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
