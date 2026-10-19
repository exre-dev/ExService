<!-- Generated from resources/components/toggle.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Toggle

> Open-source shadcn toggle components for formatting controls, compact actions, and binary UI states.

- Type: shadcn/ui component, free
- Page: [local reference](./toggle.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/toggle.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/toggle.md
- Examples: 14

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Toggle`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Toggle } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Toggle>) {
  return <Toggle {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI adaptation**

### Toggle selection appearance

`Toggle` and `ToggleGroupItem` keep a visible selected background after the pointer leaves, including when application utilities load above the public stylesheet. Default and outline variants support mouse and keyboard toggling. With `glass`, controls use the shared Glass state materials; disabled controls keep the default Glass material.
<!-- exui-capabilities:end:skill -->

## When to use

- Editor formatting controls that stay pressed, such as bold, italic, underline and strikethrough
- Reaction and save controls, such as like, retweet, share and bookmark, with or without a count
- Media and app controls with an on and off state, such as mute, pin to sidebar or a notifications bell

## When not to use

- A one time action such as Save, Send or Delete that keeps no pressed state: use [Button](./button.md)
- Related actions joined edge to edge into one strip, such as playback or zoom controls: use [Button Group](./button-group.md)
- A set of options read as one value and crossed with arrow keys, such as text alignment: use [Toggle Group](./toggle-group.md)

## Agent notes

- Pressed state lives inside each `Toggle` or a local `useState` and nothing saves it; read changes from `onPressedChange` to persist them
- Every `Toggle` here is named by `aria-label`, which wins over its visible text for screen readers, so update both when relabelling

## Examples

- [Basic](./toggle/c-toggle-1.md): Basic toggle.. Best for bold, italic and underline as 3 separate icon only toggles in the default variant, with bold pressed on load.
- [Outline](./toggle/c-toggle-2.md): Toggle buttons with outline variant.. Best for outline toggles that pair an icon with a text label, Italic and Bold, both off on load.
- [Text Sizes](./toggle/c-toggle-3.md): Toggle buttons in different sizes.. Best for text only outline toggles at the sm, default and lg sizes side by side, labelled Small, Default and Large.
- [Button Comparison](./toggle/c-toggle-4.md): Toggle with button and icon.. Best for an outline Button set beside an outline toggle in 2 rows, a text pair at sm and a bold icon pair, to compare them.
- [Disabled Text](./toggle/c-toggle-5.md): Disabled toggle.. Best for text only toggles locked by the disabled prop in both variants, default and outline, with no enabled control beside them.
- [Icon & Label](./toggle/c-toggle-6.md): Toggle with icon.. Best for a single outline bookmark toggle with an icon and a fixed Bookmark label, left uncontrolled.
- [Count Badge](./toggle/c-toggle-7.md): Toggle with notification count badge. Best for a bell in the default variant with a destructive count badge on its top right corner that hides while pressed.
- [Icon Sizes](./toggle/c-toggle-8.md): Toggle size variants showcase. Best for an icon only star toggle repeated at sm, default and lg, each row captioned in muted text.
- [Icon Swap](./toggle/c-toggle-9.md): Toggle with icon swap on press. Best for an icon only heart in the default variant that gains a solid fill while pressed, with no label or count.
- [Label Swap](./toggle/c-toggle-10.md): Toggle with text label that changes. Best for an outline bookmark that fills in and relabels itself from Bookmark to Bookmarked once pressed.
- [Reactions](./toggle/c-toggle-11.md): Social media reaction toggles. Best for like, retweet, share and bookmark outline toggles in a row, each count rising by 1 while pressed.
- [Tooltip](./toggle/c-toggle-12.md): Toggle with tooltip. Best for an icon only outline pin whose purpose, Pin to sidebar, appears in a tooltip on hover.
- [Disabled Icons](./toggle/c-toggle-13.md): Disabled toggle states. Best for formatting icons in 4 toggles, bold and italic enabled, underline and strikethrough disabled, each pair default then outline.
- [Mute Button](./toggle/c-toggle-14.md): Toggle as mute/unmute button. Best for a large outline speaker that swaps to a muted speaker icon and from Sound to Muted while pressed.
