<!-- Generated from resources/components/toggle-group.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Toggle Group

> Open-source shadcn toggle group components for view switches, toolbar options, and mutually exclusive actions.

- Type: shadcn/ui component, free
- Page: [local reference](./toggle-group.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/toggle-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/toggle-group.md
- Examples: 16

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `ToggleGroupItem`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { ToggleGroupItem } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof ToggleGroupItem>) {
  return <ToggleGroupItem {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI adaptation**

### Toggle selection appearance

`Toggle` and `ToggleGroupItem` keep a visible selected background after the pointer leaves, including when application utilities load above the public stylesheet. Default and outline variants support mouse and keyboard toggling. With `glass`, controls use the shared Glass state materials; disabled controls keep the default Glass material.
<!-- exui-capabilities:end:skill -->

## When to use

- Editor formatting and alignment controls kept as one set, such as bold, italic, underline or justify
- View, column layout and theme switchers where the pressed item holds the current choice
- Short option rows for a time range, status, sort order, billing period, channels or device settings

## When not to use

- Related actions such as export, zoom or playback joined in one strip with no pressed state: use [Button Group](./button-group.md)
- A single on or off control such as bookmark or mute that stands on its own: use [Toggle](./toggle.md)
- Labelled settings in a list, each flipped on or off beside its own text: use [Switch](./switch.md)

## Agent notes

- The base twin picks one item unless `multiple` is set and always takes an array `defaultValue`; the radix twin needs `type` single or multiple
- No example passes `value` to `ToggleGroup` or reads a change back, so the pick stays inside the group; control it to act on the choice
- A second click on a pressed `ToggleGroupItem` releases it in both twins, so even a single choice group can end with nothing picked

## Examples

- [Basic](./toggle-group/c-toggle-group-1.md): Basic toggle group.. Best for bold, italic and underline as borderless icon buttons that can all be on at once, none pressed at load.
- [Outline](./toggle-group/c-toggle-group-2.md): Toggle group with outline variant.. Best for an outline pair of text options, All and Missed, with All picked and only one on at a time.
- [Sizes](./toggle-group/c-toggle-group-3.md): Toggle groups in different sizes.. Best for the sm and default heights stacked to compare, each an outline Top and Bottom pair with Top picked.
- [Custom Spacing](./toggle-group/c-toggle-group-4.md): Toggle group with custom spacing.. Best for day, Week and Month as separate outline items with Week picked on load.
- [Filter Control](./toggle-group/c-toggle-group-5.md): Toggle group with filter control.. Best for small outline items for 4 statuses, All, Active, Completed and Archived, with Active picked.
- [Vertical](./toggle-group/c-toggle-group-6.md): Toggle group with vertical orientation.. Best for bold, italic and underline stacked in an outlined column, icon only, with any mix on together.
- [Text Alignment](./toggle-group/c-toggle-group-7.md): Toggle group for text alignment. Best for left, center, right and justify as borderless icon buttons where one alignment is on, left at load.
- [View Mode](./toggle-group/c-toggle-group-8.md): Toggle group for view mode switching. Best for icon only outline choice of list, grid or kanban layout, with list picked and an aria label on each.
- [Vertical Settings](./toggle-group/c-toggle-group-9.md): Vertical toggle group for settings. Best for a borderless column of Wi-Fi, Bluetooth, Airplane Mode and Location with icon and label, any mix on, 2 at load.
- [Color Theme](./toggle-group/c-toggle-group-10.md): Toggle group for color theme. Best for light, Dark and System choices with an icon and label each in outline, Light picked on load.
- [Font Size](./toggle-group/c-toggle-group-11.md): Toggle group for font size. Best for small outline items lettered S, M, L and XL for a short size scale, with M picked on load.
- [Time Range](./toggle-group/c-toggle-group-12.md): Toggle group for time range filter. Best for small outline presets 1H, 6H, 24H, 7D, 30D and All in one row, with 24H picked on load.
- [Notification Channels](./toggle-group/c-toggle-group-13.md): Toggle group for notification channels. Best for email, SMS, Push and Slack with an icon and label each, any mix on together, Email and Push on at load.
- [Layout Columns](./toggle-group/c-toggle-group-14.md): Toggle group for layout columns. Best for icon only outline picks for 1, 2, 3 or 4 columns, each named by its count, with 2 set at load.
- [Sort Direction](./toggle-group/c-toggle-group-15.md): Toggle group for sort direction. Best for a small outline pair, Ascending and Descending, each led by an up or down arrow, Ascending on at load.
- [Pricing Tier](./toggle-group/c-toggle-group-16.md): Toggle group for pricing tier. Best for a large outline Monthly and Yearly pair, the Yearly item carrying a filled Save 20% pill.
