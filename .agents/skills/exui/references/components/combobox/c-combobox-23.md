<!-- Generated from resources/components/combobox/c-combobox-23.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Lead Selection

> A lead selection combobox

- Type: example, free and open source (MIT)
- Component: [Combobox](../combobox.md)
- Page: [local reference](./c-combobox-23.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/combobox.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/combobox.md
- Uses: Avatar, Button, Combobox, Field, Item

## Best for

A single lead picked from a Team members group of avatar rows, marked You for the signed in user, or No lead

## Agent notes

- `ComboboxGroup` gets the full `teamMembers` array, so typing in `ComboboxInput` never hides a member row
- `isCurrentUser` adds the You suffix to one row of `teamMembers`; set it from your signed in user

## When not to use

- Assigning work to 1 person, with an invite row for new users: use [Assignee Selection](./c-combobox-28.md)

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
