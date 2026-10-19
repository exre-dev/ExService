<!-- Generated from resources/components/file-upload/c-file-upload-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Table

> Table file upload

- Type: example, free and open source (MIT)
- Component: [File Upload](../file-upload.md)
- Page: [local reference](./c-file-upload-6.md)
- Uses: Alert, Badge, Button, Table

## Best for

Rows in a Table with type and size columns, a ring around each icon while sending, and per row download, delete or retry

## Agent notes

- The download `Button` in each row has no `onClick`; point it at the file's `preview` URL or your storage link
- `defaultFiles` seeds 4 finished rows whose /media/files URLs are placeholders; replace them with the user's stored files
- `simulateUpload` fakes progress on a timer and marks about 1 in 10 finished files as failed; wire real upload events instead

## When not to use

- A lighter list of cards with a bar under each name and no columns: use [Progress List](./c-file-upload-5.md)

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
