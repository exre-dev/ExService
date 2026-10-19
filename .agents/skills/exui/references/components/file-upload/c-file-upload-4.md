<!-- Generated from resources/components/file-upload/c-file-upload-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Gallery

> Gallery file upload

- Type: example, free and open source (MIT)
- Component: [File Upload](../file-upload.md)
- Page: [local reference](./c-file-upload-4.md)
- Uses: Alert, Button, Dialog, Spinner

## Best for

A square image grid under a large drop zone, where a zoom button opens the full picture in a Dialog, with a total size and Clear all

## Agent notes

- `defaultImages` seeds 3 picsum.photos URLs through `initialFiles`; load the user's saved images there or drop the option
- The zoom and remove `Button` pair on each tile appears on hover only with no accessible names; add labels and a focus reveal

## When not to use

- Mixed documents where each one needs a progress bar and a retry: use [Progress List](./c-file-upload-5.md)

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
