<!-- Generated from resources/components/file-upload/c-file-upload-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Cover Image

> Cover image upload.

- Type: example, free and open source (MIT)
- Component: [File Upload](../file-upload.md)
- Page: [local reference](./c-file-upload-10.md)
- Uses: Alert, Button

## Best for

A wide 21:9 banner with Change Cover and Remove on hover, a percent ring while sending and an image guidelines box below

## Agent notes

- The empty state prints Max size 5MB as fixed text, so edit it whenever you change `maxSize`
- `simulateUpload` fakes the percent ring on a 200ms timer; start your real upload where `onImageChange` fires
- `defaultCoverImage` is a picsum.photos placeholder; pass the saved cover or start `coverImage` at null

## When not to use

- Several product photos shown side by side in a grid: use [Product Images](./c-file-upload-7.md)

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
