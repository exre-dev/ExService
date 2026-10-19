<!-- Generated from resources/components/time-picker/c-time-picker-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Inline Panel

> Inline time panel

- Type: example, free and open source (MIT)
- Component: [Time Picker](../time-picker.md)
- Page: [local reference](./c-time-picker-1.md)
- Uses: Card, Time Picker

## Best for

An always open panel set flush in a Card, where each column pick commits at once with no OK step

## Agent notes

- Replace the 14:30 preset `value` in `useState` with the stored meeting time, or `null` for none

## When not to use

- A day and an hour chosen together in one card: use [Date & Time](./c-time-picker-13.md)

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
