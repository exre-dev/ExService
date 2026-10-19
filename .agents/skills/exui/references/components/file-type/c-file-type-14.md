<!-- Generated from resources/components/file-type/c-file-type-14.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Restyled Labels

> Restyled labels

- Type: example, free and open source (MIT)
- Component: [File Type](../file-type.md)
- Page: [local reference](./c-file-type-14.md)
- Uses: File Type

## Best for

Each badge recipe printed beside its class string, from a pill and an inverted band to a DRAFT tag in amber

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn File Type

### When to use

- Attachment lists, upload queues and file browser rows, each icon resolved from a name or MIME type
- Export format pickers and legends of the formats a product accepts or produces
- Version tags, document codes and marks such as a lock or star drawn on a document

### When not to use

- A drop zone or picker that collects documents before they are sent: use [File Upload](../file-upload.md)
- Documents carried by a chat message as chips with idle, uploading and error states: use [Attachment](../attachment.md)
- A complete drive page with a folder tree, list and grid views and bulk actions: use the Files blocks

### Agent notes

- `type` takes an extension, not a file name: report.pdf passed straight in draws a neutral page labeled REPORT.PDF, so run names through `getFileType`
- `FileType` is not focusable and has no keyboard behavior, so an action goes on a wrapping `Button` or link with its own accessible name
