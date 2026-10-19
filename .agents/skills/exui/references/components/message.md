<!-- Generated from resources/components/message.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Message

> Open-source shadcn message components for chat transcripts, assistant replies, and support threads.

- Type: shadcn/ui component, free
- Page: [local reference](./message.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/message.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/message.md
- Examples: 7

## When to use

- Chat, support and team threads laid out turn by turn, with avatars, sender names and read receipts
- Assistant replies carrying a copy, regenerate and rating toolbar, or a pending then streaming state
- Shared images and documents carried in a turn beside its text

## When not to use

- A text surface on its own, with no avatar slot, metadata row or side switching: use [Bubble](./bubble.md)
- A long thread that scrolls and must stay pinned to the newest turn: use [Message Scroller](./message-scroller.md)
- A complete assistant screen with a composer, a thread switcher and streaming controls: use the AI Chat blocks

## Agent notes

- On an `align` end row only children of `MessageContent` that carry a `data-slot` move to the end; a plain element there keeps to the start
- `MessageHeader` and `MessageFooter` set no gap, so a header or footer built from several nodes needs its own gap class

## Examples

- [Two-Sided Chat](./message/c-message-1.md): Two-sided conversation. Best for the bare pattern with no avatars or metadata, where a muted or default bubble repeats which side spoke.
- [Avatars](./message/c-message-2.md): Avatars on both sides. Best for photo avatars for both people, a green presence badge with a screen reader Online label and a long turn that wraps.
- [Sender & Status](./message/c-message-3.md): Sender name and delivery status. Best for a name and time header split by a decorative dot, a Read receipt under the outgoing turn and an Edited footer.
- [Reply Actions](./message/c-message-4.md): Reply actions in the footer. Best for regenerate cycling 2 stored drafts and clearing the vote, a Copy that flips to a check, and pressed thumb toggles.
- [Shared Files](./message/c-message-5.md): Files shared in a thread. Best for an outgoing image tile above its caption and an incoming CSV card under its text, with a named download button.
- [Consecutive Messages](./message/c-message-6.md): Consecutive messages from one sender. Best for the name on the first row and the portrait on the last, with empty avatar slots holding the run on one spine.
- [Streaming Reply](./message/c-message-7.md): Streaming reply with a pending state. Best for a spinner line, then text revealed 4 characters at a time behind a caret, and the full answer at once under reduced motion.
