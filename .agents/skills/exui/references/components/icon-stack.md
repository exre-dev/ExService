<!-- Generated from resources/components/icon-stack.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Icon Stack

>

- Type: upstream component, free
- Page: [local reference](./icon-stack.md)
- Examples: 6

## When to use

- Artwork for first run and no data screens, set in the media slot above the message
- Compact media for list rows, such as a package entry in an outlined row
- Decorative marks with more depth than a flat glyph, tinted by a theme color or topped with a badge

## When not to use

- A flat square surface that keeps one glyph the same size across rows and toolbars: use [Icon Tile](./icon-tile.md)
- A no data message that needs a title, description and actions laid out together: use [Empty](./empty.md)
- A ready made first run or zero results page, with copy, art and buttons in place: use the Empty State blocks

## Agent notes

- A text color class on `IconStack` reaches only the layer outlines and shadow; `icon-stack-content` gives the child `text-muted-foreground`
- Keep `IconStack` near its 72 wide by 81 tall `viewBox` ratio when resizing; the child is placed by percent of the box, not of the drawing
- The child sits in `icon-stack-content`, which is skewed and `pointer-events-none`, so a button or link placed there gets no clicks

## Examples

- [Isometric](./icon-stack/c-icon-stack-1.md): Isometric icon stack. Best for the minimal pattern with no classes on the stack: default size, neutral tones and one small layers glyph.
- [Sizes](./icon-stack/c-icon-stack-2.md): Icon stack sizes. Best for small, Default and Large stacks side by side with captions, the glyph growing from size-3.5 to size-6.
- [Colors](./icon-stack/c-icon-stack-3.md): Icon stack colors. Best for neutral, primary, success and warning tints in a captioned row, set on the stack and the glyph separately.
- [Badge Overlay](./icon-stack/c-icon-stack-4.md): Icon badge stack. Best for a round bordered chip with a check mark in place of a bare glyph, on a larger primary stack.
- [Empty State](./icon-stack/c-icon-stack-5.md): Empty state illustration. Best for a first run workspace screen with the stack above a title, description and Invite team and Connect source buttons.
- [Item Media](./icon-stack/c-icon-stack-6.md): Item media stack. Best for the smallest stack in the set, 44 by 48 pixels, as media in an outlined row with a title and description.
