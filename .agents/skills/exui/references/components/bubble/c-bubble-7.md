<!-- Generated from resources/components/bubble/c-bubble-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Formatted Answer

> Assistant answer with formatted content

- Type: example, free and open source (MIT)
- Component: [Bubble](../bubble.md)
- Page: [local reference](./c-bubble-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/bubble.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/bubble.md
- Uses: Bubble

## Best for

A wide column where the answer spans the row as real elements, with no markdown parser and no raw HTML

## Agent notes

- The answer is hardcoded JSX inside `BubbleContent`; map model output onto the same elements, or a markdown renderer that never sets raw HTML

## When not to use

- A long answer that should fold to its first paragraph until asked: use [Show More](./c-bubble-5.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Bubble

### When to use

- Chat and support threads where each turn shows its sender by side and by color
- Assistant replies in a transcript, including long answers folded to a lead and formatted answers
- Turn extras such as emoji reactions and quick reply choices that the reader presses

### When not to use

- A turn that needs an avatar, a sender name, a timestamp or actions around it: use [Message](../message.md)
- A finished assistant page or panel with a composer and streaming replies wired: use the AI Chat blocks
- A conversation with nothing in it yet, waiting for its first turn: use [Empty](../empty.md)

### Agent notes

- `align` end sets align-self, so each `Bubble` needs a flex column parent; in a grid or a plain block the end turns stay at the start
- A pressable bubble is `BubbleContent` itself, through `render` on base or `asChild` on radix; the bubble hover and focus ring skip a control nested inside it
