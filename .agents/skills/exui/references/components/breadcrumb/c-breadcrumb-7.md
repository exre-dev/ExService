<!-- Generated from resources/components/breadcrumb/c-breadcrumb-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Avatars

> Breadcrumb items with avatars

- Type: example, free and open source (MIT)
- Component: [Breadcrumb](../breadcrumb.md)
- Page: [local reference](./c-breadcrumb-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/breadcrumb.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/breadcrumb.md
- Uses: Avatar, Breadcrumb

## Best for

Team and user levels led by small avatar images with initials fallbacks, ending on a plain current page

## Agent notes

- Each `AvatarImage` loads a github.com picture; point every `src` at your own team and user images

## When not to use

- Levels that also need a second line, such as an email or a file name: use [Project & Document](./c-breadcrumb-15.md)

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
