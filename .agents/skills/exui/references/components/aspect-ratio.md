<!-- Generated from resources/components/aspect-ratio.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Aspect Ratio

> Open-source shadcn aspect ratio components for responsive media, image galleries, and video previews.

- Type: shadcn/ui component, free
- Page: [local reference](./aspect-ratio.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/aspect-ratio.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/aspect-ratio.md
- Examples: 8

## When to use

- Video, banner and screenshot slots in widescreen shapes such as 16:9, 21:9 and 16:10
- Photo and thumbnail slots in square, landscape or portrait shapes, cropped to fill the box
- Media boxes whose height follows their width, so the space is held before the image arrives

## When not to use

- A sign in page split between the form and a full height image panel: use the Auth blocks
- Several images the user swipes or steps through one at a time: use [Carousel](./carousel.md)
- A choice of exactly one option from a short visible list: use [Radio Group](./radio-group.md)

## Agent notes

- Pass `ratio` as width divided by height, as in 16 / 9; the base twin requires it and the radix twin falls back to 1 when it is missing
- Every `img` is a random grayscale `picsum.photos` placeholder whose `alt` is only the ratio label; swap `src` and write a real `alt`
- Set width on a parent, as the `max-w-md` or `max-w-xs` wrapper does; radix puts `className` on an absolute inner layer, where a width class breaks the ratio

## Examples

- [Widescreen](./aspect-ratio/c-aspect-ratio-1.md): 16:9 widescreen aspect ratio. Best for a landscape 16:9 box, the shape of video players and modern slide decks, in a column up to 28rem wide.
- [Standard](./aspect-ratio/c-aspect-ratio-2.md): 4:3 standard aspect ratio. Best for the 4:3 shape of phone camera photos and classic TV footage, in a landscape box up to 28rem wide.
- [Square](./aspect-ratio/c-aspect-ratio-3.md): 1:1 square aspect ratio. Best for an equal sided box for product shots, album covers and grid tiles, kept to 20rem wide.
- [Ultrawide](./aspect-ratio/c-aspect-ratio-4.md): 21:9 ultrawide aspect ratio. Best for an extra wide 21:9 strip for cinematic banners and page headers, at most 28rem across.
- [Tall Portrait](./aspect-ratio/c-aspect-ratio-5.md): 9:16 portrait aspect ratio. Best for a tall 9:16 box, the shape of stories and short full screen vertical video, at most 20rem wide.
- [Classic Photo](./aspect-ratio/c-aspect-ratio-6.md): 3:2 classic photography aspect ratio. Best for the 3:2 shape of most DSLR and 35mm film photos, for blog and article images up to 28rem wide.
- [Social Portrait](./aspect-ratio/c-aspect-ratio-7.md): 4:5 social media portrait aspect ratio. Best for a slightly tall 4:5 box sized for portrait posts in a social feed, kept to 20rem wide.
- [Monitor](./aspect-ratio/c-aspect-ratio-8.md): 16:10 computer monitor aspect ratio. Best for the 16:10 shape of many laptop and monitor displays, for app screenshots and device mockups up to 28rem wide.
