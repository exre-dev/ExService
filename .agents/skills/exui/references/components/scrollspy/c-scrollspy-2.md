<!-- Generated from resources/components/scrollspy/c-scrollspy-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Horizontal Nav

> Basic scroll area

- Type: example, free and open source (MIT)
- Component: [Scrollspy](../scrollspy.md)
- Page: [local reference](./c-scrollspy-2.md)
- Uses: Button, Scroll Area, Scrollspy

## Best for

A horizontal row of 5 section buttons above a full width 400px tall panel

## Agent notes

- `nav` ids run `section-6` to `section-10` under labels Section 1 to 5; sections resolve page wide by `getElementById`, so keep ids unique
- The `Scrollspy` row is a flex line with no wrap and its buttons never shrink, so any container narrower than the 5 buttons overflows; let it wrap or scroll

## When not to use

- A narrow column of section links kept beside the content: use [Vertical Nav](./c-scrollspy-1.md)
- A bounded panel with overflow but no links that follow the reader: use [Scroll Area](../scroll-area.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Scrollspy

### When to use

- A table of contents that marks which section of a long scrolling panel is in view
- Jump links that scroll their content to the chosen section and keep that link highlighted

### When not to use

- A bounded panel that only needs its own scrollbar, with no links following the content: use [Scroll Area](../scroll-area.md)
- A chat transcript that opens on the newest turn and follows replies as they stream: use [Message Scroller](../message-scroller.md)
- Account pages whose side links swap in one panel at a time, hiding the rest: use the Profile blocks

### Agent notes

- Without `targetRef` the spy tracks nothing and a click only marks its link without scrolling, so always pass one
- `targetRef` can sit on a wrapper around a `ScrollArea`: the spy finds its `scroll-area-viewport` slot and tracks and scrolls that
- `history` is on by default, so mount and every section change rewrite the URL hash with `replaceState`; pass false to leave it alone
