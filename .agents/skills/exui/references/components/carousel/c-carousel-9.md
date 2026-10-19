<!-- Generated from resources/components/carousel/c-carousel-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Thumbnail Strip

> Carousel with thumbnail navigation

- Type: example, free and open source (MIT)
- Component: [Carousel](../carousel.md)
- Page: [local reference](./c-carousel-9.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/carousel.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/carousel.md
- Uses: Carousel

## Best for

A main slide above a free scrolling strip of 10 thumbnails that outlines the active one and jumps on click

## Agent notes

- Each thumbnail is a `CarouselItem` div with an `onClick` that takes no focus, so a keyboard user cannot pick a slide; render a button inside it
- Both carousels map `ITEMS_COUNT` slides by index, so feed them from one shared array to keep each thumbnail on its slide

## When not to use

- Thumbnails laid over the lower edge of the main image on a dark fade: use [Overlay Thumbnails](./c-carousel-10.md)

## Third-party libraries

- Embla Carousel v8: [API reference](https://www.embla-carousel.com/docs/v8/api), [docs](https://www.embla-carousel.com/docs/v8/get-started/react), through shadcn Carousel

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Carousel

### When to use

- Photo galleries and featured slides shown one at a time, moved by swipe, arrow buttons or a timer
- Rows or columns of cards with several in view, sized per breakpoint or peeking at the next one
- Media viewers where a thumbnail strip or a row of dots tracks the current slide and jumps to any one

### When not to use

- A rotating set of customer testimonials with star ratings and avatars: use the Review blocks
- A shop page pairing a photo gallery with a buy box and size and color pickers: use the Product Detail blocks
- A storefront section of shop collections with hover browse buttons: use the Category Card blocks

### Agent notes

- Every slide is a `picsum.photos` placeholder built with `Array.from`; map your own images and alt text from a real array
- Where `CarouselPrevious` and `CarouselNext` are placed, they sit 3rem outside the slides at either end, so leave room or move them through `className`
- `Carousel` reacts only to `ArrowLeft` and `ArrowRight`, vertical ones included, and only while focus sits on a control inside it
