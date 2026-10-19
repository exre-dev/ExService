<!-- Generated from resources/components/file-upload/c-file-upload-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Progress List

> Progress file upload

- Type: example, free and open source (MIT)
- Component: [File Upload](../file-upload.md)
- Page: [local reference](./c-file-upload-5.md)
- Uses: Alert, Badge, Button, Progress

## Best for

A stacked list of cards, each with a thin bar while sending and an inline retry alert, under completed, failed and uploading counts

## Agent notes

- `simulateUpload` runs a 500ms timer that advances progress and fails files at random; replace that effect with your upload's progress events
- `defaultImages` adds 2 finished grayscale picsum.photos rows; remove them or map the user's stored files

## When not to use

- Documents laid out in columns for name, type, size and actions: use [Table](./c-file-upload-6.md)

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
