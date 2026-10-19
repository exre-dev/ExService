<!-- Generated from resources/components/frame.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Frame

> Open-source shadcn frame components for embedded previews, app shells, and device mockups.

- Type: upstream component, free
- Page: [local reference](./frame.md)
- Examples: 19

## When to use

- Dashboard, settings and status sections with a title bar, card panels and a footer line
- Lists of services, records or log entries joined into one stacked column of bordered panels
- A titled shell around other parts, such as a collapsible run step that opens to its instructions

## When not to use

- Several sections that each expand and collapse, one or many open at a time: use [Accordion](./accordion.md)
- Ready made KPI tiles, profile summaries or promo offers laid out across a page: use the Card blocks
- A storefront page of items with photos, prices, swatches and wishlist toggles: use the Product Grid blocks

## Agent notes

- `dense` strips the padding and gap of `Frame` itself and pulls each `FramePanel` onto the outer border; the panels keep their own padding
- `stacked` joins only `FramePanel` elements that are adjacent direct children of `Frame`; a wrapper around one leaves both fully rounded and bordered
- `FramePanel` grows into any spare height of `Frame`; pass `fit` when a panel should keep the height of its own content

## Examples

- [Basic](./frame/c-frame-1.md): Basic frame. Best for the full anatomy in placeholder copy, a title bar over one panel and a footer line, at full container width.
- [Separated Panels](./frame/c-frame-2.md): Frame with separated panels. Best for two panels under one title bar, each keeping its own rounded border with a small gap between them.
- [Stacked Panels](./frame/c-frame-3.md): Frame with stacked panels. Best for two placeholder panels under a title bar, fused into one column where a single border marks the seam.
- [Stacked Dense](./frame/c-frame-4.md): Frame with stacked panels and dense style. Best for two fused panels pulled flush onto the outer border, with no inset padding left around them.
- [Collapsible Panels](./frame/c-frame-5.md): Frame with collapsible panels. Best for one run step whose chevron title bar opens and closes its instructions panel, open on load.
- [Ghost Variant](./frame/c-frame-6.md): Frame with ghost variant. Best for a shell with no outer border, where only the muted fill and the bordered panel inside mark its edge.
- [Dense Layout](./frame/c-frame-7.md): Frame with dense layout. Best for one panel flush with the outer border under a title bar, shown as a warehouse stock check in a narrow column.
- [Stacked Rows](./frame/c-frame-8.md): Frame with stacked panels. Best for three service rows for auth, database and storage, fused into one column under a server logs title bar.
- [Extra Small Spacing](./frame/c-frame-9.md): Frame with extra small spacing. Best for the tightest padding preset, 8px panel sides and the thinnest title and footer bars, in a 320px wide column.
- [Small Spacing](./frame/c-frame-10.md): Frame with small spacing. Best for the small padding preset, 12px panel sides, on a database health widget with a status footer.
- [Default Spacing](./frame/c-frame-11.md): Frame with default spacing. Best for the padding a Frame gets with no preset passed, 16px panel sides, around account security and a last login footer.
- [Large Spacing](./frame/c-frame-12.md): Frame with large spacing. Best for the roomiest padding preset, 20px panel sides and the tallest bars, for a sparse analytics summary.
- [Small Radius](./frame/c-frame-13.md): Frame with small border radius. Best for corners pinned to the small radius token, the smallest override here, on a network diagnostics panel.
- [Medium Radius](./frame/c-frame-14.md): Frame with medium border radius. Best for corners pinned to the medium radius token, a step rounder than small, on a media storage panel.
- [Large Radius](./frame/c-frame-15.md): Frame with large border radius. Best for corners pinned to the large radius token on a team panel showing members online.
- [Default Radius](./frame/c-frame-16.md): Frame with default border radius. Best for no radius override, so the corner follows the active style and matches a shadcn Card beside it.
- [Extra Large Radius](./frame/c-frame-17.md): Frame with extra large border radius. Best for the roundest override in the set, the 2xl radius token, softening a creative portfolio gallery panel.
- [Content-Only Panels](./frame/c-frame-18.md): Frame with content-only panels. Best for two panels with no title bar or footer, kept apart by a small gap, as account and team summaries.
- [Stacked Content-Only](./frame/c-frame-19.md): Frame with stacked content-only panels. Best for two summary panels with no title bar or footer, joined by one shared border into a single block.
