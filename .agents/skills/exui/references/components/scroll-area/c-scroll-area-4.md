<!-- Generated from resources/components/scroll-area/c-scroll-area-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Fade Edges

> Scroll area with fade effect

- Type: example, free and open source (MIT)
- Component: [Scroll Area](../scroll-area.md)
- Page: [local reference](./c-scroll-area-4.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/scroll-area.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/scroll-area.md
- Uses: Scroll Area

## Best for

Edges that fade only while content is hidden past them, over a photo column with a tinted round thumb

## Agent notes

- The masks read overflow CSS variables Base UI sets on the viewport; the radix `ScrollArea` sets none, so compute them or drop the masks there

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Scroll Area

### When to use

- Fixed height lists and photo columns that scroll inside their own box with a custom scrollbar
- Sideways strips of cards or photos kept to the width of their container
- Wide tables that pan on both axes without widening the page around them

### When not to use

- Section links that light up as the reader scrolls past each heading: use [Scrollspy](../scrollspy.md)
- A chat transcript that opens on the newest turn and follows streamed replies: use [Message Scroller](../message-scroller.md)
- Shoppers weighing rival products on price, star rating and specs: use the Comparison blocks

### Agent notes

- Give the `ScrollArea` root a bounded height or width through `className`, or it grows with its content and never scrolls
- `ScrollArea` draws only the vertical `ScrollBar`; for sideways scrolling pass a `ScrollBar` with `orientation` horizontal as a child
