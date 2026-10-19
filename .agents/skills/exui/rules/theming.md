# Theming, density and size

ExUI selects `radix-luma` in its package source. This is already compiled into the package; changing the consuming application's shadcn style does not restyle it.

## Component-owned geometry

Read the installed component's `size`, `variant` and composition API. Use those knobs before changing height, padding, radius or shadow. Luma Card is pill-rounded with its own `shadow-md`; recipe-based inputs and buttons use ExUI variables. Do not assume one radius or shadow variable controls every component.

Use classes for placement, width, responsive layout and gaps. Keep slot padding and focus styling with the primitive. A custom surface should use the documented Tokens rather than copied Luma pixel measurements.

In clipped scroll or collapsible regions, verify the complete keyboard focus ring on the first and last items. An inset ring keeps that indicator inside each item's visible bounds while preserving container clipping and animations.

## Themes

Read [theme usage](../references/exui/theme-usage.md) for light/dark/system provider behavior, browser-only provider mounting and Pitch Black's CSS-class boundary. One theme driver owns root classes. Portals inherit from their actual DOM container.

For a compact settings toolbar, compose `SelectField`, `SelectTrigger size="sm"`, `SelectValue`, `SelectContent` and `SelectItem` from the public package. Put `aria-label` on the trigger. Scope any transparent trigger background to that toolbar; keep the popup surface and focus styling readable. Verify the rendered height: the current trigger uses `--density-control-height` even when `size="sm"` is set, so an app that needs a fixed small size must scope its height or density variables locally.

## Scale and density

Read [scaling](../references/exui/scaling.md) before embedding ExUI in a scaled host. Root font size drives rem dimensions; avoid global `transform: scale()` or `zoom` for application sizing.

`.density-compact` changes the five `--density-*` values consumed by default Button, Input, Textarea, Select, NativeSelect and InputGroup controls. Explicit sizes and complex widget geometry are not guaranteed to follow this class. Use a documented `size="sm"` for widgets that support it, and verify dense forms and overlay contents at the actual root scale.

## Effects

[Glass](../references/exui/glass.md) is an independent material on supported surfaces. [Shadows](../references/exui/shadows.md) distinguishes foundation shadows, themed elevation, recipe shadows and Luma utilities. [Token customization](../references/exui/token-customization.md) is the shared override contract.
