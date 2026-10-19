<!-- Generated from resources/components/file-upload/c-file-upload-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Avatar

> Avatar upload

- Type: example, free and open source (MIT)
- Component: [File Upload](../file-upload.md)
- Page: [local reference](./c-file-upload-2.md)
- Uses: Alert, Button

## Best for

A round dashed avatar that is itself the click and drop target, with a corner X, a size hint and an error alert below

## Agent notes

- `defaultAvatar` shows a saved image, but the corner X renders only for a new pick, so a saved avatar cannot be cleared here
- `onFileChange` fires with null before every new pick as well as on removal, so a null alone does not mean the user cleared it

## When not to use

- A profile picture displayed read only, with nothing to pick or drop: use [Avatar](../avatar.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn File Upload

### When to use

- Profile pictures and cover banners replaced by one pick or drop, with an instant local preview
- Multi file drop zones that check type, size and count, then list picks as thumbnails, cards or table rows
- Upload queues with per file progress and retry, and photo grids put in order by drag before saving

### When not to use

- Chips for files sent with a chat message, in the composer or the reply: use [Attachment](../attachment.md)
- A colored document icon labeled with its format, such as PDF or XLSX: use [File Type](../file-type.md)
- A meeting or booking form where an image drop is one field among many: use the Schedule blocks

### Agent notes

- No example sends a picked `File` to a server; picks stay in React state until you add the upload request
