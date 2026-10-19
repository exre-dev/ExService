<!-- Generated from resources/components/alert-dialog/c-alert-dialog-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn E-Ticket Receipt

> Confirmation for successful e-ticket registration

- Type: example, free and open source (MIT)
- Component: [Alert Dialog](../alert-dialog.md)
- Page: [local reference](./c-alert-dialog-10.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/alert-dialog.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/alert-dialog.md
- Uses: Alert Dialog, Button

## Best for

A booking receipt listing 5 order fields above one full width Back to Home button

## Agent notes

- The only button is `AlertDialogCancel` styled as primary, so Back to Home just closes the dialog

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Alert Dialog

### When to use

- Modal prompts that block the page and ask the user to answer or acknowledge
- Confirmations, permission requests and notices that a backdrop click must not close

### When not to use

- A form or settings panel that a click outside may dismiss: use [Dialog](../dialog.md)
- A status or warning shown in the page with no decision to make: use [Alert](../alert.md)
- A modal task with several fields, such as a plan cancellation survey: use the Dialog blocks

### Agent notes

- On the base twin `AlertDialogAction` is a plain `Button` that leaves the dialog open; the radix one closes it on click
- `AlertDialogTrigger` takes its button through `render` on the base twin and `asChild` on the radix twin
- `size` sm on `AlertDialogContent` sets the footer as 2 equal columns, so keep it to 2 buttons
