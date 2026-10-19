<!-- Generated from resources/components/button.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Button

> Open-source shadcn button components for primary actions, form submissions, and toolbar controls.

- Type: shadcn/ui component, free
- Page: [local reference](./button.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/button.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/button.md
- Examples: 61

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI additions and adaptations**

### ExUI actions

ExUI `Button` uses shared tokens and has a capsule radius. ExUI's added `ActionButton` uses the same variant and size recipes but overrides the radius to `0.75rem`, giving it ordinary rounded corners. The default size reads shared density variables: `2.25rem` in standard density and `2rem` in compact density. Explicit `xs` is `1.5rem` high in both densities; `sm`, `lg` and icon sizes retain their geometry tokens. At a 16px root font size, these default heights are 36px, 32px and 24px respectively. Both offer `default`, `danger`, `destructive`, `outline`, `secondary`, `ghost` and `link` variants; `destructive` is a compatibility alias for the danger treatment. Glass is an independent opt-in and preserves the danger tone and focus state. Set `type="button"` outside form submission.

```tsx verify
import { ActionButton, Button } from '@exre/exui'

export function ActionChoices() {
  return (
    <div>
      <Button type="button">Save</Button>
      <Button type="button" variant="outline">
        Preview
      </Button>
      <Button type="button" variant="ghost">
        More
      </Button>
      <ActionButton type="button">Continue</ActionButton>
      <ActionButton type="button" variant="danger" glass>
        Delete
      </ActionButton>
    </div>
  )
}
```

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Button`, `ActionButton`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Button } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Button>) {
  return <Button {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Page, form and dialog actions in primary, secondary, outline, ghost, destructive and link weights
- Icon only controls and sign in rows, such as close, search, copy, menu or theme switches and provider logos
- Actions that report state or carry extras, such as a spinner, a saved check, a count or a shortcut

## When not to use

- Several related actions joined edge to edge as one segmented control: use [Button Group](./button-group.md)
- A control that stays pressed on or off, such as bold in an editor toolbar: use [Toggle](./toggle.md)
- An action attached inside a text field, such as a search submit or a clear: use [Input Group](./input-group.md)

## Agent notes

- The base twin `Button` defaults to `type` button, so pass `type` submit inside a form; the radix twin renders a plain `button` that submits by default
- A link needs its anchor passed through `render` with `nativeButton` false on the base twin, or wrapped with `asChild` on the radix twin
- Set `data-icon` to inline-start or inline-end on a leading or trailing icon so the text sizes trim the padding on that side

## Examples

- [Default](./button/c-button-1.md): Default button. Best for the main call to action with no variant or size prop, the base the other examples change.
- [Secondary](./button/c-button-2.md): Secondary button. Best for a lower emphasis action on the secondary fill, for the alternative beside a primary one.
- [Outline](./button/c-button-3.md): Outline button. Best for a bordered action that ranks below the filled styles, for neutral choices next to them.
- [Ghost](./button/c-button-4.md): Ghost button. Best for a borderless action with no fill until hover, for toolbars and dense rows of controls.
- [Destructive](./button/c-button-5.md): Destructive button. Best for an action in a soft destructive tint with destructive text, for delete, remove or revoke.
- [Link](./button/c-button-6.md): Link button variant. Best for an action styled as primary colored text with no fill or border, still a native button element.
- [Extra Small](./button/c-button-7.md): Extra small button. Best for the smallest text size of the scale, sized for dense rows, tags and inline controls.
- [Small](./button/c-button-8.md): Small button. Best for the text size one step below default, for compact forms, card footers and toolbars.
- [Large](./button/c-button-9.md): Large button. Best for the tallest text size of the scale, for a hero or a single main call to action on a page.
- [Disabled](./button/c-button-10.md): Disabled button. Best for a default size control labelled Button that renders enabled, since its source passes no disabled prop.
- [Icon Button](./button/c-button-11.md): Icon button. Best for a square icon only search control at the default size, named for screen readers by its aria-label.
- [Icon Right](./button/c-button-12.md): Button with an icon on the right. Best for a primary Get Started call to action with a static trailing arrow after the label.
- [Loading State](./button/c-button-13.md): Button in a loading state. Best for a fixed pending state, disabled with a spinner and Please wait, with no logic to end it.
- [Icon Left](./button/c-button-14.md): Button with an icon on the left. Best for a primary Download action led by a cloud download icon before its label.
- [Invalid State](./button/c-button-15.md): Button with an invalid state highlight. Best for the primary fill flagged with aria-invalid, for a submit tied to a form that failed validation.
- [Secondary Icon Left](./button/c-button-16.md): Secondary button with an icon on the left. Best for a secondary fill action with the GitHub logo placed before its label.
- [Secondary Icon Right](./button/c-button-17.md): Secondary button with an icon on the right. Best for a secondary Open Project action with a trailing external link icon after its label.
- [Outline Icon Left](./button/c-button-18.md): Outline button with an icon on the left. Best for an outline Add Item action led by a plus sign, for creating a new record in a list.
- [Outline Icon Right](./button/c-button-19.md): Outline button with an icon on the right. Best for an outline Options control ending in an adjustments icon, for opening settings or filters.
- [Ghost Icon Left](./button/c-button-20.md): Ghost button with an icon on the left. Best for a ghost Settings entry led by a gear, for sidebars and account menus.
- [Ghost Icon Right](./button/c-button-21.md): Ghost button with an icon on the right. Best for a ghost Logout action with a trailing sign out arrow, for the end of an account menu.
- [Destructive Icon Left](./button/c-button-22.md): Destructive button with an icon on the left. Best for a destructive Delete Account action led by a trash can icon.
- [Destructive Icon Right](./button/c-button-23.md): Destructive button with an icon on the right. Best for a destructive Confirm Removal action ending in a warning circle, for the last step of a delete.
- [Extra Small Icon](./button/c-button-24.md): Extra small icon button. Best for the smallest square size as an outline close X, for dismissing chips, tags or toasts.
- [Small Icon](./button/c-button-25.md): Small icon button. Best for a small borderless bell for a notifications entry in a dense top bar.
- [Large Icon](./button/c-button-26.md): Large (lg) icon-only button. Best for the largest square size on the primary fill with a play icon, for a media start control.
- [Next Link](./button/c-button-27.md): Button rendered as a Next.js Link. Best for a plain anchor to the site root that keeps the primary look, for navigating between pages.
- [Link Icon Left](./button/c-button-28.md): Link button with an icon on the left. Best for a link styled Help Center entry led by a question mark circle, rendered as a native button.
- [Link Icon Right](./button/c-button-29.md): Link button with an icon on the right. Best for a link styled View Documentation action whose up right arrow turns 45 degrees on hover.
- [Large Icon Left](./button/c-button-30.md): Large button with an icon on the left. Best for a large Upgrade Now call to action led by a lightning bolt, for plan upsells.
- [Large Icon Right](./button/c-button-31.md): Large button with an icon on the right. Best for a large Send Message action with a trailing paper plane, as at the foot of a contact form.
- [Outline Invalid](./button/c-button-32.md): Outline button with an invalid state. Best for an outline control marked aria-invalid, so its border turns destructive beside a failed field.
- [Ghost Invalid](./button/c-button-33.md): Ghost button with an invalid state. Best for a ghost control set to aria-invalid, which gains a destructive border and ring it otherwise lacks.
- [Email Login](./button/c-button-34.md): Button with an icon on the left. Best for a primary Login with Email action led by an envelope, for an email first sign in form.
- [More Less Toggle](./button/c-button-35.md): Ghost button with more/less toggle. Best for a ghost Show more control whose label and chevron flip between more and less on each click.
- [Outline Social Icons](./button/c-button-36.md): Social login buttons with Remix Icons. Best for a wrapping row of 6 outline icon only brand marks, Google through Instagram, from Remix Icon.
- [Like Count](./button/c-button-37.md): Outline like button with count. Best for a filled Like action with a thumbs up and a 456 count split off by a thin divider.
- [Star Count](./button/c-button-38.md): Star button with count. Best for an outline Star action with a muted 589 count after a border colored divider.
- [Unread Badge](./button/c-button-39.md): Button with an unread badge. Best for an outline Inbox entry with a destructive count badge pinned over its top right corner.
- [Shortcut Keys](./button/c-button-40.md): Button with icon, label, and shortcut keys. Best for an outline Search launcher with the Command K keys set inside it, as a command palette opener.
- [Copy Feedback](./button/c-button-41.md): Copy button with feedback. Best for an outline Copy action with a visible label that turns to Copied with a check for 1.5 seconds.
- [Icon Copy](./button/c-button-42.md): Icon-only copy button with feedback. Best for a square copy control that confirms with a check and a Copied tooltip, with no visible label.
- [Hamburger Toggle](./button/c-button-43.md): Animated hamburger / close toggle button. Best for a square menu control whose bars rotate into an X and back, with aria-expanded kept in sync.
- [Async Action](./button/c-button-44.md): Async action button with loading and success states. Best for a Save changes action that runs idle, saving and saved, then resets after 2 seconds.
- [Inline Count](./button/c-button-45.md): Outline button with inline count badge. Best for an outline Messages entry with an outlined count badge sitting inline after the label.
- [Status Dot](./button/c-button-46.md): Button with status dot badge. Best for an outline Live label with a pulsing green dot and 2 staggered ping rings at its right edge.
- [Status Badge](./button/c-button-47.md): Ghost button with a status badge. Best for a filled Updates entry with a small success colored New tag after the label.
- [Notification Badge](./button/c-button-48.md): Icon button with notification badge. Best for a square bell with a destructive count badge pinned over its corner, named by aria-label.
- [Go Back](./button/c-button-49.md): Go back link button. Best for a Go back anchor in the link style with a leading chevron, a real link and not a native button.
- [Animated Go Back](./button/c-button-50.md): Go back link button with animation. Best for the Go back link with a chevron that slides left on hover through a named hover group.
- [Expanding Button](./button/c-button-51.md): Expanding button from icon to label. Best for a round 40px plus that widens to reveal Create New on hover, like a floating action control.
- [Title & Description](./button/c-button-52.md): Multi-line button with icon, title & description. Best for a tall left aligned choice with an icon tile, a Credit Card title and a muted line of help text.
- [Sliding Arrow](./button/c-button-53.md): Sliding Icon Button (Hover reveal). Best for a pill Get Started whose arrow slides in from the right on hover as the label moves aside.
- [Shortcut Tooltip](./button/c-button-54.md): Shortcut Tooltip Button (Kbd hints). Best for a square search control whose hover tooltip names it and shows the Command K keys.
- [Avatar](./button/c-button-55.md): Button with avatar. Best for a filled account chip pairing a 20px avatar with a handle, at the default height.
- [Outline Avatar](./button/c-button-56.md): Outline button with avatar. Best for an outline account chip with a 20px avatar and handle on the page background.
- [Small Avatar](./button/c-button-57.md): Small button with avatar. Best for the filled avatar chip at the small size, for tight headers and comment rows.
- [Small Outline Avatar](./button/c-button-58.md): Small outline button with avatar. Best for the outline avatar chip at the small height, for dense lists of people.
- [Social Login Stack](./button/c-button-59.md): Social login buttons with Remix icons. Best for a stacked column of 4 outline sign in choices, each a brand colored logo, a muted Login with prefix and a provider name.
- [Colored Social Icons](./button/c-button-60.md): Social icon-only buttons with Remix icons. Best for a row of 4 equal width icon only provider marks in brand colors, each named by its aria-label.
- [Theme Toggle](./button/c-button-61.md): Theme toggle button with animated moon and sun icons. Best for a square sun and moon swap that rotates between light and dark, labelled with the next mode.
