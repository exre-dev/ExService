<!-- Generated from resources/components/event-calendar/c-event-calendar-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Custom Event Chips

> Event calendar with custom event chips

- Type: example, free and open source (MIT)
- Component: [Event Calendar](../event-calendar.md)
- Page: [local reference](./c-event-calendar-4.md)
- Uses: Button, Card, Event Calendar

## Best for

Project bars spanning several days in a Monday first month, led by a track icon, with hover tooltips and a legend

## Agent notes

- A `category` that is not a key of `CATEGORY` throws in `renderChip` and `renderTooltip`; an event with none falls back to the built in chip
- `addProject` drops a 3 day design bar and `addMilestone` a 1 day product bar starting today, both with fixed titles

## When not to use

- Bars that open a form on click to rename, retime or delete them: use [Event Form Dialog](./c-event-calendar-3.md)
- Timed meetings across week and day time grids with a view switcher: use [All Views](./c-event-calendar-1.md)

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Event Calendar

### When to use

- Team calendars in month, week, day and agenda views where events are added, edited and dragged
- Room and appointment bookings laid out as one column per resource or as a single day of open slots
- Project and campaign plans drawn as color coded bars spanning several days of a month

### When not to use

- A finished full page scheduling workspace, such as a hotel desk, shift roster or clinic: use the Event Calendar blocks
- A compact booking card where someone picks a day, then a free time slot, and confirms: use the Schedule blocks
- A plain date or date range input in a form, with no hours, events or dragging: use [Calendar](../calendar.md)

### Agent notes

- No example passes `onEventsChange`, so drags, resizes and `apiRef` edits stay in calendar state and are lost on reload
- New event ids come from a `useRef` counter that restarts at 0 on every mount, so take ids from your store once events persist
