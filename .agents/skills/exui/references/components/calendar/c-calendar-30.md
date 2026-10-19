<!-- Generated from resources/components/calendar/c-calendar-30.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Date Time Range

> Calendar with date and time range picker

- Type: example, free and open source (MIT)
- Component: [Calendar](../calendar.md)
- Page: [local reference](./c-calendar-30.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/calendar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/calendar.md
- Uses: Button, Calendar, Field, Input Group, Popover, Separator

## Best for

Start and End Time inputs with seconds under the grid in a popover, starting on the 12th of this month

## Agent notes

- The Start and End Time inputs are uncontrolled through `defaultValue`, and the trigger label shows only `date`
- The input ids `time-from` and `time-to` are fixed strings, so 2 pickers on one page share them

## When not to use

- Hours, minutes and AM or PM picked from columns with min and max bounds: use [Time Picker](../time-picker.md)

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
