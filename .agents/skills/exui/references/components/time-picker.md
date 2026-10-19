<!-- Generated from resources/components/time-picker.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Time Picker

> Open-source shadcn time picker components for booking forms, opening hours, and shift scheduling.

- Type: upstream component, free
- Page: [local reference](./time-picker.md)
- Examples: 13

## When to use

- Appointment, pickup and delivery slots kept on minute steps inside opening hours
- Recurring times of day in settings, such as a daily digest, a standup or a shift start
- Meeting start and end times, and a publish time set beside a chosen day

## When not to use

- A booking card with a day, a list of open slots, a duration and a confirm step: use the Schedule blocks
- A day or a range of days picked with no time of day: use [Calendar](./calendar.md)
- A whole data entry page where the time is one field among many: use the Form blocks

## Agent notes

- A `value` or `defaultValue` set in code shows as given, never snapped to the steps, `min` or `max`; only picks, typing and Now snap
- On `TimePickerTrigger`, `aria-label` replaces the shown value in the accessible name; point `aria-labelledby` at a visible label
- Inside a right to left `dir` wrapper, pass `dir` to `TimePickerContent` too, because the popover portals out of the wrapper

## Third-party libraries

- React DayPicker v9: [API reference](https://daypicker.dev/v9/api), [docs](https://daypicker.dev/v9/start), used by 1 of 13 examples

## Examples

- [Inline Panel](./time-picker/c-time-picker-1.md): Inline time panel. Best for an always open panel set flush in a Card, where each column pick commits at once with no OK step.
- [Popover](./time-picker/c-time-picker-2.md): Popover picker. Best for the bare root with no children and no state, drawing its own trigger and popover and starting empty.
- [Typable Input](./time-picker/c-time-picker-3.md): Typable time input. Best for keyboard first entry in a text field with a clock button, where typed times snap to 5 minute steps.
- [12-Hour Seconds](./time-picker/c-time-picker-4.md): 12-hour clock with seconds. Best for second level precision where the trigger reads 02:45:30 PM while the stored value stays 14:45:30.
- [Hour Only](./time-picker/c-time-picker-5.md): Hour only. Best for a small fixed width trigger at the end of a settings Item row, with only hour and AM/PM columns.
- [Opening Hours](./time-picker/c-time-picker-6.md): Steps and opening hours. Best for an empty picker whose columns open on 08:30, the first allowed time, so an hour pick lands inside the window.
- [Unavailable Slots](./time-picker/c-time-picker-7.md): Unavailable slots. Best for a lunch hour and a set of booked slots greyed out by one predicate, so hour 12 is disabled whole.
- [Start & End](./time-picker/c-time-picker-8.md): Start and end time. Best for two linked pickers where moving the start shifts the end by the same amount and earlier end slots are disabled.
- [Time Zone](./time-picker/c-time-picker-9.md): Time zone label. Best for hand composed trigger content and footer: the value, a fixed zone name and the clock, then only Clear and OK.
- [Confirm Before Apply](./time-picker/c-time-picker-10.md): Confirm before applying. Best for popover picks, Now and Clear held as a draft that closing throws away, with OK drawn as the primary button.
- [Localized](./time-picker/c-time-picker-11.md): Localized labels. Best for one stored value shown through 4 locale tabs, Chinese leading with the period and Arabic digits from a custom formatter.
- [Form Validation](./time-picker/c-time-picker-12.md): Form field with validation. Best for a native form that reads the time from FormData on submit, swaps in a FieldError when empty and clears it on Reset.
- [Date & Time](./time-picker/c-time-picker-13.md): Date and time. Best for a day and a time merged into one summary line, with 7 row columns, no footer and a Schedule button.
