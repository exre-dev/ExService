<!-- Generated from resources/components/tooltip/c-tooltip-11.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Avatar Role Badge

> Tooltip with avatar and role badge

- Type: example, free and open source (MIT)
- Component: [Tooltip](../tooltip.md)
- Page: [local reference](./c-tooltip-11.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/tooltip.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/tooltip.md
- Uses: Avatar, Badge, Tooltip

## Best for

An avatar trigger that opens the same photo with the person's name, an Admin role badge and an email address

## Agent notes

- `AvatarFallback` reads SC for Emma Wilson in both places; derive the initials from the user's name
- The photo URL and alt text repeat in both `AvatarImage` elements; read them and the email from one user record

## When not to use

- A fuller profile preview with a large photo, handle and join date: use [Hover Card](../hover-card.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Tooltip

### When to use

- Short labels for buttons and icon only toolbar actions, with a keyboard shortcut where one exists
- Help text on an info icon, a warning, a verified mark, a locked feature or a disabled button
- Compact summaries behind a trigger, such as service status, notifications, file details or a person

### When not to use

- Content with links or buttons that keyboard users must be able to reach: use [Popover](../popover.md)
- A rich profile or page preview with a large photo, bio and dates: use [Hover Card](../hover-card.md)
- A status or count that stays readable without pointing at anything: use [Badge](../badge.md)

### Agent notes

- Outside a `TooltipProvider` the base `Tooltip` opens after 600ms and inside one at once; the radix `Tooltip` throws without one
- `TooltipTrigger` renders a `button` of its own, so a `Button` nested in it without `render` or radix `asChild` makes a button in a button
- `TooltipContent` is portaled to the end of the body with no focus guards, so a link or button in it is not next in Tab order after its trigger
