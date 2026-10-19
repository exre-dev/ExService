<!-- Generated from resources/components/message/c-message-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sender & Status

> Sender name and delivery status

- Type: example, free and open source (MIT)
- Component: [Message](../message.md)
- Page: [local reference](./c-message-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/message.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/message.md
- Uses: Bubble, Message

## Best for

A name and time header split by a decorative dot, a Read receipt under the outgoing turn and an Edited footer

## Agent notes

- Each time and the Read receipt in `MessageHeader` and `MessageFooter` are hardcoded strings; render them from your message timestamps
- On an `align` end row `MessageHeader` moves to the end with the bubble; the demo only puts headers on start rows

## When not to use

- A footer holding icon buttons that act on the reply: use [Reply Actions](./c-message-4.md)

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
