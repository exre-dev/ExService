<!-- Generated from resources/components/scrollspy.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Scrollspy

> Open-source shadcn scrollspy components for docs navigation, active table of contents, and long-form sections.

- Type: upstream component, free
- Page: [local reference](./scrollspy.md)
- Examples: 2

## When to use

- A table of contents that marks which section of a long scrolling panel is in view
- Jump links that scroll their content to the chosen section and keep that link highlighted

## When not to use

- A bounded panel that only needs its own scrollbar, with no links following the content: use [Scroll Area](./scroll-area.md)
- A chat transcript that opens on the newest turn and follows replies as they stream: use [Message Scroller](./message-scroller.md)
- Account pages whose side links swap in one panel at a time, hiding the rest: use the Profile blocks

## Agent notes

- Without `targetRef` the spy tracks nothing and a click only marks its link without scrolling, so always pass one
- `targetRef` can sit on a wrapper around a `ScrollArea`: the spy finds its `scroll-area-viewport` slot and tracks and scrolls that
- `history` is on by default, so mount and every section change rewrite the URL hash with `replaceState`; pass false to leave it alone

## Examples

- [Vertical Nav](./scrollspy/c-scrollspy-1.md): Basic scrollspy. Best for a vertical rail of 5 section buttons in a 150px column to the left of a 500px tall panel.
- [Horizontal Nav](./scrollspy/c-scrollspy-2.md): Basic scroll area. Best for a horizontal row of 5 section buttons above a full width 400px tall panel.
