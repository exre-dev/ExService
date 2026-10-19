<!-- Generated from resources/components/sidebar/c-sidebar-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Inspector Panel

> Right-hand inspector panel

- Type: example, free and open source (MIT)
- Component: [Sidebar](../sidebar.md)
- Page: [local reference](./c-sidebar-4.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/sidebar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sidebar.md
- Uses: Avatar, Badge, Button, Dropdown Menu, Sidebar

## Best for

Issue details beside the record: assignees with owner and remove actions, linked work, an activity feed and an Open in board button

## Agent notes

- Render `SidebarInset` before `Sidebar`: `side` right only pins the panel, and the child order decides which edge reserves its column
- Replace `ASSIGNEES`, `LINKED` and `ACTIVITY`; the In review `Badge`, the ENG-2481 key and the issue text are fixed in the markup
- Make owner, Notify, Remove, the add assignee `SidebarGroupAction` and Open in board run nothing yet; wire each to your API

## When not to use

- A details panel laid over the page and closed by a click outside: use [Sheet](../sheet.md)
- Page navigation for the whole app along the left edge: use [Workspace Switcher](./c-sidebar-1.md)

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
