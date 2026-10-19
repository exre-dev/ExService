<!-- Generated from resources/components/radio-group.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Radio Group

> Open-source shadcn radio group components for single-choice forms, plan selection, and settings preferences.

- Type: shadcn/ui component, free
- Page: [local reference](./radio-group.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/radio-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/radio-group.md
- Examples: 17

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Radio field selection

`FieldLabel` keeps its background unchanged when a nested `RadioGroupItem` is selected, including card and settings-row compositions. The radio circle and indicator show the selected state. Label clicks and arrow-key selection remain available; add an explicit background class if the composition needs a tinted row or card.
<!-- exui-capabilities:end:skill -->

## When to use

- Short single choice lists in forms and settings, such as density, visibility, role or release channel
- Option tiles and divided card rows for shipping speed, contact method, language or a teammate
- Checkout and plan steps that pick one saved payment method or one priced subscription tier

## When not to use

- A list where any number of the options can be ticked together: use [Checkbox](./checkbox.md)
- A whole modal step built around one choice, such as a template or a sync scope: use the Dialog blocks
- A full plan table with billing period tabs and a feature list per tier: use the Pricing blocks

## Agent notes

- Every example seeds `RadioGroup` through `defaultValue` and reads nothing back; pass a controlled value and a change handler to act on the pick
- No example sets a name on `RadioGroup`, so a native form post carries no choice; add one when the group lives in a form
- Every `RadioGroupItem` `id` is a fixed string such as r1 or an option value; derive unique ids when a group can render twice on one page

## Examples

- [Basic](./radio-group/c-radio-group-1.md): Basic radio group. Best for the bare pattern: 3 density options, each dot tied to its label through id and htmlFor, Comfortable picked on load.
- [Disabled](./radio-group/c-radio-group-2.md): Disabled radio group. Best for the density list with its preselected Comfortable option locked: the dot disabled, its label dimmed by the Field.
- [Descriptions](./radio-group/c-radio-group-3.md): Radio with description. Best for density options that each carry a one line hint stacked under the label inside FieldContent.
- [Invalid](./radio-group/c-radio-group-4.md): Invalid radio group. Best for a 2 option Email or SMS choice shown in error, with data-invalid on each Field and aria-invalid on each dot.
- [Colored](./radio-group/c-radio-group-5.md): Colored radio group. Best for options whose circles take a blue, green or yellow border through a className override on each item.
- [Legend & Description](./radio-group/c-radio-group-6.md): Radio group with legend and description. Best for a fieldset whose legend and hint title the whole set, here 3 battery levels with Medium picked.
- [Descriptive Cards](./radio-group/c-radio-group-7.md): Card radio group with descriptions. Best for two outlined plan tiles, Plus and Pro, a title and one line pitch left of a trailing dot, the whole tile clickable.
- [Card Separators](./radio-group/c-radio-group-8.md): Radio group in card with separators. Best for shipping speeds as 3 full width rows inside one Card, split by separators, the dot leading each title.
- [Card Icons](./radio-group/c-radio-group-9.md): Radio group in card with icons. Best for contact method rows in one Card, each opening on a muted mail, phone or chat icon with the dot at the far end.
- [In Frame](./radio-group/c-radio-group-10.md): Radio group in frame. Best for four language rows in a upstream Frame, a Language title bar over one panel whose rows are split by separators.
- [Grid Layout](./radio-group/c-radio-group-11.md): Radio group with grid layout. Best for four product area tiles in 2 columns, each an icon chip over a title and blurb, with the dot pinned top right.
- [Avatar Cards](./radio-group/c-radio-group-12.md): Avatar based card radio group. Best for two person tiles with avatar photo, name and handle, picking a single teammate through a trailing dot.
- [Payment Methods](./radio-group/c-radio-group-13.md): Payment method radio cards. Best for saved Visa and Mastercard tiles with last 4 digits and expiry, plus an add new method tile, each with a corner dot.
- [Tooltip Info](./radio-group/c-radio-group-14.md): Radio group with tooltip info. Best for public and private visibility choices whose labels end in a help icon that opens a longer explanation in a tooltip.
- [Badges](./radio-group/c-radio-group-15.md): Radio group with badges. Best for release channels where Stable wears a secondary Recommended pill and Beta a default New pill, Canary left bare.
- [Inline Horizontal](./radio-group/c-radio-group-16.md): Inline horizontal radio group. Best for admin, Editor and Viewer roles set side by side in one row that wraps on narrow screens, Viewer picked.
- [Pricing Tiers](./radio-group/c-radio-group-17.md): Pricing plan radio cards. Best for free, Pro and Enterprise tiers mapped from an array, each row pairing the name with a monthly price over a pitch.
