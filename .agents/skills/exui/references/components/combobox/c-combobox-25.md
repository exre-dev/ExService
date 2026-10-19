<!-- Generated from resources/components/combobox/c-combobox-25.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Date Selection

> A date selection combobox with an optional custom picker dialog

- Type: example, free and open source (MIT)
- Component: [Combobox](../combobox.md)
- Page: [local reference](./c-combobox-25.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/combobox.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/combobox.md
- Uses: Button, Calendar, Combobox, Dialog, Field

## Best for

Date presets such as Tomorrow and End of month beside their dates, plus a Custom row opening a 2 month calendar dialog

## Agent notes

- Picking `customDateOption` opens the `Dialog` rather than selecting, and only Confirm in `handleConfirmCustomDate` commits `draftDate`
- Each `searchText` reaches only `itemToStringValue`, which sets the submitted value, so its keywords are never matched by any search

## When not to use

- A period typed as text, or chosen as a range, quarter, half year or year: use [Date Selector](../date-selector.md)

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)
- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start), through shadcn Calendar

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Combobox

### When to use

- Form fields that pick one option by typing to search, such as a framework, timezone or country
- Fields holding several picks as chips, such as frameworks or team members with avatars
- Task property pickers opened from a button, such as status, priority, assignee, labels, team or due date

### When not to use

- A short fixed list chosen from a button, with no typing to narrow it: use [Select](../select.md)
- A free text field that suggests matches but keeps whatever was typed: use [Autocomplete](../autocomplete.md)
- A complete signup or settings page with many fields and a submit row: use the Form blocks

### Agent notes

- Rows filter as the user types only when the function child of `ComboboxList` renders them; static `ComboboxItem` children always stay listed
- `itemToStringValue` sets only the submitted value; without itemToStringLabel, search matches an object item's label, else its value field, else its JSON
- Combobox parts take `render` in both twins, since both wrap `@base-ui/react`; `asChild` applies only to radix twin parts such as `DialogTrigger` and `Button`
