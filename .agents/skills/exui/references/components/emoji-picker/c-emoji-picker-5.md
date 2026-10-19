<!-- Generated from resources/components/emoji-picker/c-emoji-picker-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Custom Team Emoji

> Custom team emoji

- Type: example, free and open source (MIT)
- Component: [Emoji Picker](../emoji-picker.md)
- Page: [local reference](./c-emoji-picker-5.md)
- Uses: Avatar, Button, Card, Emoji Picker, Input Group, Item, Separator

## Best for

Image tiles under a logo tab ordered ahead of Frequently used, stored as colon codes and drawn back as images in posts

## Agent notes

- Replace `TEAM_EMOJI` and its `glyph` data URIs with your workspace's uploads; `src` takes any image URL
- A pick stores the first of `shortcodes` as a colon code while `BY_CODE` finds images by `id`, so keep each list starting with its id
- Stored posts keep custom picks as colon codes; render them through `renderText` or readers see the raw codes

## When not to use

- Replies that need only the standard Unicode set with no uploaded images: use [Chat Composer](./c-emoji-picker-2.md)

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
