<!-- Generated from resources/components/date-selector.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Date Selector

> Open-source shadcn date selector components for date range picking, booking windows, and calendar filters.

- Type: upstream component, free
- Page: [local reference](./date-selector.md)
- Examples: 4

## When to use

- Report and list filters on a day, month, quarter, half year or year with is, before, after or between
- Due date fields opened from a button into a popover or dialog and committed on Apply
- Localized pickers with translated months, a regional date format and a Monday first week

## When not to use

- One day or a from and to span with no period tabs or operators: use [Calendar](./calendar.md)
- A date condition sitting beside other field conditions in one query bar: use [Filters](./filters.md)
- A booking flow that pairs a day with time slots and a confirm step: use the Schedule blocks

## Agent notes

- Period lists run from `minYear` 2015 to `maxYear` 2026 by default, so pass a later `maxYear` to offer next year; `yearRange` alone changes nothing
- `onChange` runs on mount and again whenever its identity changes, so pass a stable state setter, never an inline API call
- The text field takes typed input such as 2025, Q4 or a full date only when `inputHint` is set; without it the field is read only

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)
- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start)

## Examples

- [Basic Inline](./date-selector/c-date-selector-1.md): Basic date selector. Best for the whole selector laid inline in a Card with typed entry, and a JSON readout of the value under it.
- [Popover](./date-selector/c-date-selector-2.md): Date selector with popover. Best for a popover anchored under an outline trigger, with typed shortcuts and Apply and Cancel below the selector.
- [Dialog](./date-selector/c-date-selector-3.md): Date selector with dialog. Best for a modal titled Select Due Date with a read only field, closing on Cancel or committing on Apply.
- [Language Menu](./date-selector/c-date-selector-4.md): Date selector with dropdown menu. Best for a language menu switching English, Spanish, French and German labels, date format and first weekday.
