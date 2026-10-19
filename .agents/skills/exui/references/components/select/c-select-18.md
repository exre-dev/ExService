<!-- Generated from resources/components/select/c-select-18.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn User Avatars

> Select with user avatars

- Type: example, free and open source (MIT)
- Component: [Select](../select.md)
- Page: [local reference](./c-select-18.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/select.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/select.md
- Uses: Avatar, Field, Select

## Best for

A people picker of 10 users with photo avatars under a heading, the trigger repeating a smaller avatar

## Agent notes

- `users` loads remote Unsplash photos and its `email` is never shown; map your people into `mappedUsers`

## When not to use

- A roster long enough that people are found by typing a name: use [Combobox](../combobox.md)

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
