<!-- Generated from resources/components/breadcrumb/c-breadcrumb-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Static Ellipsis

> Breadcrumb with ellipsis for long paths

- Type: example, free and open source (MIT)
- Component: [Breadcrumb](../breadcrumb.md)
- Page: [local reference](./c-breadcrumb-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/breadcrumb.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/breadcrumb.md
- Uses: Breadcrumb

## Best for

A static ellipsis standing in for skipped middle levels, with no menu or link behind it

## Agent notes

- `BreadcrumbEllipsis` is `aria-hidden`, so screen readers skip the gap and never learn that levels are hidden

## When not to use

- Skipped levels that must stay reachable by mouse and keyboard: use [Dropdown Menu](./c-breadcrumb-2.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Breadcrumb

### When to use

- Location trails on docs, store and admin pages that link back up to each parent level
- Workspace, team and file paths whose levels carry avatars, icons, count badges or button styling
- Deep hierarchies whose middle levels collapse into an ellipsis or a dropdown menu

### When not to use

- A whole top header that pairs the trail with tabs, search, switchers and account menus: use the Navbar blocks
- A full product layout of side navigation, header and content around the trail: use the App Shell blocks
- A divider line between page sections or groups of toolbar controls: use [Separator](../separator.md)

### Agent notes

- `BreadcrumbLink` takes a router link through `render` on the base twin and `asChild` on the radix twin
- Every level is hard coded and each `href` is a hash placeholder; build the `BreadcrumbItem` list from your route tree
