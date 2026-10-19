<!-- Generated from resources/components/slider/c-slider-11.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Value Tooltip

> Slider with dynamic tooltip indicator

- Type: example, free and open source (MIT)
- Component: [Slider](../slider.md)
- Page: [local reference](./c-slider-11.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/slider.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/slider.md
- Uses: Label, Slider

## Best for

A volume level whose percent rides above the thumb in a filled bubble with a small arrow, moving as it drags

## Agent notes

- Change the local `min` and `max` constants, not the `Slider` props alone, since the bubble's `percentage` reads them too

## When not to use

- A short hint shown on hover or focus beside a button or an icon: use [Tooltip](../tooltip.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Slider

### When to use

- Settings tuned by dragging along a bounded scale, such as volume, opacity or color temperature
- Ranges picked with 2 or more thumbs on a single track, laid out horizontally or vertically
- Durations, storage sizes and scores read off tick marks, scale labels, a value bubble or an emoji

### When not to use

- A complete shop facet panel with brands, colors, sizes and a price range: use the Filter Sidebar blocks
- A value typed straight into a box, such as an exact price, with no scale to drag: use [Input](../input.md)
- A read only bar that reports how far a task or upload has got: use [Progress](../progress.md)

### Agent notes

- The base `Slider` draws a thumb per entry of an array `value` or `defaultValue`; a plain number gets 2 stacked thumbs and 2 tab stops
- `htmlFor` on a `Label` reaches only the root div of the base `Slider`, not its thumb input; name the slider with aria-labelledby instead
- Base `onValueChange` is typed as a number or a read only array, so narrow it with `Array.isArray`; the radix twin passes a number array
