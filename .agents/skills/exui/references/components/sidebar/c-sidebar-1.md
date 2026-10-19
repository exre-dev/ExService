<!-- Generated from resources/components/sidebar/c-sidebar-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Workspace Switcher

> Application shell with a workspace switcher

- Type: example, free and open source (MIT)
- Component: [Sidebar](../sidebar.md)
- Page: [local reference](./c-sidebar-1.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/sidebar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sidebar.md
- Uses: Avatar, Breadcrumb, Button, Card, Dropdown Menu, Sidebar

## Best for

An inset variant layout whose header dropdown switches the workspace named in the page breadcrumb, beside stat cards and a deploy list

## Agent notes

- Replace `WORKSPACES`, `NAV`, `PROJECTS`, `DEPLOYMENTS` and `STATS` with your data; the active Deployments row is hard coded through `isActive`
- New workspace, the New project `SidebarGroupAction` and every project row and account `DropdownMenuItem` have no handler yet

## When not to use

- A nav that narrows to a column of icons with hover names when collapsed: use [Icon Rail](./c-sidebar-2.md)

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
