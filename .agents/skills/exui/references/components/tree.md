<!-- Generated from resources/components/tree.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Tree

> Open-source shadcn tree components for file explorers, nested navigation, and hierarchical data.

- Type: upstream component, free
- Page: [local reference](./tree.md)
- Examples: 7

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Folder and file explorers for a code project, a workspace or a document store
- Record hierarchies such as CRM accounts and contacts, or an org chart of who reports to whom
- Role permission editors grouped by area, where each action is ticked on or off

## When not to use

- A whole drive page with a folder rail beside a listing of the open folder: use the Files blocks
- Folder rows with size and item count columns that move into other folders by pointer: use the Drag & Drop blocks
- A pick of one value from a nested list, made inside a popup: use [Cascader](./cascader.md)

## Agent notes

- `syncDataLoaderFeature` throws when `getItem` returns nothing or a promise, so children fetched from a server need the async data loader feature
- The `rootItemId` record is never drawn, so its children form the top level and its own name stays hidden
- After adding, moving or removing records behind `dataLoader`, call rebuildTree on `tree`, or the rows keep the old structure

## Third-party libraries

- Headless Tree v1: [API reference](https://headless-tree.lukasbach.com/api/core/), [docs](https://headless-tree.lukasbach.com/getstarted/)
- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin

## Examples

- [Basic](./tree/c-tree-1.md): Basic tree.. Best for the bare pattern with nothing added: chevron toggles and text only rows over a CRM outline of leads and accounts.
- [Indent Lines](./tree/c-tree-2.md): Tree with indented lines.. Best for thin vertical guide lines at each indent step behind plain text rows, painted by one gradient on the root.
- [Folder File Icons](./tree/c-tree-3.md): Tree with custom indent.. Best for guide lines with a folder glyph that turns into an open folder on expand and a file glyph on every leaf.
- [Plus Minus Toggles](./tree/c-tree-4.md): Tree with custom indent.. Best for plus and minus marks on folders in place of chevrons, over guide lines and open or closed folder glyphs.
- [File Explorer](./tree/c-tree-5.md): File explorer tree with type icons. Best for a code project outline with a colored glyph per file type: amber folders, blue code files, purple stylesheets and yellow JSON.
- [Org Chart](./tree/c-tree-6.md): Organization chart tree with avatars. Best for people rows with a photo, name and job title under their manager, nested at a wider 24px step.
- [Permissions](./tree/c-tree-7.md): Permissions tree with checkboxes. Best for role access grouped by area with a checkbox on each action row, plus and minus toggles and 5 grants on load.
