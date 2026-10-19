<!-- Generated from resources/components/combobox/c-combobox-27.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Team Selection

> A team selection combobox

- Type: example, free and open source (MIT)
- Component: [Combobox](../combobox.md)
- Page: [local reference](./c-combobox-27.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/combobox.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/combobox.md
- Uses: Button, Combobox, Field

## Best for

One owning team per record, each marked by its own tinted glyph, with a No team row to unset it

## Agent notes

- The `teamOptions` rows are mapped by hand outside the list's render function, so a typed query leaves every team in view
- `TeamMark` falls back to the sparkles glyph for an unknown `tone`, and `teamToneClassName` needs an entry for each tone to color it

## When not to use

- A person rather than a team, shown with an avatar: use [Assignee Selection](./c-combobox-28.md)

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
