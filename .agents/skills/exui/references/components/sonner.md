<!-- Generated from resources/components/sonner.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sonner

> Open-source shadcn Sonner toast components for success feedback, error states, and non-blocking updates.

- Type: shadcn/ui component, free
- Page: [local reference](./sonner.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/toast.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sonner.md
- Examples: 21

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Managed messages and Sonner

Mount one `ExMessageContext` host before calling `ExMessage`. It renders the package's shared `Toaster`; do not add another for managed messages.

Read [Managed messages and Sonner](../exui/notifications.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.

**ExUI adaptation**

### Notification status icons

`Toaster` uses Lucide outline icons for success, error, warning, info and loading, with `CircleX` for circular error notifications. Icons use a 1rem size and Lucide's default stroke width; the loading icon spins. Colors inherit from the toast icon container, so per-toast `classNames.icon` controls the color. The status example uses `text-primary` for the info icon's theme color. Use `Toaster.icons` for custom icons.

**ExUI adaptation**

### Notification card corners

`Toaster` uses ExUI's `--radius-2xl` token for notification card corners: 18px at the default 16px root font size. Corners follow the root font size and scoped radius tokens. Override the `--border-radius` variable through `Toaster.style` when a composition needs a different radius.

`toast.custom` renders an unstyled notification, so its content must apply its own card corners. The custom Sonner examples use `rounded-[var(--border-radius)]` to inherit the host's radius, including overrides, and `w-full` to follow its responsive width. Use the same classes on the outer card when composing custom notifications.
<!-- exui-capabilities:end:skill -->

## When to use

- Brief feedback after an action, such as a created event or an archived message with Undo
- Progress of async work in one toast that updates in place, from loading to success or failure
- Rich notifications for messages, invites, deploys, builds and integrations, with their own buttons

## When not to use

- A status or warning that must stay on the page until the problem is fixed: use [Alert](./alert.md)
- A choice the user has to make before the page can carry on: use [Alert Dialog](./alert-dialog.md)
- An inbox panel that lists past activity for the user to review on demand: use the Sheet blocks

## Agent notes

- The examples ship only the sonner package and never render `Toaster`; mount the shadcn sonner `Toaster` once near your app root or no `toast` shows

## Third-party libraries

- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started)

## Examples

- [Basic](./sonner/c-sonner-1.md): Basic toast notification.. Best for a single line message from one bare call with no options, the minimum a toast needs.
- [With Description](./sonner/c-sonner-2.md): Toast notification with description.. Best for a title over a second line passed as description, here an event name with its date and time.
- [Positions](./sonner/c-sonner-3.md): Toast positions. Best for a grid of 6 buttons that each send their toast to a different top or bottom corner or center.
- [Variant Icons](./sonner/c-sonner-4.md): Toast variants with colored icons. Best for default, success, error, warning, info and loading side by side, with the 4 status icons each tinted its own color.
- [Durations](./sonner/c-sonner-5.md): Toast duration options. Best for timers of 2, 5 and 10 seconds beside a persistent notice that stays until it is closed.
- [Action Button](./sonner/c-sonner-6.md): Toast with action button. Best for an archive notice with an Undo button inside the toast that confirms with a second success toast.
- [Promise](./sonner/c-sonner-7.md): Promise toast with loading state. Best for a deploy whose spinner becomes a success or error line when its promise settles, quoting the resolved name.
- [Action & Cancel](./sonner/c-sonner-8.md): Toast with custom close and cancel buttons. Best for a delete prompt inside the toast with a Delete action and a Cancel button that just closes it.
- [Rich Content](./sonner/c-sonner-9.md): Toast with custom rich content. Best for a teammate chat message with avatar, sender, time ago and Reply and Dismiss buttons on the popover surface.
- [Upload Progress](./sonner/c-sonner-10.md): Toast with upload progress simulation. Best for a file card whose progress bar fills in place under one toast id, closing 3 seconds after it reaches 100.
- [Status Alert](./sonner/c-sonner-11.md): Toast with status alert markup. Best for a deploy result with a green status dot, environment, duration and commit rows, and View Logs and Open Site.
- [Accent Border](./sonner/c-sonner-12.md): Custom accent border toast. Best for a release notice marked by a thick blue left edge and an info icon, offering Later or Update Now.
- [Invert Success](./sonner/c-sonner-13.md): Custom invert success toast. Best for a paid invoice confirmation on the inverted surface with a green check badge and one View Receipt button.
- [Invert Error](./sonner/c-sonner-14.md): Custom invert error toast with details. Best for a failed build listing 2 file and line errors in monospace above View Logs and a red Retry Build.
- [Invert Info](./sonner/c-sonner-15.md): Custom invert info toast with avatar. Best for a collaboration invite from a named teammate with an avatar, a Decline and a blue Accept on the inverted surface.
- [Invert Warning](./sonner/c-sonner-16.md): Custom invert warning toast with countdown. Best for a session timeout warning held for 10 seconds, whose amber Extend Session button swaps in a success toast.
- [Invert Avatar Group](./sonner/c-sonner-17.md): Multi-action invert toast with avatar group. Best for a pull request ready to merge, with an overlapping stack of 3 reviewer avatars and View and green Merge.
- [Close Top Right](./sonner/c-sonner-18.md): Toast with close button on top-right. Best for an uploaded file notice whose close button is moved from the default top left corner to the top right.
- [Custom Icon](./sonner/c-sonner-19.md): Toast with custom icon. Best for a row of 3 plain notices that each pass their own leading glyph: send, download and bookmark.
- [Integration](./sonner/c-sonner-20.md): Custom integration toast. Best for a connected workspace card with a gradient link tile, Active status, a channel sync line and Configure and Open Dashboard.
- [Updatable](./sonner/c-sonner-21.md): Updatable toast with ID. Best for a spinner line rewritten through a stored toast id from preparing to 30 and 70 percent, then a success card.
