<!-- Generated from resources/components/date-selector/c-date-selector-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Language Menu

> Date selector with dropdown menu

- Type: example, free and open source (MIT)
- Component: [Date Selector](../date-selector.md)
- Page: [local reference](./c-date-selector-4.md)
- Uses: Button, Date Selector, Dialog, Dropdown Menu

## Best for

A language menu switching English, Spanish, French and German labels, date format and first weekday

## Agent notes

- `translations` hardcodes the Spanish, French and German strings; load them from your own i18n catalog
- `currentLanguage` starts as French and only the demo menu changes it; drive it from your app locale
- Pass `currentI18n` and the locale `dateFormat` to `formatDateValue` as well, or the trigger label falls back to English names and MM/dd/yyyy

## When not to use

- An app in one language with no locale switching: use [Dialog](./c-date-selector-3.md)

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
