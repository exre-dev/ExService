<!-- Generated from resources/components/frame/c-frame-11.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Default Spacing

> Frame with default spacing

- Type: example, free and open source (MIT)
- Component: [Frame](../frame.md)
- Page: [local reference](./c-frame-11.md)
- Uses: Frame

## Best for

The padding a Frame gets with no preset passed, 16px panel sides, around account security and a last login footer

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Frame

### When to use

- Dashboard, settings and status sections with a title bar, card panels and a footer line
- Lists of services, records or log entries joined into one stacked column of bordered panels
- A titled shell around other parts, such as a collapsible run step that opens to its instructions

### When not to use

- Several sections that each expand and collapse, one or many open at a time: use [Accordion](../accordion.md)
- Ready made KPI tiles, profile summaries or promo offers laid out across a page: use the Card blocks
- A storefront page of items with photos, prices, swatches and wishlist toggles: use the Product Grid blocks

### Agent notes

- `dense` strips the padding and gap of `Frame` itself and pulls each `FramePanel` onto the outer border; the panels keep their own padding
- `stacked` joins only `FramePanel` elements that are adjacent direct children of `Frame`; a wrapper around one leaves both fully rounded and bordered
- `FramePanel` grows into any spare height of `Frame`; pass `fit` when a panel should keep the height of its own content
