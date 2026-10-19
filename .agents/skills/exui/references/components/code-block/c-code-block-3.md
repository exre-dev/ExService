<!-- Generated from resources/components/code-block/c-code-block-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Streaming Agent

> Streaming agent response

- Type: example, free and open source (MIT)
- Component: [Code Block](../code-block.md)
- Page: [local reference](./c-code-block-3.md)
- Uses: Badge, Button, Code Block, Scroll Area

## Best for

A route handler typed out 3 characters per tick, with a Generating badge, a Replay button and a ScrollArea that follows the caret

## Agent notes

- `target` and the `setLength` timer fake the stream; pass your model's growing text as `code` and drive `streaming` from its status

## When not to use

- A reply that mixes prose with fenced snippets in one message: use [AI Chat](./c-code-block-4.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Code Block

### When to use

- Assistant replies and agent output that stream code, or lines a reader picks to ask about
- Code review of diffs, git patches and diagnostics, with accept, reject and fix actions
- Docs snippets and terminal or test logs with line numbers, copy, wrap, folding and search

### When not to use

- A full assistant conversation screen with thread list, transcript and composer: use the AI Chat blocks
- A discount or promo code shown for a shopper to copy at checkout: use the Coupon blocks
- A release console with environment lanes, a deploy history grid and streaming logs: use the Dev Ops blocks

### Agent notes

- Line specs such as `highlightedLines`, `diff` and `folded` count source lines from 1, whatever `startLine` prints in the gutter
- `maxLines` caps height only on the built-in surface; with `CodeBlockContent` inside your own `ScrollArea`, cap that viewport yourself
- Hoist `transformers` to module scope; a new array on every render re-tokenizes the whole file
