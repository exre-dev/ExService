<!-- Generated from resources/components/alert/c-alert-16.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Urgent Billing

> Urgent billing notice

- Type: example, free and open source (MIT)
- Component: [Alert](../alert.md)
- Page: [local reference](./c-alert-16.md)
- Uses: Alert, Button, Frame

## Best for

An expiring subscription notice in the destructive tint, with a credit card icon and a Renew Now button

## Agent notes

- The 3 day deadline is fixed text in `AlertDescription`; compute it from the real renewal date

## When not to use

- An expiry notice that must stop the page until the user responds: use [Alert Dialog](../alert-dialog.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Alert

### When to use

- Inline status messages in the page for success, info, warning and error outcomes
- Notices that offer a next step, such as a security update, a renewal reminder or a plan upgrade
- Status rows set inside a Frame panel, such as service health, deploy results and message notifications

### When not to use

- A yes or no decision that must be answered before the page goes on: use [Alert Dialog](../alert-dialog.md)
- A brief confirmation that floats in a corner and disappears by itself: use [Sonner](../sonner.md)
- A complete modal task, such as a plan cancellation form that holds a warning banner: use the Dialog blocks

### Agent notes

- Every `Alert` sets `role` alert, an assertive live region; pass `role` status for a notice that is not urgent
- `AlertTitle` carries a 1 line clamp by default, so copy longer than a heading goes in `AlertDescription`
- `Alert` has no open state or close part, so a Dismiss button must unmount it from state you own
