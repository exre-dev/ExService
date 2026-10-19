<!-- Generated from resources/components/date-selector/c-date-selector-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Basic Inline

> Basic date selector

- Type: example, free and open source (MIT)
- Component: [Date Selector](../date-selector.md)
- Page: [local reference](./c-date-selector-1.md)
- Uses: Card, Date Selector

## Best for

The whole selector laid inline in a Card with typed entry, and a JSON readout of the value under it

## Agent notes

- The `JSON.stringify` panel under the Card is a demo readout of `value`; remove it once `value` feeds your form

## When not to use

- A compact field that stays closed until a button opens it: use [Popover](./c-date-selector-2.md)

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Date Selector

### When to use

- Report and list filters on a day, month, quarter, half year or year with is, before, after or between
- Due date fields opened from a button into a popover or dialog and committed on Apply
- Localized pickers with translated months, a regional date format and a Monday first week

### When not to use

- One day or a from and to span with no period tabs or operators: use [Calendar](../calendar.md)
- A date condition sitting beside other field conditions in one query bar: use [Filters](../filters.md)
- A booking flow that pairs a day with time slots and a confirm step: use the Schedule blocks

### Agent notes

- Period lists run from `minYear` 2015 to `maxYear` 2026 by default, so pass a later `maxYear` to offer next year; `yearRange` alone changes nothing
- `onChange` runs on mount and again whenever its identity changes, so pass a stable state setter, never an inline API call
- The text field takes typed input such as 2025, Q4 or a full date only when `inputHint` is set; without it the field is read only
