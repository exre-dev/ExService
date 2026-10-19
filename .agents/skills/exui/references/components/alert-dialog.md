<!-- Generated from resources/components/alert-dialog.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Alert Dialog

> Open-source shadcn alert dialog components for delete confirmations, destructive actions, and critical decisions.

- Type: shadcn/ui component, free
- Page: [local reference](./alert-dialog.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/alert-dialog.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/alert-dialog.md
- Examples: 14

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Compact component padding

ExUI uses `1rem` padding (16px at a 16px root) for default Card insets, all sides of `AlertDialogContent`, `SheetHeader` and `SheetFooter`, vertical padding in `CommandEmpty` and DataGrid empty-table/filter messages, all sides of Gantt's no-resource message, and bottom padding between vertical `TimelineItem` entries. Empty-state padding appears only when that state is rendered; Timeline's last item has no added bottom padding. Caller classes can override these defaults.

Card's default and `sm` sizes both use `1rem` insets. `--card-spacing` controls those insets; `--card-gap` controls the separate section gap, which remains `1.5rem` by default and `1rem` for `sm`. Header bottom and Footer top insets appear when the corresponding border is added; a leading image still removes the Card's top inset.

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `AlertDialogContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { AlertDialogContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof AlertDialogContent>) {
  return <AlertDialogContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Modal prompts that block the page and ask the user to answer or acknowledge
- Confirmations, permission requests and notices that a backdrop click must not close

## When not to use

- A form or settings panel that a click outside may dismiss: use [Dialog](./dialog.md)
- A status or warning shown in the page with no decision to make: use [Alert](./alert.md)
- A modal task with several fields, such as a plan cancellation survey: use the Dialog blocks

## Agent notes

- On the base twin `AlertDialogAction` is a plain `Button` that leaves the dialog open; the radix one closes it on click
- `AlertDialogTrigger` takes its button through `render` on the base twin and `asChild` on the radix twin
- `size` sm on `AlertDialogContent` sets the footer as 2 equal columns, so keep it to 2 buttons

## Examples

- [Basic](./alert-dialog/c-alert-dialog-1.md): Basic alert dialog with title, description, and action buttons. Best for a plain text confirmation with centered title and copy above Cancel and Continue.
- [Small Size](./alert-dialog/c-alert-dialog-2.md): Small size alert dialog for quick confirmations. Best for a compact permission prompt in the small size, its 2 buttons sharing the footer width.
- [With Icon](./alert-dialog/c-alert-dialog-3.md): Alert dialog with icon. Best for a default size prompt with an icon tile above the title, here pairing a Bluetooth device.
- [Small With Icon](./alert-dialog/c-alert-dialog-4.md): Small size alert dialog with media (icon). Best for the small size with an icon tile, for a quick yes or no question about an accessory.
- [Destructive Delete](./alert-dialog/c-alert-dialog-5.md): Destructive alert dialog for irreversible actions like deletion. Best for an irreversible delete with a red trash icon, a destructive button and a link in the copy.
- [Nested In Dialog](./alert-dialog/c-alert-dialog-6.md): Alert dialog nested within a standard Dialog component. Best for a confirmation launched from a button inside an open Dialog, stacked above it.
- [Success Notice](./alert-dialog/c-alert-dialog-7.md): Task success confirmation. Best for a success notice with a green check and a do not show again checkbox beside the buttons.
- [Account Deactivation](./alert-dialog/c-alert-dialog-8.md): Account deactivation confirmation. Best for an account deactivation warning with the icon left of the title and a destructive confirm.
- [Unsaved Changes](./alert-dialog/c-alert-dialog-9.md): Warning for unsaved changes when navigating away. Best for an unsaved changes guard inside a Frame panel, with Stay, Discard and a do not ask again box.
- [E-Ticket Receipt](./alert-dialog/c-alert-dialog-10.md): Confirmation for successful e-ticket registration. Best for a booking receipt listing 5 order fields above one full width Back to Home button.
- [System Update](./alert-dialog/c-alert-dialog-11.md): System update notification requiring application restart. Best for an update prompt with a release version badge and a tinted lower band holding copy and buttons.
- [Billing Warning](./alert-dialog/c-alert-dialog-12.md): Billing warning for expired subscriptions or failed payments. Best for a plan expiry warning with a red bell, an expires in 2 days badge and an Update Payment action.
- [Logout Confirmation](./alert-dialog/c-alert-dialog-13.md): Logout confirmation dialog. Best for a sign out check whose No and Yes buttons split the footer into 2 flush cells with a divider.
- [Security Audit](./alert-dialog/c-alert-dialog-14.md): Advanced security audit confirmation. Best for a summary of 3 security checks with Pending or Done badges above stacked full width buttons.
