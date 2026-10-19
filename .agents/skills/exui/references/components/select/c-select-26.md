<!-- Generated from resources/components/select/c-select-26.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Status Filter

> Status filter select with colored dots

- Type: example, free and open source (MIT)
- Component: [Select](../select.md)
- Page: [local reference](./c-select-26.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/select.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/select.md
- Uses: Field, Select

## Best for

A filter that starts on an All Status row with no dot, above 4 states that each carry one

## Agent notes

- All Status is a real option whose value is `all`, not an empty pick, so treat it as no filter in your query

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Select

### When to use

- Form fields that pick one value from a short fixed list, such as a fruit, timezone, country or size
- Pickers whose options carry a status dot, badge, avatar, flag, icon or one line description
- Toolbar filters and property pickers, such as status, priority, access level or assignee

### When not to use

- A long list the user wants to search by typing part of a name: use [Combobox](../combobox.md)
- A plain form field that should open the phone or browser's own picker: use [Native Select](../native-select.md)
- Options nested in levels, such as a category and then its subcategories: use [Cascader](../cascader.md)

### Agent notes

- Pass `alignItemWithTrigger` false on the base twin or `position` popper on radix to open the list below the trigger, not over it
- With no children, base `SelectValue` prints a string value raw unless `Select` gets `items`; radix `SelectValue` mirrors the chosen `SelectItem`
- Base `SelectItem` can take a whole object as `value`, matched to `defaultValue` by reference; radix values must be non-empty strings
