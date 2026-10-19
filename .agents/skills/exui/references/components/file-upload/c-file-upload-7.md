<!-- Generated from resources/components/file-upload/c-file-upload-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Product Images

> Image upload

- Type: example, free and open source (MIT)
- Component: [File Upload](../file-upload.md)
- Page: [local reference](./c-file-upload-7.md)
- Uses: Alert, Button, Card, Progress

## Best for

Product shots in a 4 column grid above a dashed Card drop area, with a progress card per new image that counts up its percent

## Agent notes

- `simulateUpload` fakes progress with a 100ms timer per image; send the file to your API from `addImages` instead
- `visibleDefaultImages` holds 4 picsum.photos samples in their own grid apart from new uploads; replace or drop them
- `onUploadComplete` is passed the list from before the new image was added, so read `images` state for the finished set

## When not to use

- Product shots the user drags into a display order before saving: use [Sortable Images](./c-file-upload-8.md)

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
