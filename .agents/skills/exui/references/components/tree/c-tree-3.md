<!-- Generated from resources/components/tree/c-tree-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Folder File Icons

> Tree with custom indent.

- Type: example, free and open source (MIT)
- Component: [Tree](../tree.md)
- Page: [local reference](./c-tree-3.md)
- Uses: Tree

## Best for

Guide lines with a folder glyph that turns into an open folder on expand and a file glyph on every leaf

## When not to use

- Plus and minus marks on folders in place of turning chevrons: use [Plus Minus Toggles](./c-tree-4.md)
- A code project with a colored glyph for each kind of file: use [File Explorer](./c-tree-5.md)

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
