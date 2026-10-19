<!-- Generated from resources/components/emoji-picker/c-emoji-picker-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Chat Composer

> Chat composer

- Type: example, free and open source (MIT)
- Component: [Emoji Picker](../emoji-picker.md)
- Page: [local reference](./c-emoji-picker-2.md)
- Uses: Avatar, Bubble, Button, Card, Emoji Picker, Input Group, Message, Separator

## Best for

A bubble thread that scrolls to each send, where your follow-ups join your last bubble group

## Agent notes

- `send` only appends to local `groups` state seeded from `THREAD`; post the message to your backend there

## When not to use

- Replies that also offer the team's own uploaded image set: use [Custom Team Emoji](./c-emoji-picker-5.md)
- A composer that completes a typed colon code from a list under the field: use [Shortcode Suggestions](./c-emoji-picker-6.md)

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
