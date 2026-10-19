<!-- Generated from resources/components/sonner/c-sonner-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Rich Content

> Toast with custom rich content

- Type: example, free and open source (MIT)
- Component: [Sonner](../sonner.md)
- Page: [local reference](./c-sonner-9.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/toast.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/sonner.md
- Uses: Avatar, Button

## Best for

A teammate chat message with avatar, sender, time ago and Reply and Dismiss buttons on the popover surface

## Agent notes

- Reply and Dismiss both call `toast.dismiss` with no id, which closes every open toast; open your reply view from Reply

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
