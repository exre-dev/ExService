<!-- Generated from resources/components/avatar/c-avatar-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Badge Icons

> Avatar with badge icon

- Type: example, free and open source (MIT)
- Component: [Avatar](../avatar.md)
- Page: [local reference](./c-avatar-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/avatar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/avatar.md
- Uses: Avatar

## Best for

Corner badges holding a plus, check, star or shield icon on primary, success, warning and info fills

## Agent notes

- `AvatarBadge` hides its icon when the parent `Avatar` has `size` sm, so keep icon badges at default or lg

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Avatar

### When to use

- Profile photos with initials or a user icon that stand in when the picture is missing or fails
- Presence dots, verified marks and number badges pinned to the corners of a person's photo
- Overlapping team stacks, social proof rows and user chips inside buttons or account triggers

### When not to use

- An account panel opened from a trigger, with the name, email and grouped actions: use [Dropdown Menu](../dropdown-menu.md)
- A full account settings page where a person edits photo, name and details: use the Profile blocks
- A workspace members directory with roles, invites and access status: use the Users blocks

### Agent notes

- Initials inside `AvatarFallback` are typed by hand in every example; derive them from each person's name rather than copying the sample letters
- A square `Avatar` needs the same radius on `AvatarImage`, `AvatarFallback` and its after pseudo element border, since all 3 default to round
