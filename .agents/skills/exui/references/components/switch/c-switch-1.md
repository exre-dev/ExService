<!-- Generated from resources/components/switch/c-switch-1.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Basic

> Basic switch.

- Type: example, free and open source (MIT)
- Component: [Switch](../switch.md)
- Page: [local reference](./c-switch-1.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/switch.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/switch.md
- Uses: Field, Switch

## Best for

The minimal row: one switch, off on load, left of its Airplane Mode label in a horizontal Field

## When not to use

- Several related options stacked under one shared heading: use [Switch Group](./c-switch-5.md)

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
