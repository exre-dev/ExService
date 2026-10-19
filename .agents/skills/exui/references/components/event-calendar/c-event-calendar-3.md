<!-- Generated from resources/components/event-calendar/c-event-calendar-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Event Form Dialog

> Event calendar with create and edit dialog

- Type: example, free and open source (MIT)
- Component: [Event Calendar](../event-calendar.md)
- Page: [local reference](./c-event-calendar-3.md)
- Uses: Button, Card, Dialog, Event Calendar, Field, Input, Select, Switch

## Best for

A single form dialog that opens blank on an empty day or the toolbar, and edits or deletes whatever you click

## Agent notes

- `openCreate` keeps only the day of a clicked slot and `seedCreate` starts every draft at 9:00, even after a 2 PM click in week view
- `openEdit` reads only `getHours` of the start, so saving an item dragged to 9:15 moves it back to 9:00

## When not to use

- New bookings drawn by dragging across empty time rather than typed into a form: use [Drag-to-Book](./c-event-calendar-5.md)

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
