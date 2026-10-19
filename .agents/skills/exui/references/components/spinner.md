<!-- Generated from resources/components/spinner.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Spinner

> Open-source shadcn spinner components for loading indicators, async actions, and button states.

- Type: shadcn/ui component, free
- Page: [local reference](./spinner.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/spinner.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/spinner.md
- Examples: 12

## When to use

- Pending states inside buttons, status badges and search fields while a request runs
- Loading views for a card or an empty panel, including blurred covers over content being refreshed
- Inline notes such as checking, syncing or reconnecting, led by a small tinted spinner or bouncing dots

## When not to use

- Content of a known layout, held as muted placeholder shapes until it arrives: use [Skeleton](./skeleton.md)
- A wait where the share of work done is known, such as an upload percent: use [Progress](./progress.md)
- A save control that tracks its own pending and done states after a click: use [Button](./button.md)

## Agent notes

- No example holds a pending flag and `disabled` is hardcoded where it appears; show the indicator and lock controls from your own request state

## Examples

- [Basic](./spinner/c-spinner-1.md): Basic spinner.. Best for the bare default at its built-in 16px size, with no props and no text beside it.
- [In Buttons](./spinner/c-spinner-2.md): Spinners in buttons.. Best for leading spinners in a live primary, a disabled outline and a square icon only button with its own label.
- [In Badges](./spinner/c-spinner-3.md): Spinners in badges.. Best for status labels in primary, secondary and outline plus light destructive, success and info tints, each led by a spinner.
- [In Input Group](./spinner/c-spinner-4.md): Spinner in input group.. Best for a search field under a Searching label, its spinner shown in a leading addon before the typed text.
- [In Empty State](./spinner/c-spinner-5.md): Spinner in empty state.. Best for a centered loading view with the spinner in a muted tile, a Loading projects heading and a Cancel action.
- [Pending Buttons](./spinner/c-spinner-6.md): Button loading states. Best for disabled default, outline and secondary buttons, each pairing a spinner with a pending word like Saving.
- [Overlay With Caption](./spinner/c-spinner-7.md): Overlay loading spinner. Best for a blurred translucent cover with a Refreshing data caption laid over a monthly report card's figures.
- [Full Page](./spinner/c-spinner-8.md): Full page loading state. Best for a standalone card with a faded spinner above a setup message and a smaller muted hint.
- [Inline Text](./spinner/c-spinner-9.md): Inline loading text with spinner. Best for stacked status lines with 14px spinners, 2 tinted by the success and warning tokens for connected and reconnecting.
- [Loading Dots](./spinner/c-spinner-10.md): Animated loading dots. Best for a row of 3 dots that bounce on staggered delays, drawn as plain spans in the primary color, with no icon.
- [Card Overlay](./spinner/c-spinner-11.md): Spinner overlay on card. Best for a blurred cover holding only a spinner, nested inside the card it hides, with no caption.
- [Color Variants](./spinner/c-spinner-12.md): Spinner color variants. Best for a row of 5 spinners at 16px, tinted blue, green, red, yellow and purple through text color classes.
