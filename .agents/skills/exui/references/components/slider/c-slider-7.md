<!-- Generated from resources/components/slider/c-slider-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Number Input

> Slider synced with number input

- Type: example, free and open source (MIT)
- Component: [Slider](../slider.md)
- Page: [local reference](./c-slider-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/slider.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/slider.md
- Uses: Input, Label, Slider

## Best for

An opacity percent kept in step between the track and a number box beside the label, either one driving the other

## Agent notes

- The 0 to 100 bounds sit in the `Input` `onChange` check, its `min` and `max`, and the `Slider` `max`; change them together
- A cleared number box reads as 0 through `Number`, so emptying the `Input` snaps the slider to 0

## When not to use

- An amount stepped with plus and minus buttons and no track at all: use [Number Field](../number-field.md)

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
