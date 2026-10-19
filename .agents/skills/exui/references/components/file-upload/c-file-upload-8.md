<!-- Generated from resources/components/file-upload/c-file-upload-8.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Sortable Images

> Image upload with sorting.

- Type: example, free and open source (MIT)
- Component: [File Upload](../file-upload.md)
- Page: [local reference](./c-file-upload-8.md)
- Uses: Alert, Button, Card, Progress, Sortable

## Best for

A 5 column grid reordered by a grip handle on hover, where new images join the same order as the sample shots

## Agent notes

- Each reorder calls `toast` from sonner, which shows nothing unless your app mounts its Toaster
- The order lives only in `allImages` state; save it from the `Sortable` `onValueChange` handler
- `simulateUpload` ticks a fake percent every 100ms; replace it with your upload inside `addImages`

## When not to use

- Photos kept in the order they were added, with no dragging: use [Product Images](./c-file-upload-7.md)

## Third-party libraries

- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started)

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
