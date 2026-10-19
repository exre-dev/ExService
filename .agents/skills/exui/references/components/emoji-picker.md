<!-- Generated from resources/components/emoji-picker.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Emoji Picker

> Open-source shadcn emoji picker components for message composers, reactions, page icons, statuses, and custom team emoji.

- Type: upstream component, free
- Page: [local reference](./emoji-picker.md)
- Examples: 8

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI additions and adaptations**

### Search visibility and default layout

`EmojiPicker` accepts `hideSearch?: boolean`, defaulting to `false`. Set it to `true` to omit the search field from both inline panels and popovers. It also applies to an explicitly composed `EmojiPickerSearch`. Category browsing and keyboard selection remain available; a popup without search focuses its emoji grid.

The default panel contains search, categories and the emoji grid. It has no information footer, preview or skin-tone selector. `EmojiPickerFooter`, `EmojiPickerPreview` and `EmojiPickerSkinTone` remain available for explicit custom compositions. `hideSearch` controls the search UI without clearing an existing `query`.

```tsx verify
import { EmojiPicker, EmojiPickerPanel } from '@exre/exui'

export function BrowseEmoji() {
  return (
    <EmojiPicker hideSearch>
      <EmojiPickerPanel />
    </EmojiPicker>
  )
}
```

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Message composers, replies and notes that insert emoji at the caret of a text field
- Reactions on posts and messages, added from a popover beside the reaction pills
- A single stored emoji such as a page icon or a profile status, kept inline or behind a trigger

## When not to use

- A finished assistant conversation screen around a composer: use the AI Chat blocks
- Rendering a conversation as bubbles with avatars, names and times: use [Message](./message.md)
- A hue chosen from swatches, a spectrum or a typed hex value: use [Color Picker](./color-picker.md)

## Agent notes

- Left unset, `value` keeps each pick as the picker's value and `EmojiPickerTrigger` draws it in place of its default smiley; insert-only pickers pass null
- By default every picker on the origin shares recent emoji and skin tone through localStorage; scope them with `recentStorageKey` and `skinToneStorageKey`

## Examples

- [Inline](./emoji-picker/c-emoji-picker-1.md): Inline emoji picker. Best for the default panel with no composed parts, always open in a card and holding one controlled value with no trigger.
- [Chat Composer](./emoji-picker/c-emoji-picker-2.md): Chat composer. Best for a bubble thread that scrolls to each send, where your follow-ups join your last bubble group.
- [Message Reactions](./emoji-picker/c-emoji-picker-3.md): Message reactions. Best for reaction pills split by skin tone with counts, plus a row of 6 one click reactions composed above the search.
- [Page Icon](./emoji-picker/c-emoji-picker-4.md): Page icon. Best for a large stored glyph that is its own trigger, swapping to an Add icon button once removed, echoed in the breadcrumb.
- [Custom Team Emoji](./emoji-picker/c-emoji-picker-5.md): Custom team emoji. Best for image tiles under a logo tab ordered ahead of Frequently used, stored as colon codes and drawn back as images in posts.
- [Shortcode Suggestions](./emoji-picker/c-emoji-picker-6.md): Shortcode suggestions. Best for a combobox list of 5 ranked matches driven by arrow keys, Tab or Enter, plus an instant swap of a closed colon code.
- [Workplace-Safe Set](./emoji-picker/c-emoji-picker-7.md): Workplace-safe set. Best for browse tabs without nature, food, travel or flags for a textarea that spaces each pick off its neighbors, with Undo after posting.
- [Localized Labels](./emoji-picker/c-emoji-picker-8.md): Localized data and labels. Best for a language select that swaps the emoji data and the picker's labels and clears the search, in a panel fitted to the card inset.
