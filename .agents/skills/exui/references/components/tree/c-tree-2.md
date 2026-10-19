<!-- Generated from resources/components/tree/c-tree-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Indent Lines

> Tree with indented lines.

- Type: example, free and open source (MIT)
- Component: [Tree](../tree.md)
- Page: [local reference](./c-tree-2.md)
- Uses: Tree

## Best for

Thin vertical guide lines at each indent step behind plain text rows, painted by one gradient on the root

## Agent notes

- The lines are a `repeating-linear-gradient` in the `Tree` className spaced by `indent`, so a new `indent` moves them with the rows

## When not to use

- Rows that need a folder or file glyph beside each name: use [Folder File Icons](./c-tree-3.md)

## Third-party libraries

- Headless Tree v1: [API reference](https://headless-tree.lukasbach.com/api/core/), [docs](https://headless-tree.lukasbach.com/getstarted/)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Tree

### When to use

- Folder and file explorers for a code project, a workspace or a document store
- Record hierarchies such as CRM accounts and contacts, or an org chart of who reports to whom
- Role permission editors grouped by area, where each action is ticked on or off

### When not to use

- A whole drive page with a folder rail beside a listing of the open folder: use the Files blocks
- Folder rows with size and item count columns that move into other folders by pointer: use the Drag & Drop blocks
- A pick of one value from a nested list, made inside a popup: use [Cascader](../cascader.md)

### Agent notes

- `syncDataLoaderFeature` throws when `getItem` returns nothing or a promise, so children fetched from a server need the async data loader feature
- The `rootItemId` record is never drawn, so its children form the top level and its own name stays hidden
- After adding, moving or removing records behind `dataLoader`, call rebuildTree on `tree`, or the rows keep the old structure
