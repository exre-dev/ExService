<!-- Generated from resources/components/emoji-picker/c-emoji-picker-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Message Reactions

> Message reactions

- Type: example, free and open source (MIT)
- Component: [Emoji Picker](../emoji-picker.md)
- Page: [local reference](./c-emoji-picker-3.md)
- Uses: Avatar, Button, Emoji Picker, Item, Tooltip

## Best for

Reaction pills split by skin tone with counts, plus a row of 6 one click reactions composed above the search

## Agent notes

- `toggle` only rewrites local `reactions` state seeded from `INITIAL_REACTIONS`; send each add or removal to your API there
- `QuickReactions` calls `useEmojiPicker`, so it only works rendered inside `EmojiPicker`, where it shares the skin tone and recent list

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Emoji Picker

### When to use

- Message composers, replies and notes that insert emoji at the caret of a text field
- Reactions on posts and messages, added from a popover beside the reaction pills
- A single stored emoji such as a page icon or a profile status, kept inline or behind a trigger

### When not to use

- A finished assistant conversation screen around a composer: use the AI Chat blocks
- Rendering a conversation as bubbles with avatars, names and times: use [Message](../message.md)
- A hue chosen from swatches, a spectrum or a typed hex value: use [Color Picker](../color-picker.md)

### Agent notes

- Left unset, `value` keeps each pick as the picker's value and `EmojiPickerTrigger` draws it in place of its default smiley; insert-only pickers pass null
- By default every picker on the origin shares recent emoji and skin tone through localStorage; scope them with `recentStorageKey` and `skinToneStorageKey`
