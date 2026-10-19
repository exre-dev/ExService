<!-- Generated from resources/components/code-block/c-code-block-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Transformer Diff

> Diff via shiki transformers

- Type: example, free and open source (MIT)
- Component: [Code Block](../code-block.md)
- Page: [local reference](./c-code-block-6.md)
- Uses: Code Block

## Best for

A hand written shiki transformer that tags lines 2 and 3 as removed and added, hoisted to module scope so renders skip re-tokenizing

## Agent notes

- `notationDiff` tags lines 2 and 3 by number, so it goes stale when `code` changes; `@shikijs/transformers` reads diff markers in the source

## When not to use

- Changed lines already known by number, with no transformer needed: use [Diff Summary](./c-code-block-5.md)

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
