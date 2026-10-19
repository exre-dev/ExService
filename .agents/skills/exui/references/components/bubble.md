<!-- Generated from resources/components/bubble.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Bubble

> Open-source shadcn bubble components for chat threads, assistant replies, and message reactions.

- Type: shadcn/ui component, free
- Page: [local reference](./bubble.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/bubble.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/bubble.md
- Examples: 7

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Bubble`, `BubbleContent`, `BubbleReactions`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Bubble } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Bubble>) {
  return <Bubble {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Chat and support threads where each turn shows its sender by side and by color
- Assistant replies in a transcript, including long answers folded to a lead and formatted answers
- Turn extras such as emoji reactions and quick reply choices that the reader presses

## When not to use

- A turn that needs an avatar, a sender name, a timestamp or actions around it: use [Message](./message.md)
- A finished assistant page or panel with a composer and streaming replies wired: use the AI Chat blocks
- A conversation with nothing in it yet, waiting for its first turn: use [Empty](./empty.md)

## Agent notes

- `align` end sets align-self, so each `Bubble` needs a flex column parent; in a grid or a plain block the end turns stay at the start
- A pressable bubble is `BubbleContent` itself, through `render` on base or `asChild` on radix; the bubble hover and focus ring skip a control nested inside it

## Examples

- [Sender Alignment](./bubble/c-bubble-1.md): Support thread with sender alignment. Best for a Card with an avatar and name header over a thread mapped from data, each turn announcing its sender to screen readers.
- [All Variants](./bubble/c-bubble-2.md): Bubble variants in a release thread. Best for one turn per variant, from a secondary status update and a destructive failure notice to the full width ghost answer.
- [Grouped Messages](./bubble/c-bubble-3.md): Grouped consecutive messages. Best for sender entries holding an array of lines, a wider thread gap than group gap, and a delivered time under the last turn.
- [Reactions](./bubble/c-bubble-4.md): Message reactions and a reaction button. Best for emoji pills hanging off the bubble edge on a Card, static rows labeled as one image and a single aria-pressed toggle.
- [Show More](./bubble/c-bubble-5.md): Long reply with show more. Best for a lead paragraph kept out of the panel so nothing repeats, with a link Button trigger whose chevron turns on open.
- [Quick Replies](./bubble/c-bubble-6.md): Quick reply bubbles and an action row. Best for choices that swap for the echoed pick and a reply written for that option, with one choice leaving as a link.
- [Formatted Answer](./bubble/c-bubble-7.md): Assistant answer with formatted content. Best for a wide column where the answer spans the row as real elements, with no markdown parser and no raw HTML.
