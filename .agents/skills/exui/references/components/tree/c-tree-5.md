<!-- Generated from resources/components/tree/c-tree-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn File Explorer

> File explorer tree with type icons

- Type: example, free and open source (MIT)
- Component: [Tree](../tree.md)
- Page: [local reference](./c-tree-5.md)
- Uses: Tree

## Best for

A code project outline with a colored glyph per file type: amber folders, blue code files, purple stylesheets and yellow JSON

## Agent notes

- `getFileIcon` maps each `type` to a glyph and color; a type it does not list, such as `config`, falls back to a plain file glyph
- Folder rows come from `isItemFolder` counting `children`, not from `type`, so an empty folder record renders as a leaf

## When not to use

- Folder and file glyphs in one muted color, with guide lines between levels: use [Folder File Icons](./c-tree-3.md)

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
