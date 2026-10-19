<!-- Generated from resources/components/event-calendar.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Event Calendar

> Open-source shadcn event calendar components with month, week, day and agenda views, and drag-and-drop scheduling.

- Type: upstream component, free
- Page: [local reference](./event-calendar.md)
- Examples: 5

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.

**ExUI adaptation**

### Root export collision aliases

The public root resolves name collisions between component modules with `Reui`-prefixed names. Import those exact names from `@exre/exui`; do not assume the original module-local name is also exported.

Read [Root export collision aliases](../exui/setup.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Team calendars in month, week, day and agenda views where events are added, edited and dragged
- Room and appointment bookings laid out as one column per resource or as a single day of open slots
- Project and campaign plans drawn as color coded bars spanning several days of a month

## When not to use

- A finished full page scheduling workspace, such as a hotel desk, shift roster or clinic: use the Event Calendar blocks
- A compact booking card where someone picks a day, then a free time slot, and confirms: use the Schedule blocks
- A plain date or date range input in a form, with no hours, events or dragging: use [Calendar](./calendar.md)

## Agent notes

- No example passes `onEventsChange`, so drags, resizes and `apiRef` edits stay in calendar state and are lost on reload
- New event ids come from a `useRef` counter that restarts at 0 on every mount, so take ids from your store once events persist

## Third-party libraries

- date-fns v4: [docs](https://date-fns.org/v4.1.0/docs/Getting-Started)
- date-fns time zones v1: [API reference](https://github.com/date-fns/date-fns/tree/main/pkgs/tz#api), [docs](https://github.com/date-fns/date-fns/tree/main/pkgs/tz)
- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin

## Examples

- [All Views](./event-calendar/c-event-calendar-1.md): Event calendar with all views and live settings. Best for a feature tour whose tabbed Settings popover drives view options, time grid, drag behavior, 6 languages and 5 time zones.
- [Room Bookings](./event-calendar/c-event-calendar-2.md): Event calendar with resource view for room bookings. Best for hotel rooms as columns from 8:00 to 20:00, holding stays, check-outs and housekeeping colored by a status legend.
- [Event Form Dialog](./event-calendar/c-event-calendar-3.md): Event calendar with create and edit dialog. Best for a single form dialog that opens blank on an empty day or the toolbar, and edits or deletes whatever you click.
- [Custom Event Chips](./event-calendar/c-event-calendar-4.md): Event calendar with custom event chips. Best for project bars spanning several days in a Monday first month, led by a track icon, with hover tooltips and a legend.
- [Drag-to-Book](./event-calendar/c-event-calendar-5.md): Event calendar with drag-to-book appointments. Best for a consultant's day from 9:00 to 18:00 where dragging over free time books a slot and overlapping draws are refused.
