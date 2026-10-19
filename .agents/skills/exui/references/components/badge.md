<!-- Generated from resources/components/badge.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Badge

> Open-source shadcn badge components for status labels, feature tags, and count indicators.

- Type: upstream component, free
- Page: [local reference](./badge.md)
- Examples: 25

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Badge migration in 1.0

`variant="ghost"` and `variant="link"` are no longer supported. Choose a supported variant such as `outline`, or use custom classes for a text-only treatment. `destructive` now has a solid fill; use `destructive-light` for a pale background.

### Readable status colors

ExUI Badge offers solid, light, and outline variants. Light
and semantic outline variants derive colored text and icons from their semantic
color and the current theme foreground. They do not reuse text intended for an
opaque status fill, so a pale red badge no longer receives white text. The
default blue and solid focus badges use deeper fills while retaining their
existing semantic foreground tokens. Other components' brand colors and
foregrounds are unchanged.

All 23 built-in variants are checked for at least **4.5:1 text contrast** on
standard page and card surfaces in light, dark and pitch-black, in both
densities. Size, typography, padding and radius remain variant-independent.
Icons using `currentColor` follow the label. Use the existing variants rather
than repeating a color-mixing style in each chart or status row.

`className`, `style`, `asChild` and semantic color overrides remain available.
The contrast guarantee covers built-in colors on standard surfaces; consumers
must validate custom palettes and backgrounds. Glass remains independently
opt-in, retains the shared material rules, and is checked on these standard
surfaces rather than arbitrary images.

```tsx verify
import { Badge } from '@exre/exui'

export function StatusBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success-light">Approved</Badge>
      <Badge variant="warning-light">Pending</Badge>
      <Badge variant="destructive-light">Declined</Badge>
      <Badge variant="destructive-outline">Needs attention</Badge>
      <Badge>New</Badge>
    </div>
  )
}
```

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Badge`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Badge } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Badge>) {
  return <Badge {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Status and severity labels in solid, light and outline tones for success, warning, info and errors
- Counts and short tags such as an unread number or a New marker, sized to the text around them
- Compact chips pairing a label with an icon, a dot, an avatar, a flag or a remove control, or acting as a link

## When not to use

- An action that saves, opens or submits a form when pressed: use [Button](./button.md)
- Helper text revealed when a control is hovered or focused: use [Tooltip](./tooltip.md)
- A finished KPI or profile tile with a trend or status chip as one detail: use the Card blocks

## Agent notes

- Import `Badge` from `@exre/exui`; the shadcn `Badge` of the same name lacks `size`, `radius` and the success, info and warning variants
- The default `radius` follows the style, square in lyra and sera and a pill in maia, luma and rhea; `radius` full gives a pill in every style

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin

## Examples

- [Default](./badge/c-badge-1.md): Default badge. Best for the plain call with no variant prop, filled with the theme primary and its foreground text.
- [Secondary](./badge/c-badge-2.md): Secondary badge. Best for a lower emphasis fill from the secondary token, for metadata that sits beside a primary label.
- [Destructive](./badge/c-badge-3.md): Destructive badge. Best for the loudest error state, a solid destructive fill with white text for failed or blocked records.
- [Success](./badge/c-badge-4.md): Success badge. Best for a solid success fill with white text for paid, passing or live records at full emphasis.
- [Info](./badge/c-badge-5.md): Info badge. Best for a solid info fill with white text for neutral notices such as Beta, Syncing or Preview.
- [Warning](./badge/c-badge-6.md): Warning badge. Best for a solid warning fill with white text for pending, expiring or degraded states.
- [Outline](./badge/c-badge-7.md): Outline badge. Best for a neutral border around inherited text color, transparent in light mode and lightly filled in dark.
- [Primary Outline](./badge/c-badge-8.md): Primary outline badge. Best for a neutral border with only the label text in the primary color and no tinted fill.
- [Destructive Outline](./badge/c-badge-9.md): Destructive outline badge. Best for an error flagged by destructive foreground text alone, inside a neutral border with no tint.
- [Info Outline](./badge/c-badge-10.md): Info outline badge. Best for info foreground text in a neutral outline, for notices that need no colored fill in dense tables.
- [Success Outline](./badge/c-badge-11.md): Success outline badge. Best for a low emphasis done or paid status, success foreground text set inside the neutral border.
- [Warning Outline](./badge/c-badge-12.md): Warning outline badge. Best for the quietest pending or expiring flag, warning foreground text with a neutral border and no tint.
- [Primary Light](./badge/c-badge-13.md): Primary light badge. Best for a faint primary tint with primary text and border, softer than the solid primary fill.
- [Destructive Light](./badge/c-badge-14.md): Destructive light badge. Best for a pale destructive tint behind destructive text, for errors that sit in dense rows.
- [Success Light](./badge/c-badge-15.md): Success light badge. Best for success text on a faint success tint, a soft chip for active, paid or approved.
- [Info Light](./badge/c-badge-16.md): Info light badge. Best for an info tint with info text and a matching faint border, for feature or release markers.
- [Warning Light](./badge/c-badge-17.md): Warning light badge. Best for a faint warning tint behind warning text, which keeps pending or trial states readable at small sizes.
- [Sizes](./badge/c-badge-18.md): Badge size variations. Best for the sm, default and lg sizes in one row, 18, 20 and 22px tall, to match a label to nearby text.
- [Full Radius](./badge/c-badge-19.md): Badge with full radius (radius="full"). Best for pill counts and New tags at 3 sizes, then the pill on outline, secondary and success light.
- [With Icon](./badge/c-badge-20.md): Badge with an icon. Best for an outline label led by a check glyph that the primitive sizes to 12px with no class of its own.
- [Dismiss Button](./badge/c-badge-21.md): Badge with a dismiss button. Best for an outline tag ending in an X inside a ghost icon button shrunk to 12px, for removable filters.
- [Status Dot](./badge/c-badge-22.md): Badge with a status dot. Best for a 5px round dot in the current text color ahead of the label, on an info light chip for live states.
- [As Link](./badge/c-badge-23.md): Badge rendered as a link. Best for an outline label rendered as an anchor, so the whole chip navigates and takes keyboard focus.
- [With Avatar](./badge/c-badge-24.md): Badge with avatar. Best for a person chip with a 14px avatar photo, a first name and a trailing remove X in one outline label.
- [With Flag](./badge/c-badge-25.md): Badge with flag image. Best for a country chip with an 18px flag image ahead of the name, for locale, region or shipping tags.
