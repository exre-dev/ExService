<!-- Generated from resources/components/code-block/c-code-block-27.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn ANSI Terminal

> ANSI terminal output

- Type: example, free and open source (MIT)
- Component: [Code Block](../code-block.md)
- Page: [local reference](./c-code-block-27.md)
- Uses: Code Block

## Best for

Vitest stdout with raw SGR escapes turned into colored tokens by ansiToLines, forced dark, with escape free text for copy

## Agent notes

- Pass your process output to `ansiToLines` in place of `stdout`; background colors and cursor moves are stripped, not drawn

## When not to use

- Log lines already split into colored spans by your own parser: use [Dark Terminal](./c-code-block-21.md)

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
