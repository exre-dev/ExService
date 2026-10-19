<!-- Generated from resources/components/switch.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Switch

> Open-source shadcn switch components for settings toggles, preferences, and binary choices.

- Type: shadcn/ui component, free
- Page: [local reference](./switch.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/switch.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/switch.md
- Examples: 14

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Switch inside FieldLabel

When a `FieldLabel` contains a `Switch`, toggling the switch changes its track without filling the entire label background. This applies to card and settings-row labels. Use the label composition for a clickable switch row; avoid adding a selected fill solely to represent the switch state.
<!-- exui-capabilities:end:skill -->

## When to use

- Single on or off preferences beside a label, such as airplane mode, sign in security or an AI feature
- Grouped notification, privacy and editor preferences in a card, a Frame panel or a dense list
- Options with a supporting sentence set as clickable tiles, including a risky one that erases data

## When not to use

- A complete options page with account, security and notification sections ready to drop in: use the Settings blocks
- A row of pressed buttons that picks a view, an alignment or a time range: use [Toggle Group](./toggle-group.md)
- A consent or terms box that is ticked and sent along with a form: use [Checkbox](./checkbox.md)

## Agent notes

- Every `Switch` here is uncontrolled, seeded by `defaultChecked` or left off, and nothing reads a flip back; control it to save the setting
- No example gives `Switch` a name, so a native form submit carries none of these values; add one when the switch sits inside a form

## Examples

- [Basic](./switch/c-switch-1.md): Basic switch.. Best for the minimal row: one switch, off on load, left of its Airplane Mode label in a horizontal Field.
- [With Description](./switch/c-switch-2.md): Switch with description.. Best for a title over a supporting sentence with the control at the right, the whole row one clickable label.
- [Disabled](./switch/c-switch-3.md): Disabled switch.. Best for locked rows in both states, one off and one on, that stay readable but cannot be flipped.
- [Sizes](./switch/c-switch-4.md): Switch in different sizes.. Best for the sm and default sizes stacked for comparison, to match the control to dense or regular rows.
- [Switch Group](./switch/c-switch-5.md): Switch group. Best for a headed stack of email, SMS and push channels, each control left of its label and 2 on at load.
- [Card Separators](./switch/c-switch-6.md): Switch list in card with separators. Best for a card holding 3 channel rows split by separators, each name at the left and its toggle at the right edge.
- [Card With Icons](./switch/c-switch-7.md): Switch list in card with icons. Best for rows that lead with a dimmed bell, mail or phone icon before each channel name, in a divided card.
- [In Frame](./switch/c-switch-8.md): Switch in frame. Best for privacy rows in a Frame panel below a header titled Privacy Settings, 2 of the 3 on at load.
- [Tooltip Info](./switch/c-switch-9.md): Switch with tooltip info. Best for a sign in security option whose label is followed by a help icon that explains it in a tooltip.
- [With Badges](./switch/c-switch-10.md): Switch with badges. Best for preview feature rows tagged with New and Beta pills after the label, such as an AI copilot.
- [Colored](./switch/c-switch-11.md): Colored switches. Best for custom on colors set per control through a data-checked class, here blue, green and yellow.
- [Destructive Confirm](./switch/c-switch-12.md): Destructive switch with confirmation text. Best for a data wiping option with red title text, an irreversible warning below it and a red track when on.
- [Compact Table](./switch/c-switch-13.md): Compact settings table with switches. Best for editor preferences mapped from an array into dense rows, each with a short hint and a small toggle.
- [Card Grid](./switch/c-switch-14.md): Switch with descriptions in card grid. Best for a 2 column grid of service tiles, each with a bordered icon box, a brief description and a small toggle.
