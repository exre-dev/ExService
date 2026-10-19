<!-- Generated from resources/components/cascader/c-cascader-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Avatar Rows

> Custom rows with avatars and role badges.

- Type: example, free and open source (MIT)
- Component: [Cascader](../cascader.md)
- Page: [local reference](./c-cascader-5.md)
- Uses: Avatar, Badge, Button, Cascader

## Best for

An assignee picker by team, each member row with a photo, an online or away dot and a seniority chip, and the face repeated in the trigger

## Agent notes

- Each member `avatar` in `teams` is an Unsplash photo URL; point it at your own user images
- `membersByValue` indexes only the direct children of each team, so a member nested deeper shows no avatar in the trigger

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
