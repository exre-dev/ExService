<!-- Generated from resources/components/calendar/c-calendar-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Year Select

> Year select with navigation

- Type: example, free and open source (MIT)
- Component: [Calendar](../calendar.md)
- Page: [local reference](./c-calendar-9.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/calendar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/calendar.md
- Uses: Calendar, Card, Select

## Best for

A year Select beside the month name in the caption, with the previous and next arrows kept

## Agent notes

- Years run from the July 1980 `startMonth` to the end of this year, and the next arrow stops there as well

## When not to use

- Month and year both chosen from menus, with no arrows at all: use [Month Year Select](./c-calendar-8.md)

## Third-party libraries

- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Calendar

### When to use

- Inline grids for picking one day, several separate days or a from and to range
- Date and date range fields that open the grid in a popover under a trigger button
- Booking and planning steps that pair a day with time slots, daily prices or an event list

### When not to use

- A filter over day, month, quarter or year periods with before, after and between operators: use [Date Selector](../date-selector.md)
- A ready made booking widget with host details, duration choices and a confirm step: use the Schedule blocks
- A month, week or day view of entries that users drag, resize and create: use [Event Calendar](../event-calendar.md)

### Agent notes

- `selected` takes a `Date`, a `Date` array or a `DateRange` to match `mode` single, multiple or range
- Without `required`, clicking the only selected day clears it, so `onSelect` can hand back `undefined` or an empty array
