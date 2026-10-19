<!-- Generated from resources/components/switch/c-switch-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Tooltip Info

> Switch with tooltip info

- Type: example, free and open source (MIT)
- Component: [Switch](../switch.md)
- Page: [local reference](./c-switch-9.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/switch.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/switch.md
- Uses: Field, Switch, Tooltip

## Best for

A sign in security option whose label is followed by a help icon that explains it in a tooltip

## Agent notes

- The radix twin wraps `Tooltip` in `TooltipProvider`, which a Radix tooltip throws without; drop it only when your app root mounts one
- The help `TooltipTrigger` holds only an `aria-hidden` icon, so the button has no accessible name; label it for screen readers

## When not to use

- Help text that stays on screen below the label at all times: use [With Description](./c-switch-2.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Switch

### When to use

- Single on or off preferences beside a label, such as airplane mode, sign in security or an AI feature
- Grouped notification, privacy and editor preferences in a card, a Frame panel or a dense list
- Options with a supporting sentence set as clickable tiles, including a risky one that erases data

### When not to use

- A complete options page with account, security and notification sections ready to drop in: use the Settings blocks
- A row of pressed buttons that picks a view, an alignment or a time range: use [Toggle Group](../toggle-group.md)
- A consent or terms box that is ticked and sent along with a form: use [Checkbox](../checkbox.md)

### Agent notes

- Every `Switch` here is uncontrolled, seeded by `defaultChecked` or left off, and nothing reads a flip back; control it to save the setting
- No example gives `Switch` a name, so a native form submit carries none of these values; add one when the switch sits inside a form
