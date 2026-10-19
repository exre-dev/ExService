<!-- Generated from resources/components/message-scroller.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Message Scroller

> Open-source shadcn message scroller components for chat transcripts, streaming replies, and jump-to-latest scrolling.

- Type: shadcn/ui component, free
- Page: [local reference](./message-scroller.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/message-scroller.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/message-scroller.md
- Examples: 6

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Chat and assistant transcripts in a bounded panel that open on the newest turn and offer a jump back to it
- Streaming replies that follow the bottom until the reader scrolls up, with sent questions lifted near the top
- Saved threads that reopen at a chosen turn, load older history above the reader or step between questions

## When not to use

- The layout of a single turn, its avatar, sender name and timestamp around the body: use [Message](./message.md)
- A sidebar, settings list or panel that overflows but never grows at the bottom: use [Scroll Area](./scroll-area.md)
- A finished assistant screen with composer, thread list, citations and docked panels: use the AI Chat blocks

## Agent notes

- The parts and hooks throw outside `MessageScrollerProvider`, so a header or footer control that calls a hook needs the provider above it too
- `MessageScroller` fills its parent through `size-full`, so bound the parent height or the page scrolls instead of the transcript
- Render `MessageScrollerButton` as a sibling of `MessageScrollerViewport`; placed inside it, the control scrolls away with the rows

## Examples

- [Jump to Latest](./message-scroller/c-message-scroller-1.md): Chat transcript with jump to latest. Best for a read only 9 message thread on the provider defaults, with no client state, streaming or composer to strip out.
- [Streaming Reply](./message-scroller/c-message-scroller-2.md): Streaming reply that follows the edge. Best for a reply typed out 4 characters every 28ms under a Working badge, with aria-busy on the log and a Replay stream button.
- [Anchored Turn](./message-scroller/c-message-scroller-3.md): Anchored turn with a previous peek. Best for a composer form that sends questions and gets a canned answer after 900ms, each question lifted near the top under a 64px peek.
- [Opening Position](./message-scroller/c-message-scroller-4.md): Opening position for a saved thread. Best for a Tabs switch over the 3 opening positions on a thread whose last answer outgrows the panel, with a day divider on top.
- [Load Earlier](./message-scroller/c-message-scroller-5.md): Load earlier without losing your place. Best for a header Load earlier button adding 5 older turns per click to a 6 of 16 window, with a badge that reports whether the view can scroll up.
- [Thread Navigator](./message-scroller/c-message-scroller-6.md): Thread navigator for stepping turns. Best for previous and next buttons around a turn counter and the current question, tracked from the anchor and jumped with smooth scrolling.
