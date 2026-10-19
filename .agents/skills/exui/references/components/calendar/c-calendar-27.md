<!-- Generated from resources/components/calendar/c-calendar-27.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Picker Time Slots

> Calendar with date and appointment picker

- Type: example, free and open source (MIT)
- Component: [Calendar](../calendar.md)
- Page: [local reference](./c-calendar-27.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/calendar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/calendar.md
- Uses: Button, Calendar, Card, Popover, Scroll Area

## Best for

The half hour slot column inside a popover opened from a field, with past days blocked

## Agent notes

- The trigger prints only `date`; the slot held in `time` is highlighted in the column but never shown on the trigger or returned
- `timeSlots` is mock data, the same list for every day the user picks

## When not to use

- Slot picking that stays open on the page rather than in a popover: use [Time Slots](./c-calendar-14.md)

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)
- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start), through shadcn Calendar

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
