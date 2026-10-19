<!-- Generated from resources/components/slider.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Slider

> Open-source shadcn slider components for range filters, pricing controls, and media settings.

- Type: shadcn/ui component, free
- Page: [local reference](./slider.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/slider.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/slider.md
- Examples: 12

## When to use

- Settings tuned by dragging along a bounded scale, such as volume, opacity or color temperature
- Ranges picked with 2 or more thumbs on a single track, laid out horizontally or vertically
- Durations, storage sizes and scores read off tick marks, scale labels, a value bubble or an emoji

## When not to use

- A complete shop facet panel with brands, colors, sizes and a price range: use the Filter Sidebar blocks
- A value typed straight into a box, such as an exact price, with no scale to drag: use [Input](./input.md)
- A read only bar that reports how far a task or upload has got: use [Progress](./progress.md)

## Agent notes

- The base `Slider` draws a thumb per entry of an array `value` or `defaultValue`; a plain number gets 2 stacked thumbs and 2 tab stops
- `htmlFor` on a `Label` reaches only the root div of the base `Slider`, not its thumb input; name the slider with aria-labelledby instead
- Base `onValueChange` is typed as a number or a read only array, so narrow it with `Array.isArray`; the radix twin passes a number array

## Examples

- [Basic](./slider/c-slider-1.md): Basic slider.. Best for the bare uncontrolled control: a single value starting at 50 on a 0 to 100 scale, with no label or readout.
- [Disabled](./slider/c-slider-2.md): Disabled slider. Best for a locked setting held at 50 that people can see but cannot drag, click or step with the keys.
- [Multiple Thumbs](./slider/c-slider-3.md): Slider with multiple discrete values. Best for a track with 3 thumbs starting at 10, 40 and 80, each snapping to steps of 10.
- [Vertical](./slider/c-slider-4.md): Vertical slider with range selection. Best for a pair of upright tracks side by side, one holding a single value and one a 2 thumb span in steps of 5.
- [Controlled Value](./slider/c-slider-5.md): Slider with controlled value tracking. Best for a 2 thumb span over a 0 to 1 scale in tenths, held in state and printed above the track to 1 decimal place.
- [Range](./slider/c-slider-6.md): Slider with range selection. Best for the plain 2 thumb span: ends at 25 and 75 on a 0 to 100 track that move in steps of 5, with no state.
- [Number Input](./slider/c-slider-7.md): Slider synced with number input. Best for an opacity percent kept in step between the track and a number box beside the label, either one driving the other.
- [Color Temperature](./slider/c-slider-8.md): Color temperature slider. Best for a kelvin value from 2700 to 6500 in steps of 100 below a warm to cool gradient strip, with its band named in the readout.
- [Reference Labels](./slider/c-slider-9.md): Slider with reference labels. Best for a 5 to 35 GB storage pick with its low, middle and high marks printed under the track.
- [Tick Marks](./slider/c-slider-10.md): Slider with tick marks. Best for a 0 to 12 month duration with a tick per month and a number on every second tick, all built from the max constant.
- [Value Tooltip](./slider/c-slider-11.md): Slider with dynamic tooltip indicator. Best for a volume level whose percent rides above the thumb in a filled bubble with a small arrow, moving as it drags.
- [Emoji Rating](./slider/c-slider-12.md): Rating slider with emoji feedback. Best for a 1 to 5 experience score that swaps a face emoji beside the track and a word such as Okay under it.
