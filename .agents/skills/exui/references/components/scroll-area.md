<!-- Generated from resources/components/scroll-area.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Scroll Area

> Open-source shadcn scroll area components for custom scroll regions, sidebar panes, and dense lists.

- Type: shadcn/ui component, free
- Page: [local reference](./scroll-area.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/scroll-area.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/scroll-area.md
- Examples: 5

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Fixed height lists and photo columns that scroll inside their own box with a custom scrollbar
- Sideways strips of cards or photos kept to the width of their container
- Wide tables that pan on both axes without widening the page around them

## When not to use

- Section links that light up as the reader scrolls past each heading: use [Scrollspy](./scrollspy.md)
- A chat transcript that opens on the newest turn and follows streamed replies: use [Message Scroller](./message-scroller.md)
- Shoppers weighing rival products on price, star rating and specs: use the Comparison blocks

## Agent notes

- Give the `ScrollArea` root a bounded height or width through `className`, or it grows with its content and never scrolls
- `ScrollArea` draws only the vertical `ScrollBar`; for sideways scrolling pass a `ScrollBar` with `orientation` horizontal as a child

## Examples

- [Basic](./scroll-area/c-scroll-area-1.md): Basic scroll area. Best for a narrow column of 30 version tags under a Releases heading, split by divider lines, that only scrolls up and down.
- [Horizontal](./scroll-area/c-scroll-area-2.md): Scroll area with horizontal scrollbar. Best for one row of 10 photo cards that pans sideways under a horizontal bar, in a box only as tall as the row.
- [Both Scrollbars](./scroll-area/c-scroll-area-3.md): Scroll area with both scrollbars. Best for an 8 plan pricing table with a price column and 6 feature columns that pans both across and down.
- [Fade Edges](./scroll-area/c-scroll-area-4.md): Scroll area with fade effect. Best for edges that fade only while content is hidden past them, over a photo column with a tinted round thumb.
- [Scrollbar Gutter](./scroll-area/c-scroll-area-5.md): Scroll area with scrollbar gutter. Best for full width photo cards that gain side padding once the column overflows, keeping the bar clear of the images.
