<!-- Generated from resources/components/rating.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Rating

> Open-source shadcn rating components for product reviews, feedback forms, and satisfaction scores.

- Type: upstream component, free
- Page: [local reference](./rating.md)
- Examples: 9

## When to use

- Read only star scores at 3 sizes, with partial stars for averages such as 3.5 or 4.6
- Star inputs that collect a whole star score in feedback and written review forms
- Review summaries with a count bar per star level, and 5 step emoji scales for quick feedback

## When not to use

- A full product page section of buyer quotes, avatars and a ratings overview: use the Review blocks
- A required score that keyboard and screen reader users must be able to set: use [Radio Group](./radio-group.md)
- A score picked in half or finer steps rather than whole stars: use [Slider](./slider.md)

## Agent notes

- An `editable` `Rating` takes pointer clicks only: each star is a `div` with an `onClick` and no role, tab stop or key handler
- Clicks send whole numbers from 1 to `maxRating` to `onRatingChange`; a decimal `rating` draws a partial star but cannot be picked
- `starClassName` styles the `showValue` number, not the stars; recolor stars from `className` through the `rating-star-filled` slot

## Third-party libraries

- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 1 of 9 examples

## Examples

- [Basic](./rating/c-rating-1.md): Basic rating.. Best for the minimal read only display: a whole score of 4 at the default size with no number shown.
- [Decimal Value](./rating/c-rating-2.md): Rating with decimal value.. Best for a half star score of 3.5, drawn as 3 full stars and a fourth filled halfway, with no number.
- [Show Value](./rating/c-rating-3.md): Rating with show value.. Best for a 4.5 score with its value printed after the stars to 1 decimal place in muted text.
- [Editable](./rating/c-rating-4.md): Rating with editable.. Best for a click to score input that starts empty, prints the hovered or picked number and confirms each pick with a toast.
- [Sizes](./rating/c-rating-5.md): Rating with size.. Best for the sm, default and lg sizes stacked at the same score of 4 to compare star size and spacing.
- [Review Summary](./rating/c-rating-6.md): Rating with review summary. Best for a ratings overview: a large average over small stars and a review total, then a yellow count bar per star level.
- [Half-Star Input](./rating/c-rating-7.md): Interactive half-star rating. Best for a star input preset to 3.5 with a line under it echoing the chosen score out of 5.
- [Emoji Reactions](./rating/c-rating-8.md): Emoji reaction rating. Best for a 5 face scale from Terrible to Amazing on plain buttons, naming the chosen mood under the row.
- [Review Text](./rating/c-rating-9.md): Rating with review text input. Best for a review card: a star input, a reply line that shifts with the score, a comment box and a Submit locked until a pick.
