<!-- Generated from resources/components/event-calendar/c-event-calendar-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn All Views

> Event calendar with all views and live settings

- Type: example, free and open source (MIT)
- Component: [Event Calendar](../event-calendar.md)
- Page: [local reference](./c-event-calendar-1.md)
- Uses: Avatar, Button, Card, Event Calendar, Label, Popover, Select, Switch, Tabs

## Best for

A feature tour whose tabbed Settings popover drives view options, time grid, drag behavior, 6 languages and 5 time zones

## Agent notes

- Drag to create is on through `selectSlot`, yet nothing handles the drawn range, so a drag over empty time only selects it
- `renderEventContent` keys its custom chips to the sample ids `design-review` and `client-call`; every other event gets the built in chip
- Right to left for `ar` comes from `dir` on the wrapper div, not from `locale` or `i18n`, so carry that attribute with the calendar

## When not to use

- A form that opens on a day or an item click to create, edit and delete: use [Event Form Dialog](./c-event-calendar-3.md)

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
