<!-- Generated from resources/components/breadcrumb.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Breadcrumb

> Open-source shadcn breadcrumb components for navigation trails, docs hierarchy, and app wayfinding.

- Type: shadcn/ui component, free
- Page: [local reference](./breadcrumb.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/breadcrumb.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/breadcrumb.md
- Examples: 15

## When to use

- Location trails on docs, store and admin pages that link back up to each parent level
- Workspace, team and file paths whose levels carry avatars, icons, count badges or button styling
- Deep hierarchies whose middle levels collapse into an ellipsis or a dropdown menu

## When not to use

- A whole top header that pairs the trail with tabs, search, switchers and account menus: use the Navbar blocks
- A full product layout of side navigation, header and content around the trail: use the App Shell blocks
- A divider line between page sections or groups of toolbar controls: use [Separator](./separator.md)

## Agent notes

- `BreadcrumbLink` takes a router link through `render` on the base twin and `asChild` on the radix twin
- Every level is hard coded and each `href` is a hash placeholder; build the `BreadcrumbItem` list from your route tree

## Examples

- [Basic](./breadcrumb/c-breadcrumb-1.md): Basic breadcrumb. Best for plain text levels split by the default chevron, with no icons, menus or custom styling.
- [Dropdown Menu](./breadcrumb/c-breadcrumb-2.md): Breadcrumb with dropdown menu. Best for middle levels folded into an ellipsis button that opens a dropdown of the hidden pages.
- [Router Link](./breadcrumb/c-breadcrumb-3.md): Breadcrumb with Next.js link. Best for crumbs that render a caller supplied anchor element, the place to swap in your router's link.
- [Slash Separator](./breadcrumb/c-breadcrumb-4.md): Breadcrumb with a custom slash separator. Best for slash characters between levels in place of the default chevron, on an otherwise plain trail.
- [Item Icons](./breadcrumb/c-breadcrumb-5.md): Breadcrumb with icons for each item. Best for a leading icon on every level including the current page, laid out beside each label.
- [Static Ellipsis](./breadcrumb/c-breadcrumb-6.md): Breadcrumb with ellipsis for long paths. Best for a static ellipsis standing in for skipped middle levels, with no menu or link behind it.
- [Avatars](./breadcrumb/c-breadcrumb-7.md): Breadcrumb items with avatars. Best for team and user levels led by small avatar images with initials fallbacks, ending on a plain current page.
- [Double Chevron](./breadcrumb/c-breadcrumb-8.md): Breadcrumb with double chevron separators. Best for double chevron icons passed into each separator in place of the single default one.
- [In Card](./breadcrumb/c-breadcrumb-9.md): Breadcrumb inside card. Best for a trail on a padded Card surface, opening with a home icon and ending on a semibold current page.
- [Pill In Frame](./breadcrumb/c-breadcrumb-10.md): Pill-style breadcrumb inside frame. Best for a trail inside a upstream Frame panel rather than a Card, with a home icon, tight padding and a semibold last level.
- [Count Badge](./breadcrumb/c-breadcrumb-11.md): Breadcrumb items containing badge with count. Best for a rounded count badge inside a parent level, here a total of 3 beside the Inbox folder of a mail path.
- [Home Icon Button](./breadcrumb/c-breadcrumb-12.md): Breadcrumb starting with home icon item. Best for a square outline icon button as the home level, with its label kept for screen readers only.
- [Bar Separator](./breadcrumb/c-breadcrumb-13.md): Breadcrumb with a custom separator. Best for a short faded bar between levels, drawn by a small local component rather than a character or icon.
- [Button Style](./breadcrumb/c-breadcrumb-14.md): Button-style breadcrumb. Best for every level as a small button pairing an icon with its label, ghost for parent pages and filled secondary for the current one.
- [Project & Document](./breadcrumb/c-breadcrumb-15.md): Breadcrumb with project, user and document info. Best for two line levels pairing an avatar or tinted file tile with a name above a muted email or file name.
