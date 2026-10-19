<!-- Generated from resources/components/time-picker/c-time-picker-8.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Start & End

> Start and end time

- Type: example, free and open source (MIT)
- Component: [Time Picker](../time-picker.md)
- Page: [local reference](./c-time-picker-8.md)
- Uses: Field, Time Picker

## Best for

Two linked pickers where moving the start shifts the end by the same amount and earlier end slots are disabled

## Agent notes

- `start` and `end` are local state seeded with 09:00 and 10:00; lift them into your form to save the range
- Ranges never cross midnight: the start stops at 23:30 and `LATEST_END` holds the end at 23:45

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Time Picker

### When to use

- Appointment, pickup and delivery slots kept on minute steps inside opening hours
- Recurring times of day in settings, such as a daily digest, a standup or a shift start
- Meeting start and end times, and a publish time set beside a chosen day

### When not to use

- A booking card with a day, a list of open slots, a duration and a confirm step: use the Schedule blocks
- A day or a range of days picked with no time of day: use [Calendar](../calendar.md)
- A whole data entry page where the time is one field among many: use the Form blocks

### Agent notes

- A `value` or `defaultValue` set in code shows as given, never snapped to the steps, `min` or `max`; only picks, typing and Now snap
- On `TimePickerTrigger`, `aria-label` replaces the shown value in the accessible name; point `aria-labelledby` at a visible label
- Inside a right to left `dir` wrapper, pass `dir` to `TimePickerContent` too, because the popover portals out of the wrapper
