<!-- Generated from resources/components/sidebar.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sidebar

> Open-source shadcn sidebar components for app shells, collapsible side navigation, and dashboard layouts.

- Type: shadcn/ui component, free
- Page: [local reference](./sidebar.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/sidebar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sidebar.md
- Examples: 5

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Sidebar`, `SidebarInset`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Sidebar } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Sidebar>) {
  return <Sidebar {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- The persistent navigation column of an app, which can narrow to an icon rail or slide off screen
- Documentation trees with collapsible sections and sub-pages, or project lists narrowed by a search field
- A right side inspector that shows the details of the record open beside it

## When not to use

- A complete multi page product layout with header, nav and content area already built: use the App Shell blocks
- Account settings pages that switch between personal details, billing and team panels: use the Profile blocks
- A shop catalog facet panel with price range, brand counts, color swatches and sizes: use the Filter Sidebar blocks

## Agent notes

- Menu links are anchors passed through `render` on the base twin and `asChild` on radix; point each # `href` at your route
- `SidebarProvider` listens for Cmd or Ctrl+B on the whole window, so pressing it in a text editor on the page toggles its `open` state too

## Examples

- [Workspace Switcher](./sidebar/c-sidebar-1.md): Application shell with a workspace switcher. Best for an inset variant layout whose header dropdown switches the workspace named in the page breadcrumb, beside stat cards and a deploy list.
- [Icon Rail](./sidebar/c-sidebar-2.md): Icon rail that collapses. Best for narrowing the nav to icons while the brand tile and account avatar stay in view, toggled by an edge strip or a header button.
- [Docs Navigation](./sidebar/c-sidebar-3.md): Documentation nav with sub-menus. Best for an always open panel with no toggle where typing opens every section that still matches, with the current page trail open on load.
- [Inspector Panel](./sidebar/c-sidebar-4.md): Right-hand inspector panel. Best for issue details beside the record: assignees with owner and remove actions, linked work, an activity feed and an Open in board button.
- [Filter & Loading](./sidebar/c-sidebar-5.md): Filtering, loading and empty states. Best for a project list whose pinned rows survive any query, with a refresh spinner, a clear button in the search box and a plan usage footer.
