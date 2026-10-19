<!-- Generated from resources/components/kbd.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Kbd

> Open-source shadcn keyboard shortcut components for hotkey hints, command docs, and shortcut legends.

- Type: shadcn/ui component, free
- Page: [local reference](./kbd.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/kbd.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/kbd.md
- Examples: 6

## When to use

- Shortcut hints set beside an action name, in a tooltip or inside a search field
- Single keys and key combinations, as loose caps, a group of caps or keys with an icon
- Reference lists that pair each command name with its key chord

## When not to use

- A searchable palette of actions the user picks from with the keyboard: use [Command](./command.md)
- A ready made shortcuts panel with search and sections, sliding in from the side: use the Sheet blocks
- A status, tag or count shown as a small chip, not a key to press: use [Badge](./badge.md)

## Agent notes

- No example listens for its keys: `Kbd` only draws the label, so bind each shortcut with your own keydown handler
- `Kbd` turns off pointer events and text selection, so it cannot be clicked, used as a hover trigger or selected

## Examples

- [Basic Keys](./kbd/c-kbd-1.md): Basic keyboard keys.. Best for loose single keys with no group, where a chord such as Ctrl + B sits as text inside one key.
- [Grouped Keys](./kbd/c-kbd-2.md): Keyboard keys grouped together.. Best for a 3 key chord, Ctrl Shift P, as separate caps in one group with a small gap and no plus signs.
- [Keys With Icons](./kbd/c-kbd-3.md): Keyboard keys combined with icons.. Best for keys that lead with an icon before a word, such as a left arrow before Left, grouped with a Voice Enabled key.
- [In Input](./kbd/c-kbd-4.md): Keyboard key within an input.. Best for a Space key hint at the leading edge of a search field, held in an input group addon.
- [In Tooltip](./kbd/c-kbd-5.md): Keyboard shortcut in a tooltip.. Best for a single key inside the hover hint of an icon only save button, set after the action name.
- [Shortcut List](./kbd/c-kbd-6.md): Keyboard shortcuts reference list. Best for a titled list of 5 commands from Search to Redo, each row ending in its Mac key chord.
