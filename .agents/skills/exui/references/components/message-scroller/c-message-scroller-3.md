<!-- Generated from resources/components/message-scroller/c-message-scroller-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Anchored Turn

> Anchored turn with a previous peek

- Type: example, free and open source (MIT)
- Component: [Message Scroller](../message-scroller.md)
- Page: [local reference](./c-message-scroller-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/message-scroller.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/message-scroller.md
- Uses: Avatar, Bubble, Card, Input Group, Message, Message Scroller

## Best for

A composer form that sends questions and gets a canned answer after 900ms, each question lifted near the top under a 64px peek

## Agent notes

- Replace the 900ms `setTimeout` in `handleSubmit`, which answers from `REPLIES`, with your send and reply call
- The `scrollPreviousItemPeek` gap is left above a row only when it carries `scrollAnchor`, so keep that prop on the question rows

## When not to use

- A reply that grows token by token while the view follows the bottom: use [Streaming Reply](./c-message-scroller-2.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Message Scroller

### When to use

- Chat and assistant transcripts in a bounded panel that open on the newest turn and offer a jump back to it
- Streaming replies that follow the bottom until the reader scrolls up, with sent questions lifted near the top
- Saved threads that reopen at a chosen turn, load older history above the reader or step between questions

### When not to use

- The layout of a single turn, its avatar, sender name and timestamp around the body: use [Message](../message.md)
- A sidebar, settings list or panel that overflows but never grows at the bottom: use [Scroll Area](../scroll-area.md)
- A finished assistant screen with composer, thread list, citations and docked panels: use the AI Chat blocks

### Agent notes

- The parts and hooks throw outside `MessageScrollerProvider`, so a header or footer control that calls a hook needs the provider above it too
- `MessageScroller` fills its parent through `size-full`, so bound the parent height or the page scrolls instead of the transcript
- Render `MessageScrollerButton` as a sibling of `MessageScrollerViewport`; placed inside it, the control scrolls away with the rows
