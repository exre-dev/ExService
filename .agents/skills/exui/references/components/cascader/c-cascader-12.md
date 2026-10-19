<!-- Generated from resources/components/cascader/c-cascader-12.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Native Form Field

> Form field that submits like a native input.

- Type: example, free and open source (MIT)
- Component: [Cascader](../cascader.md)
- Page: [local reference](./c-cascader-12.md)
- Uses: Button, Cascader, Field

## Best for

An uncontrolled support topic field in a labelled form, its popup matched to the trigger width and its pick read back from FormData

## Agent notes

- `onSubmit` calls `preventDefault` and only echoes `topic` into `submitted`; post the form data to your endpoint there

## When not to use

- A saved field that reopens on its own level and searches the whole catalog: use [Global Search](./c-cascader-21.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Cascader

### When to use

- Form fields that commit one value from a nested tree, such as a category, region, file or department
- Picking several nodes at once, such as permissions, report columns or shipping zones with cascading checks
- Deep or large hierarchies as Miller columns, an expanding tree, an inline panel or levels fetched on demand

### When not to use

- A short flat list of options with no nesting: use [Select](../select.md)
- A folder hierarchy browsed on the page rather than picked into a form field: use [Tree](../tree.md)
- A table of records whose cells are edited in place and saved together: use the Editing blocks

### Agent notes

- Parts live in separate files with no index: `CascaderItems` comes from `cascader-item`, while `CascaderInput` and `CascaderValue` come from `cascader-nav`
- Give every node a `value` that is unique across the whole tree, not only within its level; a repeated `value` silently drops the later row
