<!-- Generated from resources/components/event-calendar/c-event-calendar-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Room Bookings

> Event calendar with resource view for room bookings

- Type: example, free and open source (MIT)
- Component: [Event Calendar](../event-calendar.md)
- Page: [local reference](./c-event-calendar-2.md)
- Uses: Button, Card, Event Calendar

## Best for

Hotel rooms as columns from 8:00 to 20:00, holding stays, check-outs and housekeeping colored by a status legend

## Agent notes

- Chip colors are copied from `STATUS` into each booking's `color` when built, so changing `status` later also needs a new `color`
- `addBooking` always books noon to 1 PM in room `r101` with no overlap check, so repeated clicks double book that hour

## When not to use

- Bookings made by dragging across free time, with double booking refused: use [Drag-to-Book](./c-event-calendar-5.md)
- Bookings typed into a form that also edits or deletes the one you click: use [Event Form Dialog](./c-event-calendar-3.md)

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
