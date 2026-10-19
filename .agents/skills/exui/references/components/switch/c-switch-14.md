<!-- Generated from resources/components/switch/c-switch-14.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Card Grid

> Switch with descriptions in card grid

- Type: example, free and open source (MIT)
- Component: [Switch](../switch.md)
- Page: [local reference](./c-switch-14.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/switch.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/switch.md
- Uses: Field, Switch

## Best for

A 2 column grid of service tiles, each with a bordered icon box, a brief description and a small toggle

## Agent notes

- Replace `features` with your services; the `checked` flag on each entry is only the starting state
- `FieldGroup` keeps `grid-cols-2` at every width, so the 4 tiles stay 2 across on a phone; add a 1 column base for narrow screens

## When not to use

- Tiles where exactly 1 option may be on at a time: use [Radio Group](../radio-group.md)

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
