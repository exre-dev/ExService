<!-- Generated from resources/components/navigation-menu/c-navigation-menu-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Basic

> Basic navigation menu.

- Type: example, free and open source (MIT)
- Component: [Navigation Menu](../navigation-menu.md)
- Page: [local reference](./c-navigation-menu-1.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/navigation-menu.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/navigation-menu.md
- Uses: Navigation Menu

## Best for

A Getting started panel of 2 described links next to a plain Documentation link styled as a trigger

## Agent notes

- Documentation gets its trigger look from `navigationMenuTriggerStyle`; pass it as the `className` of any top level `NavigationMenuLink`

## When not to use

- One line links each led by a status glyph and no summary text: use [With Icons](./c-navigation-menu-3.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Navigation Menu

### When to use

- Site headers whose top level items open panels of links, such as docs, components or industry pages
- Mega menu panels that lay out links with summaries in columns, with glyphs and a call to action button
- Header rows that mix panel triggers with plain top level links styled to match them

### When not to use

- Actions on the current page, such as edit, share or sign out, opened from one button: use [Dropdown Menu](../dropdown-menu.md)
- Sections of a signed in app listed down the screen edge and kept in view: use [Sidebar](../sidebar.md)
- A complete header with logo, link panels and a Get Started button already placed: use the Navbar blocks

### Agent notes

- `NavigationMenuLink` takes its anchor through `render` on the base twin and `asChild` on the radix twin; neither twin reads the other one's prop
- Every `href` is a hash placeholder; point each `NavigationMenuLink` at a real route, through your router link where you have one
- The radix `NavigationMenu` opens panels in a shared `NavigationMenuViewport` unless `viewport` is false; base has no `viewport` prop and uses `align`
