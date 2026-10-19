<!-- Generated from resources/components/navigation-menu.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Navigation Menu

> Open-source shadcn navigation menu components for site navigation, mega menus, and product navigation.

- Type: shadcn/ui component, free
- Page: [local reference](./navigation-menu.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/navigation-menu.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/navigation-menu.md
- Examples: 4

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### NavigationMenu viewport width

The default `NavigationMenuViewport` follows its measured content width on desktop and uses full width below the `md` breakpoint. Menu options remain visible and clickable when application Tailwind utilities load after ExUI CSS. Use the default viewport without a manual width override for ordinary menus.

Keep the default responsive width of `NavigationMenuContent` as well. An unconditional `w-full` on the content or viewport can constrain desktop measurement and clip the menu links.
<!-- exui-capabilities:end:skill -->

## When to use

- Site headers whose top level items open panels of links, such as docs, components or industry pages
- Mega menu panels that lay out links with summaries in columns, with glyphs and a call to action button
- Header rows that mix panel triggers with plain top level links styled to match them

## When not to use

- Actions on the current page, such as edit, share or sign out, opened from one button: use [Dropdown Menu](./dropdown-menu.md)
- Sections of a signed in app listed down the screen edge and kept in view: use [Sidebar](./sidebar.md)
- A complete header with logo, link panels and a Get Started button already placed: use the Navbar blocks

## Agent notes

- `NavigationMenuLink` takes its anchor through `render` on the base twin and `asChild` on the radix twin; neither twin reads the other one's prop
- Every `href` is a hash placeholder; point each `NavigationMenuLink` at a real route, through your router link where you have one
- The radix `NavigationMenu` opens panels in a shared `NavigationMenuViewport` unless `viewport` is false; base has no `viewport` prop and uses `align`

## Examples

- [Basic](./navigation-menu/c-navigation-menu-1.md): Basic navigation menu.. Best for a Getting started panel of 2 described links next to a plain Documentation link styled as a trigger.
- [Grid Layout](./navigation-menu/c-navigation-menu-2.md): Navigation menu with grid layout.. Best for a Components trigger whose 4 titled summaries sit in 1 column and split into 2 columns from md up.
- [With Icons](./navigation-menu/c-navigation-menu-3.md): Navigation menu with icons.. Best for a narrow Status panel of 2 one line links, Backlog and Done, each led by a status glyph.
- [Learn More Button](./navigation-menu/c-navigation-menu-4.md): Navigation menu with grid layout and learn more button.. Best for an Industries panel of 8 segments in a fixed 2 column grid, each with a glyph and summary, above a full width Learn more button.
