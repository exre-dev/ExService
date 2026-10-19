<!-- Generated from resources/components/emoji-picker/c-emoji-picker-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Shortcode Suggestions

> Shortcode suggestions

- Type: example, free and open source (MIT)
- Component: [Emoji Picker](../emoji-picker.md)
- Page: [local reference](./c-emoji-picker-6.md)
- Uses: Avatar, Button, Card, Emoji Picker, Input Group, Item

## Best for

A combobox list of 5 ranked matches driven by arrow keys, Tab or Enter, plus an instant swap of a closed colon code

## Agent notes

- `DRAFT` seeds the field mid shortcode so suggestions show on load; start from an empty string and drop the `useEffect` that places its caret
- Suggestions search raw `data.emojis` from `useEmojiPickerData`, so they skip the grid's check that hides emoji the device cannot draw
- `post` only appends to local `comments` state; send the comment to your API there

## When not to use

- A composer that inserts only from the popover grid, with no typed codes: use [Chat Composer](./c-emoji-picker-2.md)

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
