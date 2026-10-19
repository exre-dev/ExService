<!-- Generated from resources/components/toggle-group/c-toggle-group-13.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Notification Channels

> Toggle group for notification channels

- Type: example, free and open source (MIT)
- Component: [Toggle Group](../toggle-group.md)
- Page: [local reference](./c-toggle-group-13.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/toggle-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/toggle-group.md
- Uses: Toggle Group

## Best for

Email, SMS, Push and Slack with an icon and label each, any mix on together, Email and Push on at load

## When not to use

- Channels ticked inside a form and posted along with its other fields: use [Checkbox](../checkbox.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Toggle Group

### When to use

- Editor formatting and alignment controls kept as one set, such as bold, italic, underline or justify
- View, column layout and theme switchers where the pressed item holds the current choice
- Short option rows for a time range, status, sort order, billing period, channels or device settings

### When not to use

- Related actions such as export, zoom or playback joined in one strip with no pressed state: use [Button Group](../button-group.md)
- A single on or off control such as bookmark or mute that stands on its own: use [Toggle](../toggle.md)
- Labelled settings in a list, each flipped on or off beside its own text: use [Switch](../switch.md)

### Agent notes

- The base twin picks one item unless `multiple` is set and always takes an array `defaultValue`; the radix twin needs `type` single or multiple
- No example passes `value` to `ToggleGroup` or reads a change back, so the pick stays inside the group; control it to act on the choice
- A second click on a pressed `ToggleGroupItem` releases it in both twins, so even a single choice group can end with nothing picked
