<!-- Generated from resources/components/carousel.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Carousel

> Open-source shadcn carousel components for image galleries, feature showcases, and testimonials.

- Type: shadcn/ui component, free
- Page: [local reference](./carousel.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/carousel.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/carousel.md
- Examples: 11

## When to use

- Photo galleries and featured slides shown one at a time, moved by swipe, arrow buttons or a timer
- Rows or columns of cards with several in view, sized per breakpoint or peeking at the next one
- Media viewers where a thumbnail strip or a row of dots tracks the current slide and jumps to any one

## When not to use

- A rotating set of customer testimonials with star ratings and avatars: use the Review blocks
- A shop page pairing a photo gallery with a buy box and size and color pickers: use the Product Detail blocks
- A storefront section of shop collections with hover browse buttons: use the Category Card blocks

## Agent notes

- Every slide is a `picsum.photos` placeholder built with `Array.from`; map your own images and alt text from a real array
- Where `CarouselPrevious` and `CarouselNext` are placed, they sit 3rem outside the slides at either end, so leave room or move them through `className`
- `Carousel` reacts only to `ArrowLeft` and `ArrowRight`, vertical ones included, and only while focus sits on a control inside it

## Third-party libraries

- Embla Carousel v8: [API reference](https://www.embla-carousel.com/docs/v8/api), [docs](https://www.embla-carousel.com/docs/v8/get-started/react)
- Embla Carousel Autoplay v8: [API reference](https://www.embla-carousel.com/docs/v8/plugins/autoplay), [docs](https://www.embla-carousel.com/docs/v8/plugins), used by 1 of 11 examples

## Examples

- [Basic](./carousel/c-carousel-1.md): Basic carousel with single item. Best for the minimal setup with no options: 5 square photos one per view, arrow buttons shown from the sm breakpoint up.
- [Vertical](./carousel/c-carousel-2.md): Vertical carousel orientation. Best for cards stacked in a fixed height column that scrolls up and down, 2 in view, with arrows above and below.
- [Multiple Items](./carousel/c-carousel-3.md): Carousel with multiple items visible. Best for a wide row holding 3 square photos in view at every screen width, aligned to the start.
- [Responsive Basis](./carousel/c-carousel-4.md): Carousel with responsive basis. Best for portrait photos whose count in view climbs from 1 on phones to 4 on large screens, across 8 slides.
- [Autoplay](./carousel/c-carousel-5.md): Carousel with autoplay plugin. Best for square photos that advance by themselves every 2 seconds through the Autoplay plugin, arrows kept.
- [Centered Alignment](./carousel/c-carousel-6.md): Carousel with centered slide alignment. Best for a looping row of 16:9 slides at 70 percent width, centered so both neighbors peek in at the edges.
- [Custom Spacing](./carousel/c-carousel-7.md): Carousel with custom spacing. Best for a pair of square photos in view with the slide gutter cut from the default 16px to 4px.
- [Image Overlays](./carousel/c-carousel-8.md): Carousel with images and overlays. Best for wide 16:9 slides with a title and caption set on a dark bottom fade, zooming the photo on hover.
- [Thumbnail Strip](./carousel/c-carousel-9.md): Carousel with thumbnail navigation. Best for a main slide above a free scrolling strip of 10 thumbnails that outlines the active one and jumps on click.
- [Overlay Thumbnails](./carousel/c-carousel-10.md): Carousel with overlay thumbnail navigation. Best for thumbnails set over the bottom of a 16:9 slide on a dark gradient, the active one outlined in white.
- [Dots Navigation](./carousel/c-carousel-11.md): Carousel with dots navigation and content overlays. Best for square captioned slides with a row of dots under them, the active dot stretched wider, and no arrow buttons.
