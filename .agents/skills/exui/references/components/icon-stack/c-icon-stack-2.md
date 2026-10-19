<!-- Generated from resources/components/icon-stack/c-icon-stack-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sizes

> Icon stack sizes

- Type: example, free and open source (MIT)
- Component: [Icon Stack](../icon-stack.md)
- Page: [local reference](./c-icon-stack-2.md)
- Uses: Icon Stack

## Best for

Small, Default and Large stacks side by side with captions, the glyph growing from size-3.5 to size-6

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Icon Stack

### When to use

- Artwork for first run and no data screens, set in the media slot above the message
- Compact media for list rows, such as a package entry in an outlined row
- Decorative marks with more depth than a flat glyph, tinted by a theme color or topped with a badge

### When not to use

- A flat square surface that keeps one glyph the same size across rows and toolbars: use [Icon Tile](../icon-tile.md)
- A no data message that needs a title, description and actions laid out together: use [Empty](../empty.md)
- A ready made first run or zero results page, with copy, art and buttons in place: use the Empty State blocks

### Agent notes

- A text color class on `IconStack` reaches only the layer outlines and shadow; `icon-stack-content` gives the child `text-muted-foreground`
- Keep `IconStack` near its 72 wide by 81 tall `viewBox` ratio when resizing; the child is placed by percent of the box, not of the drawing
- The child sits in `icon-stack-content`, which is skewed and `pointer-events-none`, so a button or link placed there gets no clicks
