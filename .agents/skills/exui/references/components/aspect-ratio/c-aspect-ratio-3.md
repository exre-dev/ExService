<!-- Generated from resources/components/aspect-ratio/c-aspect-ratio-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Square

> 1:1 square aspect ratio

- Type: example, free and open source (MIT)
- Component: [Aspect Ratio](../aspect-ratio.md)
- Page: [local reference](./c-aspect-ratio-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/aspect-ratio.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/aspect-ratio.md
- Uses: Aspect Ratio

## Best for

An equal sided box for product shots, album covers and grid tiles, kept to 20rem wide

## When not to use

- A small round user photo with an initials fallback: use [Avatar](../avatar.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Aspect Ratio

### When to use

- Video, banner and screenshot slots in widescreen shapes such as 16:9, 21:9 and 16:10
- Photo and thumbnail slots in square, landscape or portrait shapes, cropped to fill the box
- Media boxes whose height follows their width, so the space is held before the image arrives

### When not to use

- A sign in page split between the form and a full height image panel: use the Auth blocks
- Several images the user swipes or steps through one at a time: use [Carousel](../carousel.md)
- A choice of exactly one option from a short visible list: use [Radio Group](../radio-group.md)

### Agent notes

- Pass `ratio` as width divided by height, as in 16 / 9; the base twin requires it and the radix twin falls back to 1 when it is missing
- Every `img` is a random grayscale `picsum.photos` placeholder whose `alt` is only the ratio label; swap `src` and write a real `alt`
- Set width on a parent, as the `max-w-md` or `max-w-xs` wrapper does; radix puts `className` on an absolute inner layer, where a width class breaks the ratio
