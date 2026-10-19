<!-- Generated from resources/components/rating/c-rating-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sizes

> Rating with size.

- Type: example, free and open source (MIT)
- Component: [Rating](../rating.md)
- Page: [local reference](./c-rating-5.md)
- Uses: Rating

## Best for

The sm, default and lg sizes stacked at the same score of 4 to compare star size and spacing

## When not to use

- A score the user sets by clicking a star: use [Editable](./c-rating-4.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Rating

### When to use

- Read only star scores at 3 sizes, with partial stars for averages such as 3.5 or 4.6
- Star inputs that collect a whole star score in feedback and written review forms
- Review summaries with a count bar per star level, and 5 step emoji scales for quick feedback

### When not to use

- A full product page section of buyer quotes, avatars and a ratings overview: use the Review blocks
- A required score that keyboard and screen reader users must be able to set: use [Radio Group](../radio-group.md)
- A score picked in half or finer steps rather than whole stars: use [Slider](../slider.md)

### Agent notes

- An `editable` `Rating` takes pointer clicks only: each star is a `div` with an `onClick` and no role, tab stop or key handler
- Clicks send whole numbers from 1 to `maxRating` to `onRatingChange`; a decimal `rating` draws a partial star but cannot be picked
- `starClassName` styles the `showValue` number, not the stars; recolor stars from `className` through the `rating-star-filled` slot
