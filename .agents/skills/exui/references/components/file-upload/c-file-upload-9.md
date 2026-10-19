<!-- Generated from resources/components/file-upload/c-file-upload-9.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Preview Cards

> Card file upload.

- Type: example, free and open source (MIT)
- Component: [File Upload](../file-upload.md)
- Page: [local reference](./c-file-upload-9.md)
- Uses: Alert, Button, Tooltip

## Best for

Square preview cards in a grid of up to 6 columns, a ring over each while sending and a tooltip retry on failure

## Agent notes

- `defaultFiles` points 2 of its 3 samples at /media/files placeholder paths; swap in the user's stored files
- `simulateUpload` fakes progress and fails about 1 in 10 files at the end; feed real upload events into `uploadFiles` instead

## When not to use

- Documents listed as rows with type and size columns: use [Table](./c-file-upload-6.md)

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
