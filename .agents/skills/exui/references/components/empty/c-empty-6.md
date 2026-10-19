<!-- Generated from resources/components/empty/c-empty-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Dashed Upload

> Dashed upload empty state

- Type: example, free and open source (MIT)
- Component: [Empty](../empty.md)
- Page: [local reference](./c-empty-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/empty.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/empty.md
- Uses: Button, Empty

## Best for

A dashed drop area of capped width with a cloud tile, a Browse Files button and an accepted types and size hint

## Agent notes

- The copy promises drag and drop, but nothing handles a drop and the Browse Files `Button` opens no file picker

## When not to use

- A working drop zone that reads dragged items, checks type and size and lists them: use [File Upload](../file-upload.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Empty

### When to use

- First run screens and card sections that add the first record, invite a team or connect a data source
- Search with no matches, a not found page with a search field, or a prompt shown before the first search
- Caught up notices with nothing left to act on, such as inbox zero or no new notifications

### When not to use

- A complete first run page with finished copy, artwork and actions, ready to drop in: use the Empty State blocks
- A screen shown while a fetch is still running and no result is known yet: use [Spinner](../spinner.md)
- A square container for one glyph in a list row, feature card or settings item: use [Icon Tile](../icon-tile.md)

### Agent notes

- Adding `border` to `Empty` draws a dashed outline, since every style sets a dashed border style on it; add border-solid for a solid line
- `EmptyMedia` with `variant` icon puts the glyph in a small muted tile; the default variant has no fill, so drawings go there
- `Empty` takes `flex-1` and centers its children, so in a flex column with a set height it fills the free space
