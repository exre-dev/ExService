<!-- Generated from resources/components/message/c-message-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Consecutive Messages

> Consecutive messages from one sender

- Type: example, free and open source (MIT)
- Component: [Message](../message.md)
- Page: [local reference](./c-message-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/message.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/message.md
- Uses: Avatar, Bubble, Message

## Best for

The name on the first row and the portrait on the last, with empty avatar slots holding the run on one spine

## Agent notes

- Keep the empty `MessageAvatar` on the earlier rows of a run; removing it shifts them off the column the portrait sits on
- Wrap each run in `MessageGroup` and give `MessageHeader` to its first row and the `Avatar` to its last when mapping your messages

## When not to use

- Each turn carrying its own portrait, with a presence badge on the sender: use [Avatars](./c-message-2.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Message

### When to use

- Chat, support and team threads laid out turn by turn, with avatars, sender names and read receipts
- Assistant replies carrying a copy, regenerate and rating toolbar, or a pending then streaming state
- Shared images and documents carried in a turn beside its text

### When not to use

- A text surface on its own, with no avatar slot, metadata row or side switching: use [Bubble](../bubble.md)
- A long thread that scrolls and must stay pinned to the newest turn: use [Message Scroller](../message-scroller.md)
- A complete assistant screen with a composer, a thread switcher and streaming controls: use the AI Chat blocks

### Agent notes

- On an `align` end row only children of `MessageContent` that carry a `data-slot` move to the end; a plain element there keeps to the start
- `MessageHeader` and `MessageFooter` set no gap, so a header or footer built from several nodes needs its own gap class
