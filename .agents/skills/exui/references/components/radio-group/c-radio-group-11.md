<!-- Generated from resources/components/radio-group/c-radio-group-11.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Grid Layout

> Radio group with grid layout

- Type: example, free and open source (MIT)
- Component: [Radio Group](../radio-group.md)
- Page: [local reference](./c-radio-group-11.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/radio-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/radio-group.md
- Uses: Field, Radio Group

## Best for

Four product area tiles in 2 columns, each an icon chip over a title and blurb, with the dot pinned top right

## Agent notes

- Replace `items` with your options; each `value` is also the `RadioGroupItem` `id` and `htmlFor`, so keep it unique on the page

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Radio Group

### When to use

- Short single choice lists in forms and settings, such as density, visibility, role or release channel
- Option tiles and divided card rows for shipping speed, contact method, language or a teammate
- Checkout and plan steps that pick one saved payment method or one priced subscription tier

### When not to use

- A list where any number of the options can be ticked together: use [Checkbox](../checkbox.md)
- A whole modal step built around one choice, such as a template or a sync scope: use the Dialog blocks
- A full plan table with billing period tabs and a feature list per tier: use the Pricing blocks

### Agent notes

- Every example seeds `RadioGroup` through `defaultValue` and reads nothing back; pass a controlled value and a change handler to act on the pick
- No example sets a name on `RadioGroup`, so a native form post carries no choice; add one when the group lives in a form
- Every `RadioGroupItem` `id` is a fixed string such as r1 or an option value; derive unique ids when a group can render twice on one page
