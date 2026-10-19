<!-- Generated from resources/components/checkbox.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Checkbox

> Open-source shadcn checkbox components for multi-select forms, settings preferences, and table selection.

- Type: shadcn/ui component, free
- Page: [local reference](./checkbox.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/checkbox.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/checkbox.md
- Examples: 22

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Checkbox inside FieldLabel

Selecting a `Checkbox` inside `FieldLabel` changes the checkbox fill and checkmark while keeping the label background unchanged. This applies to both checkbox cards and settings rows. Clicking the label still toggles its checkbox.
<!-- exui-capabilities:end:skill -->

## When to use

- Consent and opt-in fields, such as accepting terms or turning on a feature
- Lists where any number of options can be ticked, like notification channels or permissions
- Selectable cards and tiles for modules, people or a saved payment card

## When not to use

- A choice where exactly 1 option of a set may be picked: use [Radio Group](./radio-group.md)
- An on or off setting that applies the moment it is flipped: use [Switch](./switch.md)
- A complete record entry page with many field types and a submit handler: use the Form blocks

## Agent notes

- No example passes a name to `Checkbox`, so a native submit sends none of these boxes; give each one a name inside a real form
- The base twin sets the mixed state with the `indeterminate` prop; the radix twin passes `checked` as the string indeterminate
- A mixed state draws the same `CheckIcon` as a ticked box, as the indicator has no minus icon; add one in `Checkbox` to show a dash

## Examples

- [Basic](./checkbox/c-checkbox-1.md): Basic checkbox with label. Best for a single unchecked box tied to its label through id and htmlFor, with no helper copy below.
- [Disabled](./checkbox/c-checkbox-2.md): Disabled checkbox. Best for a box that starts ticked and cannot be toggled, with its whole Field flagged disabled.
- [Invalid](./checkbox/c-checkbox-3.md): Invalid checkbox. Best for an error state driven by aria-invalid on the box and data-invalid on the Field around it.
- [Indeterminate](./checkbox/c-checkbox-4.md): Indeterminate checkbox. Best for a box held in the mixed state that a parent shows when only some of its children are ticked.
- [Label & Description](./checkbox/c-checkbox-5.md): Checkbox with label and description. Best for a consent line such as accepting terms, ticked by default, with helper copy under the label.
- [Colored](./checkbox/c-checkbox-6.md): Colored checkbox. Best for ticked boxes recolored blue, green and yellow with data-checked fill and border classes in both themes.
- [Circle To-Do](./checkbox/c-checkbox-7.md): Circle checkbox. Best for a round box whose label dims and gets struck through once ticked, like a done item in a to-do list.
- [Basic Group](./checkbox/c-checkbox-8.md): Checkbox group. Best for a titled stack of 3 notification channels, each row its own box and label, 2 of them ticked.
- [Setting Card](./checkbox/c-checkbox-9.md): Card checkbox with group. Best for one bordered card, clickable anywhere, that pairs a setting title with a line of helper copy.
- [Frame Group](./checkbox/c-checkbox-10.md): Checkbox group in a frame. Best for notification rows inside the upstream Frame primitive, a titled header over a panel split by separators.
- [Card Rows](./checkbox/c-checkbox-11.md): Card checkbox group with icons. Best for a plain Card of 3 full width rows split by separators, each whole row toggling its leading box.
- [Icon Card Rows](./checkbox/c-checkbox-12.md): Card checkbox group with icons. Best for card rows that lead with a muted channel icon and push the box to the trailing edge.
- [Corner Check Tiles](./checkbox/c-checkbox-13.md): Custom positioned checkbox. Best for a row of 3 compact title tiles, each with a round borderless check overhanging its top right corner.
- [Module Tiles](./checkbox/c-checkbox-14.md): Custom positioned checkbox. Best for a 2 column grid of module tiles with an icon chip, title and description, and a round box inset top right.
- [Avatar Card](./checkbox/c-checkbox-15.md): Avatar based card checkbox. Best for a person card with avatar, name and handle, the box sitting at its trailing edge.
- [Nested Permissions](./checkbox/c-checkbox-16.md): Nested checkbox group. Best for a 3 level permission tree where a parent ticks or clears every leaf below and shows a mixed state when only some are on.
- [Payment Method](./checkbox/c-checkbox-17.md): Payment method card checkbox. Best for a saved card tile with a brand mark, masked number and expiry, ticked by a round box in its corner.
- [Help Icon Tooltip](./checkbox/c-checkbox-18.md): Checkbox with label and tooltip info. Best for an opt-in whose label ends in a help icon that opens a tooltip on the right with the longer explanation.
- [Badge Group](./checkbox/c-checkbox-19.md): Checkbox group with badge. Best for feature opt-ins tagged with the upstream Badge at its sm size, a default New pill and a secondary Beta pill.
- [Right Side Tooltip](./checkbox/c-checkbox-20.md): Checkbox with label and tooltip info. Best for an exact duplicate of c-checkbox-18, sharing its tooltip-checkbox id, label text and right side tooltip.
- [Inline Group](./checkbox/c-checkbox-21.md): Inline horizontal checkbox group. Best for short options such as Read, Write and Delete set side by side in a row that wraps on narrow screens.
- [Uppercase Badges](./checkbox/c-checkbox-22.md): Checkbox with feature badge. Best for feature flags tagged with the stock Badge shrunk by hand to an 18px pill of 10px uppercase text with wide tracking.
