<!-- Generated from resources/components/event-calendar/c-event-calendar-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Drag-to-Book

> Event calendar with drag-to-book appointments

- Type: example, free and open source (MIT)
- Component: [Event Calendar](../event-calendar.md)
- Page: [local reference](./c-event-calendar-5.md)
- Uses: Avatar, Button, Card, Event Calendar

## Best for

A consultant's day from 9:00 to 18:00 where dragging over free time books a slot and overlapping draws are refused

## Agent notes

- `bookSlot` inserts a New appointment placeholder the moment a drag ends; open your booking form or call your API there instead
- `canBook` only checks new draws, so moving or resizing an appointment onto another one is never refused
- Client photos load from `randomuser.me` URLs in `buildAppointments`; swap them for your own images or drop `AvatarImage`

## When not to use

- Appointments typed into a dialog with title, color, start and duration fields: use [Event Form Dialog](./c-event-calendar-3.md)
- Several rooms or staff shown side by side as columns of one day: use [Room Bookings](./c-event-calendar-2.md)

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
