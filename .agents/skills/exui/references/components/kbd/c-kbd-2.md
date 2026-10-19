<!-- Generated from resources/components/kbd/c-kbd-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Grouped Keys

> Keyboard keys grouped together.

- Type: example, free and open source (MIT)
- Component: [Kbd](../kbd.md)
- Page: [local reference](./c-kbd-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/kbd.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/kbd.md
- Uses: Kbd

## Best for

A 3 key chord, Ctrl Shift P, as separate caps in one group with a small gap and no plus signs

## When not to use

- A whole list of commands, each row with its own chord: use [Shortcut List](./c-kbd-6.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Kbd

### When to use

- Shortcut hints set beside an action name, in a tooltip or inside a search field
- Single keys and key combinations, as loose caps, a group of caps or keys with an icon
- Reference lists that pair each command name with its key chord

### When not to use

- A searchable palette of actions the user picks from with the keyboard: use [Command](../command.md)
- A ready made shortcuts panel with search and sections, sliding in from the side: use the Sheet blocks
- A status, tag or count shown as a small chip, not a key to press: use [Badge](../badge.md)

### Agent notes

- No example listens for its keys: `Kbd` only draws the label, so bind each shortcut with your own keydown handler
- `Kbd` turns off pointer events and text selection, so it cannot be clicked, used as a hover trigger or selected
