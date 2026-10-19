<!-- Generated from resources/components/calendar.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Calendar

> Open-source shadcn calendar components for date picking, scheduling flows, and booking interfaces.

- Type: shadcn/ui component, free
- Page: [local reference](./calendar.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/calendar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/calendar.md
- Examples: 30

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Calendar selection shape

Single and multiple selected dates stay circular at the first and last weekday columns, including layouts with week numbers. A date range keeps round endpoints and a connected middle band. ExUI provides these edge shapes by default; use the ordinary `Calendar` selection props without per-column radius overrides.
<!-- exui-capabilities:end:skill -->

## When to use

- Inline grids for picking one day, several separate days or a from and to range
- Date and date range fields that open the grid in a popover under a trigger button
- Booking and planning steps that pair a day with time slots, daily prices or an event list

## When not to use

- A filter over day, month, quarter or year periods with before, after and between operators: use [Date Selector](./date-selector.md)
- A ready made booking widget with host details, duration choices and a confirm step: use the Schedule blocks
- A month, week or day view of entries that users drag, resize and create: use [Event Calendar](./event-calendar.md)

## Agent notes

- `selected` takes a `Date`, a `Date` array or a `DateRange` to match `mode` single, multiple or range
- Without `required`, clicking the only selected day clears it, so `onSelect` can hand back `undefined` or an empty array

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)
- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start)
- little-date v1: [API reference](https://github.com/vercel/little-date#advanced-options), [docs](https://github.com/vercel/little-date), used by 1 of 30 examples

## Examples

- [Basic](./calendar/c-calendar-1.md): Basic calendar. Best for the minimal single day picker in a Card, with today selected on first render.
- [Range](./calendar/c-calendar-2.md): Range calendar. Best for a from and to span in one month, seeded as today through 5 days later.
- [Disabled Dates](./calendar/c-calendar-3.md): Disabled dates. Best for range picking that blocks past days, today, weekends and 2 spans, restarting any range that crosses one.
- [Multiple Days](./calendar/c-calendar-4.md): Multiple day selection. Best for separate days toggled on and off one by one, seeded with 4 dates around today.
- [Circular Days](./calendar/c-calendar-5.md): Custom select day style. Best for fully round day buttons for a single pick, forced with one classNames override on the day button.
- [Circular Range](./calendar/c-calendar-6.md): Custom select range style. Best for a from and to span with every day button forced round, the range counterpart of the circular single pick.
- [Right Navigation](./calendar/c-calendar-7.md): Right navigation. Best for the month title moved to the left edge with both arrows grouped on the right, through classNames.
- [Month Year Select](./calendar/c-calendar-8.md): Month and year selection. Best for far past days reached through month and year Select menus that replace the arrows, from July 1980 on.
- [Year Select](./calendar/c-calendar-9.md): Year select with navigation. Best for a year Select beside the month name in the caption, with the previous and next arrows kept.
- [Week Numbers](./calendar/c-calendar-10.md): Display week numbers. Best for week numbers in a leading column through a custom WeekNumber cell, with 6 rows in every month.
- [Current Month Button](./calendar/c-calendar-11.md): Current month button. Best for an outline button under the grid that brings the view back to this month without changing the pick.
- [Today Button](./calendar/c-calendar-12.md): Today button. Best for a reset button that selects today and jumps to it, with the grid opening 4 weeks back.
- [Year View](./calendar/c-calendar-13.md): Custom navigation with year view. Best for a caption button that swaps the grid for a year list, then a month list, spanning 10 years either side of today.
- [Time Slots](./calendar/c-calendar-14.md): Preset time selection. Best for half hour slots from 09:00 to 17:30 in a scrolling column beside the grid, with taken slots and past days disabled.
- [Date Presets](./calendar/c-calendar-15.md): Calendar with presets. Best for a rail of Today, Yesterday, Last week, Last month and Last year shortcuts for one past day, with future days blocked.
- [Range Presets](./calendar/c-calendar-16.md): Range calendar with presets. Best for range presets such as Last 7 days, Month to date and Last year that set both ends and jump the view there.
- [Pricing](./calendar/c-calendar-17.md): Calendar with pricing. Best for a price under every day from a seeded formula, green below $100, with large cells and no outside days.
- [Forward Presets](./calendar/c-calendar-18.md): Calendar with presets. Best for forward shortcuts Today, Tomorrow, 3 days, Week and 2 weeks as a footer button row in a compact card.
- [Appointment](./calendar/c-calendar-19.md): Appointment calendar. Best for a titled booking card with 15 minute slots from 09:00 to 18:00, today and 2 more days taken, and a summary line by Confirm.
- [Two Months](./calendar/c-calendar-20.md): Display 2 months. Best for a single day pick across 2 months shown side by side, stacking into one column below md.
- [Two Month Range](./calendar/c-calendar-21.md): Display 2 months with range picker. Best for a range across 2 side by side months, preset from the 6th to the 18th of this month.
- [Event List](./calendar/c-calendar-22.md): Calendar with event list. Best for a compact card listing events under the grid with colored bars, time spans and an Add Event button.
- [Localized](./calendar/c-calendar-23.md): Localize calendar. Best for a language Select in the header that switches day names, month titles and the heading between English and Chinese.
- [Date Picker](./calendar/c-calendar-24.md): Calendar with date picker. Best for an outline trigger reading Pick a date that opens one month in a popover and then shows the long formatted day.
- [Date Range Picker](./calendar/c-calendar-25.md): Calendar with date range picker. Best for a trigger reading Pick a date range that opens 2 months in a popover and prints both ends once chosen.
- [Picker Year View](./calendar/c-calendar-26.md): Calendar with date picker and year view. Best for the year then month drill down from the caption, inside a popover opened from a field.
- [Picker Time Slots](./calendar/c-calendar-27.md): Calendar with date and appointment picker. Best for the half hour slot column inside a popover opened from a field, with past days blocked.
- [Picker Presets](./calendar/c-calendar-28.md): Calendar with date picker and presets. Best for past day shortcuts from Today to Last year in a rail inside a popover opened from a field.
- [Range Picker Presets](./calendar/c-calendar-29.md): Range calendar with date picker and presets. Best for the 8 shortcut span rail inside a popover, its trigger printing the chosen span and starting on the last 7 days.
- [Date Time Range](./calendar/c-calendar-30.md): Calendar with date and time range picker. Best for start and End Time inputs with seconds under the grid in a popover, starting on the 12th of this month.
