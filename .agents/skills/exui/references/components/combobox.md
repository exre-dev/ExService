<!-- Generated from resources/components/combobox.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Combobox

> Open-source shadcn combobox components for searchable selection, async lookup, and command menus.

- Type: shadcn/ui component, free
- Page: [local reference](./combobox.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/combobox.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/combobox.md
- Examples: 28

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `ComboboxInput`, `ComboboxContent`, `ComboboxChips`, `ComboboxChip`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { ComboboxInput } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof ComboboxInput>) {
  return <ComboboxInput {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Form fields that pick one option by typing to search, such as a framework, timezone or country
- Fields holding several picks as chips, such as frameworks or team members with avatars
- Task property pickers opened from a button, such as status, priority, assignee, labels, team or due date

## When not to use

- A short fixed list chosen from a button, with no typing to narrow it: use [Select](./select.md)
- A free text field that suggests matches but keeps whatever was typed: use [Autocomplete](./autocomplete.md)
- A complete signup or settings page with many fields and a submit row: use the Form blocks

## Agent notes

- Rows filter as the user types only when the function child of `ComboboxList` renders them; static `ComboboxItem` children always stay listed
- `itemToStringValue` sets only the submitted value; without itemToStringLabel, search matches an object item's label, else its value field, else its JSON
- Combobox parts take `render` in both twins, since both wrap `@base-ui/react`; `asChild` applies only to radix twin parts such as `DialogTrigger` and `Button`

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt)
- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 2 of 28 examples
- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started), used by 1 of 28 examples
- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start), used by 1 of 28 examples

## Examples

- [Basic](./combobox/c-combobox-1.md): A basic combobox with a list of options. Best for the minimal single pick wiring: a string array filtered by typing, with a no results message.
- [Disabled](./combobox/c-combobox-2.md): A disabled combobox. Best for a locked single field whose input and chevron are both disabled, so neither typing nor clicking opens it.
- [Invalid](./combobox/c-combobox-3.md): A combobox in an invalid state. Best for a labelled field marked invalid through aria-invalid, with a required message printed under it.
- [Clear Button](./combobox/c-combobox-4.md): A combobox with a clear button. Best for a field preset to Next.js whose X empties it, with the X standing in for the chevron while a value is set.
- [Auto-Highlight](./combobox/c-combobox-5.md): A combobox with auto-highlight enabled. Best for the first match highlighted as the user types, so Enter picks it without an arrow key press.
- [Grouped Options](./combobox/c-combobox-6.md): A combobox with grouped options. Best for timezones listed under Americas, Europe and Asia Pacific headings, with the typed search narrowing every region.
- [Group Separators](./combobox/c-combobox-7.md): A combobox with grouped options and separators. Best for the regional timezone list with a thin rule placed inside each group, under that group's last row.
- [Large List](./combobox/c-combobox-8.md): A combobox with a large list of options. Best for a long generated list of 100 entries that scrolls inside the popup and narrows as the user types.
- [Icon Addon](./combobox/c-combobox-9.md): A combobox with an icon addon. Best for a leading globe glyph inside the field, passed to the input as an InputGroupAddon child.
- [Country Picker](./combobox/c-combobox-10.md): A combobox rendered inside a popup. Best for a country picker whose outline button shows the chosen flag and name, with the search box moved inside the popup.
- [In Form](./combobox/c-combobox-11.md): A combobox used within a form. Best for a labelled required field inside a form element, read back through FormData when Submit is pressed.
- [Multi-Select](./combobox/c-combobox-12.md): A multi-select combobox. Best for chips for each chosen framework with an X on each, typed into from an input that sits after the last chip.
- [Disabled Multi-Select](./combobox/c-combobox-13.md): A disabled multi-select combobox. Best for a locked multi value field holding 2 preset chips, disabled at the root rather than on the input.
- [Invalid Multi-Select](./combobox/c-combobox-14.md): A multi-select combobox in an invalid state. Best for the multi value chip field in its error state, with aria-invalid on the chip input and a message below.
- [Non-Removable Chips](./combobox/c-combobox-15.md): A multi-select with chips that cannot be removed. Best for preset chips drawn without an X button, for picks the chip itself should not offer to dismiss.
- [Custom Items](./combobox/c-combobox-16.md): A combobox with custom item rendering. Best for a member picker whose button shows the chosen avatar, with rows listing each person's photo, name and job title.
- [In Dialog](./combobox/c-combobox-17.md): A combobox used within a dialog. Best for a framework pick placed in a modal with a hidden label and Cancel and Confirm buttons in its footer.
- [Custom Trigger Icon](./combobox/c-combobox-18.md): A combobox with a custom trigger icon. Best for a chevrons up and down glyph shown only while the field is empty, giving way to the X once a value is picked.
- [User Tags](./combobox/c-combobox-19.md): A multi-select combobox with user tags. Best for team members as rounded pill chips with a small avatar, picked from rows that show each person's position.
- [Invisible Tags](./combobox/c-combobox-20.md): Invisible combobox with member tags. Best for member pills sitting loose on the page with no field border, ring or background around them.
- [Status Change](./combobox/c-combobox-21.md): A status change combobox. Best for workflow states from Backlog to Cancelled, each with its own tinted circle glyph on the button and in the list.
- [Priority Change](./combobox/c-combobox-22.md): A priority change combobox. Best for priority levels drawn as 3 step signal bars, with Urgent shown as a yellow warning sign.
- [Lead Selection](./combobox/c-combobox-23.md): A lead selection combobox. Best for a single lead picked from a Team members group of avatar rows, marked You for the signed in user, or No lead.
- [Member Selection](./combobox/c-combobox-24.md): A multi-member selection combobox. Best for several people summarised on the button as up to 4 stacked avatars and a member count.
- [Date Selection](./combobox/c-combobox-25.md): A date selection combobox with an optional custom picker dialog. Best for date presets such as Tomorrow and End of month beside their dates, plus a Custom row opening a 2 month calendar dialog.
- [Label Selection](./combobox/c-combobox-26.md): A multi-label selection combobox with a no-label mode. Best for issue labels marked by colored dots, the button showing one label's name or up to 3 dots plus a count of the rest.
- [Team Selection](./combobox/c-combobox-27.md): A team selection combobox. Best for one owning team per record, each marked by its own tinted glyph, with a No team row to unset it.
- [Assignee Selection](./combobox/c-combobox-28.md): An assignee selection combobox. Best for a single assignee chosen from avatar rows, with No assignee on top and an Invite row in its own New user group.
