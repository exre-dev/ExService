<!-- Generated from resources/components/dialog.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Dialog

> Open-source shadcn dialog components for modal forms, focused tasks, and confirmations.

- Type: shadcn/ui component, free
- Page: [local reference](./dialog.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/dialog.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/dialog.md
- Examples: 10

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Quick composition, header actions and mobile fullscreen

Default content padding is `1rem` on every side (16px at a 16px root). Fullscreen uses the larger of this padding and each corresponding safe-area inset.

Supply `title` on `Dialog` to generate the Content/Header/Body/Footer structure. `title`, optional `description` and optional `footer` accept React nodes; children become the body. Without `title`, keep the existing explicit composition. Both forms use `open`/`onOpenChange` or `defaultOpen` and start closed by default. Quick mode uses an external trigger and restores focus to the previously focused element when closing, unless `contentProps.onCloseAutoFocus` prevents it. Non-modal dialogs retain focus on an outside target that dismisses them.

`DialogHeader.action` accepts a React button mouse handler or `{ tooltip?: string, onClick, icon?: LucideIcon }`. It renders a Ghost icon button before the title, defaults to `ArrowLeft`, and aligns with the first title line. Only the callback runs: it does not dismiss or submit. Loading, async errors and business navigation belong to the caller. The accessible name uses `actionLabel`, then `tooltip`, then `"Back"`; without tooltip text no Tooltip is rendered. Disabling the corner close button does not disable this independent action.

Action headers use a `0.125rem` column gap and a `-0.25rem` start margin on the button (2px and -4px at a 16px root). The button retains its click area, and the description stays aligned with the title. Both quick and explicit compositions share this layout.

When a header action has a Tooltip, opening autofocus starts on the named dialog surface so its hint does not appear automatically. Tab to the action or hover it to show the hint. An explicit `onOpenAutoFocus` handler that prevents the default keeps control of the initial focus.

Set `responsiveFullscreen` on `DialogContent`, or directly on a quick `Dialog`, to fill the dynamic viewport below 48 current root rem units (normally 768px). The default is `false`. Fullscreen removes the surface border and radius, accounts for safe-area insets and retains the same DOM and draft state on resize or root-font changes. Explicit inline `contentProps.style` can override the fullscreen geometry.

Use `DialogHeader`, `DialogBody` and optional `DialogFooter` as direct children of `DialogContent` for a bounded, independently scrolling body with fixed header/footer. If enlarged text or a short viewport leaves too little room for the fixed regions, outer scrolling keeps all content and actions reachable. The quick form supplies this structure automatically. A form can live inside `DialogBody`; a submit button in the separate footer can target it with its HTML `form` attribute. Custom nested content is not inspected or rearranged.

Quick mode exposes `action`, `actionLabel` and `responsiveFullscreen` directly. Use `contentProps` for the existing Content options, such as `className`, `style`, `glass`, `showCloseButton`, `closeLabel`, `closeButtonDisabled` and event handlers. Quick mode owns its host and children, so `contentProps` excludes `asChild`, `children` and the top-level fullscreen option. Blank action labels and tooltip text fall back to the next nonempty accessible name. Use the correctly spelled `footer` prop.

```tsx verify
import { useState } from 'react'
import { Button, Dialog, Input } from '@exre/exui'

export function QuickDialogExample() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit profile</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Edit profile"
        description={`Step ${step} of 2`}
        action={{ tooltip: 'Previous step', onClick: () => setStep(1) }}
        responsiveFullscreen
        contentProps={{ closeLabel: 'Close', glass: true }}
        footer={
          <>
            <Button onClick={() => setStep(2)}>Next</Button>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </>
        }
      >
        <Input aria-label="Display name" defaultValue="Alex" />
      </Dialog>
    </>
  )
}
```

The explicit composition uses the same primitives:

```tsx verify
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@exre/exui'

export function ComposedDialogExample() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open settings</Button>
      </DialogTrigger>
      <DialogContent responsiveFullscreen>
        <DialogHeader action={() => window.history.back()} actionLabel="Back">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Changes are kept in this session.</DialogDescription>
        </DialogHeader>
        <DialogBody>Settings content</DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `DialogContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { DialogContent } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof DialogContent>) {
  return <DialogContent {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Short forms and settings that need an answer before the page continues
- Long text such as terms, read in a scrolling body that can grow to nearly full screen
- Reference overlays and notices, such as a keyboard shortcuts list or a session timeout

## When not to use

- A yes or no confirmation before a destructive action: use [Alert Dialog](./alert-dialog.md)
- Long forms or record details that slide in from the screen edge: use [Sheet](./sheet.md)
- Mobile panels that open from the bottom and close with a swipe: use [Drawer](./drawer.md)

## Agent notes

- Compose the trigger through `render` on the base twin and `asChild` on the radix twin; the other one is silently ignored
- `DialogContent` renders its own close button; pass `showCloseButton` as false to drop it

## Examples

- [Basic](./dialog/c-dialog-1.md): Basic dialog. Best for a 2 field profile edit form with Cancel and Save changes in the footer.
- [Scrollable Content](./dialog/c-dialog-2.md): Dialog with scrollable content. Best for read only text in a body capped at 70vh that scrolls under the title, with no footer.
- [Sticky Footer](./dialog/c-dialog-3.md): Dialog with scrollable content and sticky footer. Best for a 70vh scrolling body above a footer whose Close button stays in view.
- [No Close Button](./dialog/c-dialog-4.md): Dialog without a close button. Best for a notice whose corner X is removed, leaving a footer Close button as the visible exit.
- [Custom Close Button](./dialog/c-dialog-5.md): Dialog with custom close button. Best for a profile form whose corner close button becomes a round bordered chip floating past the top right edge.
- [Full-Screen](./dialog/c-dialog-6.md): Full-screen fluid dialog with sticky header and footer. Best for a near full viewport modal with bordered header and footer bars around a scrolling body.
- [Destructive Confirmation](./dialog/c-dialog-7.md): Confirmation dialog with destructive action. Best for a delete prompt laid out as a dialog with a warning icon and a destructive button.
- [Cookie Consent](./dialog/c-dialog-8.md): Cookie consent dialog. Best for cookie category switches with a locked essential row and Save Preferences or Accept All actions.
- [Keyboard Shortcuts](./dialog/c-dialog-9.md): Dialog with keyboard shortcuts list. Best for a read only shortcut reference split into 2 columns of key chords in a wider modal.
- [Full Width Button](./dialog/c-dialog-10.md): Dialog with full width button. Best for a session timeout notice with one full width Sign In Again button and no Cancel.
