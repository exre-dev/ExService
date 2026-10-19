<!-- Generated from resources/components/emoji-picker/c-emoji-picker-8.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Localized Labels

> Localized data and labels

- Type: example, free and open source (MIT)
- Component: [Emoji Picker](../emoji-picker.md)
- Page: [local reference](./c-emoji-picker-8.md)
- Uses: Card, Emoji Picker, Native Select

## Best for

A language select that swaps the emoji data and the picker's labels and clears the search, in a panel fitted to the card inset

## Agent notes

- `locale` loads emoji names, keywords and category labels, while the search, skin tone, empty and loading strings come from `i18n`, so a new language needs both
- The `NativeSelect` handler clears the controlled `query` with each switch, since a word in one language finds nothing in another

## When not to use

- An English only panel with no language switch: use [Inline](./c-emoji-picker-1.md)

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
