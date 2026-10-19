<!-- Generated from resources/components/code-block/c-code-block-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Pinned Copy

> Pinned copy button

- Type: example, free and open source (MIT)
- Component: [Code Block](../code-block.md)
- Page: [local reference](./c-code-block-2.md)
- Uses: Code Block, Scroll Area

## Best for

A headerless snippet whose outlined copy button floats over the code, with both axes scrolled by a capped shadcn ScrollArea

## Agent notes

- `CodeBlockCopyButton` outside a header pins over the code and stays hidden until hover or focus; `alwaysVisible` keeps it shown

## When not to use

- A snippet that needs its filename and language label above it: use [Basic](./c-code-block-1.md)

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
