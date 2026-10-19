<!-- Generated from resources/components/alert.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Alert

> Open-source shadcn alert components for status messages, warning banners, and destructive notices.

- Type: upstream component, free
- Page: [local reference](./alert.md)
- Examples: 20

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Alert`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Alert } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Alert>) {
  return <Alert {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Inline status messages in the page for success, info, warning and error outcomes
- Notices that offer a next step, such as a security update, a renewal reminder or a plan upgrade
- Status rows set inside a Frame panel, such as service health, deploy results and message notifications

## When not to use

- A yes or no decision that must be answered before the page goes on: use [Alert Dialog](./alert-dialog.md)
- A brief confirmation that floats in a corner and disappears by itself: use [Sonner](./sonner.md)
- A complete modal task, such as a plan cancellation form that holds a warning banner: use the Dialog blocks

## Agent notes

- Every `Alert` sets `role` alert, an assertive live region; pass `role` status for a notice that is not urgent
- `AlertTitle` carries a 1 line clamp by default, so copy longer than a heading goes in `AlertDescription`
- `Alert` has no open state or close part, so a Dismiss button must unmount it from state you own

## Examples

- [Title & Description](./alert/c-alert-1.md): Basic alert. Best for the plain default tone with just a title and a description line, no icon, color or buttons.
- [Leading Icon](./alert/c-alert-2.md): Alert with icon. Best for a check mark in the leading column of a neutral card toned notice, with no color or actions.
- [Icon & Actions](./alert/c-alert-3.md): Alert with icon and action buttons. Best for the full row: shield icon, title, description and an outline Dismiss beside a solid Update button.
- [Payment Failure](./alert/c-alert-4.md): Destructive alert with icon and action buttons. Best for a destructive payment failure whose description holds a bulleted checklist of details to fix.
- [Info Variant](./alert/c-alert-5.md): Info alert with icon and action buttons. Best for the info variant with a tinted border, fill and circle icon for a notice worth reading closely.
- [Success Variant](./alert/c-alert-6.md): Success alert. Best for the success variant with a check icon, confirming everything works and the user can carry on.
- [Warning Variant](./alert/c-alert-7.md): Warning alert. Best for the warning variant with a triangle icon, pointing the user to settings or support.
- [Error Variant](./alert/c-alert-8.md): Error alert. Best for the destructive variant for a failed action, asking the user to try again or contact support.
- [Invert Variant](./alert/c-alert-9.md): Invert alert. Best for the invert variant: a dark solid bar with light text and a success colored icon for contrast.
- [Title & Actions](./alert/c-alert-10.md): Alert with icon and action buttons. Best for a single title line paired with Dismiss and Update, leaving the description out entirely.
- [Description & Actions](./alert/c-alert-11.md): Alert with description and action buttons. Best for muted body copy beside Dismiss and Update with no title above it, for one sentence prompts.
- [Frame Reset Borders](./alert/c-alert-12.md): Alert integrated within a Frame with reset borders. Best for a system update notice filling a Frame panel edge to edge, with a destructive tinted info icon and no actions.
- [Stacked in Frame](./alert/c-alert-13.md): Stacked alerts within a Frame. Best for a stacked Frame pair: a deploy success above a resource limit warning with a Verify button.
- [Frame With Actions](./alert/c-alert-14.md): Alert with actions integrated within a Frame. Best for a borderless default notice in a Frame panel with an emerald shield, a longer security message and 2 buttons.
- [Pro Upsell](./alert/c-alert-15.md): Inverted alert variant. Best for a Pro upsell on the dark invert variant, with a yellow bolt and a blue Upgrade button beside Dismiss.
- [Urgent Billing](./alert/c-alert-16.md): Urgent billing notice. Best for an expiring subscription notice in the destructive tint, with a credit card icon and a Renew Now button.
- [Service Status](./alert/c-alert-17.md): Service status summary stacked within a frame. Best for a 2 row service health summary, a connected database over an API latency warning with Retry, on clear fills.
- [Feature Discovery](./alert/c-alert-18.md): Feature discovery alert. Best for a feature announcement on the info tint, with an icon only close button and an Explore features link below the copy.
- [Direct Message](./alert/c-alert-19.md): User message notification alert. Best for a direct message notice with the sender's avatar, a one line quoted preview and View and Reply buttons.
- [Comment Mention](./alert/c-alert-20.md): User message notification alert. Best for a comment mention on the dark invert surface, with avatar, dimmed action text and a blue View button.
