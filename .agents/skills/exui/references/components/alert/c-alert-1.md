<!-- Generated from resources/components/alert/c-alert-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Title & Description

> Basic alert

- Type: example, free and open source (MIT)
- Component: [Alert](../alert.md)
- Page: [local reference](./c-alert-1.md)
- Uses: Alert

## Best for

The plain default tone with just a title and a description line, no icon, color or buttons

## When not to use

- A caution the reader must act on, tinted in the warning tone with a triangle: use [Warning Variant](./c-alert-7.md)
- A confirmation that a task went through, tinted in the success tone: use [Success Variant](./c-alert-6.md)

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
