<!-- Generated from resources/components/tooltip/c-tooltip-13.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Online Status

> Tooltip with online status indicator

- Type: example, free and open source (MIT)
- Component: [Tooltip](../tooltip.md)
- Page: [local reference](./c-tooltip-13.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/tooltip.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/tooltip.md
- Uses: Avatar, Tooltip

## Best for

An avatar with a green presence dot whose hint repeats the photo beside the name and an Online now line

## Agent notes

- Presence is a fixed `bg-green-500` dot and the words Online now; switch both from your presence data

## When not to use

- A row of people whose presence shows as a dot with no details on demand: use [Avatar](../avatar.md)

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
