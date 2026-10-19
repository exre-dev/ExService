<!-- Generated from resources/components/file-upload.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn File Upload

> Open-source shadcn file upload components for drag-and-drop uploads, multi-file flows, and upload progress.

- Type: upstream component, free
- Page: [local reference](./file-upload.md)
- Examples: 10

## When to use

- Profile pictures and cover banners replaced by one pick or drop, with an instant local preview
- Multi file drop zones that check type, size and count, then list picks as thumbnails, cards or table rows
- Upload queues with per file progress and retry, and photo grids put in order by drag before saving

## When not to use

- Chips for files sent with a chat message, in the composer or the reply: use [Attachment](./attachment.md)
- A colored document icon labeled with its format, such as PDF or XLSX: use [File Type](./file-type.md)
- A meeting or booking form where an image drop is one field among many: use the Schedule blocks

## Agent notes

- No example sends a picked `File` to a server; picks stay in React state until you add the upload request

## Third-party libraries

- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 1 of 10 examples

## Examples

- [Basic](./file-upload/c-file-upload-1.md): Basic file upload. Best for a button beside a small square avatar slot that fills with the picked image, with its name and a Remove link below.
- [Avatar](./file-upload/c-file-upload-2.md): Avatar upload. Best for a round dashed avatar that is itself the click and drop target, with a corner X, a size hint and an error alert below.
- [Drag & Drop](./file-upload/c-file-upload-3.md): Basic drag and drop file upload. Best for a single row dashed strip holding an Add files button, 48px thumbnails in line and a count against the limit.
- [Gallery](./file-upload/c-file-upload-4.md): Gallery file upload. Best for a square image grid under a large drop zone, where a zoom button opens the full picture in a Dialog, with a total size and Clear all.
- [Progress List](./file-upload/c-file-upload-5.md): Progress file upload. Best for a stacked list of cards, each with a thin bar while sending and an inline retry alert, under completed, failed and uploading counts.
- [Table](./file-upload/c-file-upload-6.md): Table file upload. Best for rows in a Table with type and size columns, a ring around each icon while sending, and per row download, delete or retry.
- [Product Images](./file-upload/c-file-upload-7.md): Image upload. Best for product shots in a 4 column grid above a dashed Card drop area, with a progress card per new image that counts up its percent.
- [Sortable Images](./file-upload/c-file-upload-8.md): Image upload with sorting.. Best for a 5 column grid reordered by a grip handle on hover, where new images join the same order as the sample shots.
- [Preview Cards](./file-upload/c-file-upload-9.md): Card file upload.. Best for square preview cards in a grid of up to 6 columns, a ring over each while sending and a tooltip retry on failure.
- [Cover Image](./file-upload/c-file-upload-10.md): Cover image upload.. Best for a wide 21:9 banner with Change Cover and Remove on hover, a percent ring while sending and an image guidelines box below.
