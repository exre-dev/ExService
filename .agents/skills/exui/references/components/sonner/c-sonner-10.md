<!-- Generated from resources/components/sonner/c-sonner-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Upload Progress

> Toast with upload progress simulation

- Type: example, free and open source (MIT)
- Component: [Sonner](../sonner.md)
- Page: [local reference](./c-sonner-10.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/toast.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sonner.md
- Uses: Button, Progress

## Best for

A file card whose progress bar fills in place under one toast id, closing 3 seconds after it reaches 100

## Agent notes

- `setInterval` adds a random step of 5 to 19 every 500ms to fake progress; call `toast.custom` with the same `id` from your upload events
- `intervalRef` holds only the latest timer, so a second click before 100 orphans the first; keep 1 handle per upload

## When not to use

- Progress kept in the page as a list, one row per item being sent: use [File Upload](../file-upload.md)

## Third-party libraries

- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Sonner

### When to use

- Brief feedback after an action, such as a created event or an archived message with Undo
- Progress of async work in one toast that updates in place, from loading to success or failure
- Rich notifications for messages, invites, deploys, builds and integrations, with their own buttons

### When not to use

- A status or warning that must stay on the page until the problem is fixed: use [Alert](../alert.md)
- A choice the user has to make before the page can carry on: use [Alert Dialog](../alert-dialog.md)
- An inbox panel that lists past activity for the user to review on demand: use the Sheet blocks

### Agent notes

- The examples ship only the sonner package and never render `Toaster`; mount the shadcn sonner `Toaster` once near your app root or no `toast` shows
