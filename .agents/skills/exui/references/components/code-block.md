<!-- Generated from resources/components/code-block.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Code Block

> Open-source shadcn code block components with Shiki syntax highlighting for AI chat, streaming agent output, diff review, and documentation.

- Type: upstream component, free
- Page: [local reference](./code-block.md)
- Examples: 27

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `CodeBlock`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { CodeBlock } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof CodeBlock>) {
  return <CodeBlock {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Assistant replies and agent output that stream code, or lines a reader picks to ask about
- Code review of diffs, git patches and diagnostics, with accept, reject and fix actions
- Docs snippets and terminal or test logs with line numbers, copy, wrap, folding and search

## When not to use

- A full assistant conversation screen with thread list, transcript and composer: use the AI Chat blocks
- A discount or promo code shown for a shopper to copy at checkout: use the Coupon blocks
- A release console with environment lanes, a deploy history grid and streaming logs: use the Dev Ops blocks

## Agent notes

- Line specs such as `highlightedLines`, `diff` and `folded` count source lines from 1, whatever `startLine` prints in the gutter
- `maxLines` caps height only on the built-in surface; with `CodeBlockContent` inside your own `ScrollArea`, cap that viewport yourself
- Hoist `transformers` to module scope; a new array on every render re-tokenizes the whole file

## Third-party libraries

- Shiki v4: [API reference](https://shiki.style/guide/install), [docs](https://shiki.style/guide/)

## Examples

- [Basic](./code-block/c-code-block-1.md): Basic code block. Best for a static TypeScript snippet with line numbers, the resolved language label and a header copy button.
- [Pinned Copy](./code-block/c-code-block-2.md): Pinned copy button. Best for a headerless snippet whose outlined copy button floats over the code, with both axes scrolled by a capped shadcn ScrollArea.
- [Streaming Agent](./code-block/c-code-block-3.md): Streaming agent response. Best for a route handler typed out 3 characters per tick, with a Generating badge, a Replay button and a ScrollArea that follows the caret.
- [AI Chat](./code-block/c-code-block-4.md): AI chat with code fences. Best for a 2 turn Frame transcript with avatars, where the streamed reply splits into prose paragraphs and a fenced snippet with copy.
- [Diff Summary](./code-block/c-code-block-5.md): Diff with change summary. Best for removed and added lines of a single file marked by number through the diff prop, under a header holding only filename and copy.
- [Transformer Diff](./code-block/c-code-block-6.md): Diff via shiki transformers. Best for a hand written shiki transformer that tags lines 2 and 3 as removed and added, hoisted to module scope so renders skip re-tokenizing.
- [Highlights](./code-block/c-code-block-7.md): Highlighted lines and words. Best for a connection config with lines 2 to 4 tinted from a range string and 2 identifiers marked wherever they appear.
- [Focus Walkthrough](./code-block/c-code-block-8.md): Focus walkthrough. Best for a 3 step tour of a checkout function, chosen with pressed buttons in the header, with a step counter and the other lines dimmed.
- [Terminal Output](./code-block/c-code-block-9.md): Terminal output. Best for build output with highlighting turned off so shiki never loads, under a Terminal header with wrap and copy controls.
- [Long File](./code-block/c-code-block-10.md): Long file with expand. Best for a generated file excerpt numbered from 120 and held near 8 rows by a ScrollArea that reads expanded state until Show more.
- [Diagnostics & Actions](./code-block/c-code-block-11.md): Line actions and diagnostics. Best for a function with an error line and a warning line, tallied in header badges, where a Fix line button appears on hover over either.
- [Line Selection](./code-block/c-code-block-12.md): Line selection. Best for controlled click and shift click line picking that feeds a selected count badge, an Ask about button and a Clear button.
- [Search In File](./code-block/c-code-block-13.md): Search in file. Best for a header search field that marks each case sensitive match, a badge counting matches in the source, and a floating copy button.
- [File Tabs](./code-block/c-code-block-14.md): File tabs in a dense frame. Best for snippets in tsx, Python, SQL and bash behind file tabs in a dense Frame header, each a ghost block with floating copy.
- [Pre-Highlighted Lines](./code-block/c-code-block-15.md): Pre-highlighted lines. Best for hand built tokens that color 4 Python keywords in light and dark, passed as lines so the client loads no highlighter.
- [Before & After](./code-block/c-code-block-16.md): Before and after. Best for a loop refactored into a reduce, as 2 ghost blocks with Before and After headers in separate panels of one Frame.
- [Soft Wrap](./code-block/c-code-block-17.md): Soft wrap. Best for a single line CSP string that starts wrapped, with wrap state lifted to the page so a badge reads Wrapped or Scrolling.
- [Unified Patch](./code-block/c-code-block-18.md): Unified patch review. Best for a 2 file patch split into one block per file, each with plus and minus count badges and a download named after that file.
- [Design Token Theme](./code-block/c-code-block-19.md): Design-token theme. Best for a rose, violet, emerald, sky and amber palette set as class variables on the block, stepping to lighter shades in dark mode.
- [Always Dark](./code-block/c-code-block-20.md): Always-dark block. Best for a dark scoped hero snippet behind 3 window dots, carrying a highlight, a word mark, a diff pair and all 3 diagnostic levels.
- [Dark Terminal](./code-block/c-code-block-21.md): Dark terminal. Best for a forced dark vitest log assembled span by span with light and dark hex colors, pass and fail marks and a summary row.
- [Accept & Reject](./code-block/c-code-block-22.md): Patch review actions. Best for an agent fix in a ghost block inside a Card, with Reject and Accept in the footer that flip to a status line and Undo.
- [Code Folding](./code-block/c-code-block-23.md): Nested code folding. Best for a sync function with 5 indentation regions, opening with its inner branch folded, plus Fold all and Unfold all in the header.
- [Fix With AI](./code-block/c-code-block-24.md): Fix with AI on the failing line. Best for a reduce missing its initial value flagged on line 3, where a Fix with AI button on that line swaps in patched source with Undo.
- [Reference Lines](./code-block/c-code-block-25.md): Reference lines in chat. Best for a gutter plus button that adds the hovered line or the whole selection to a Card composer, where pressing a chip highlights its line.
- [External Scroll](./code-block/c-code-block-26.md): Framed by an external ScrollArea. Best for a Card with 3 changed files that size to their content, scrolled together by one fixed height ScrollArea, each with count badges.
- [ANSI Terminal](./code-block/c-code-block-27.md): ANSI terminal output. Best for vitest stdout with raw SGR escapes turned into colored tokens by ansiToLines, forced dark, with escape free text for copy.
