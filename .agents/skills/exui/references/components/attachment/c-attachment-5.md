<!-- Generated from resources/components/attachment/c-attachment-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Upload Queue

> Upload queue across all five states

- Type: example, free and open source (MIT)
- Component: [Attachment](../attachment.md)
- Page: [local reference](./c-attachment-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/attachment.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/attachment.md
- Uses: Attachment, Spinner

## Best for

Each of the 5 states on its own row, with a spinner while uploading, a retry on the failure and cancel or remove labels by state

## Agent notes

- `retry` flips the row straight to done with a fixed 640 KB size; call your upload again there
- `dismiss` only drops the row from local state, so abort the in flight transfer there as well

## When not to use

- Transfers that need a bar filling toward 100 percent on each row: use [Progress](../progress.md)
- Rows led by a colored badge naming each format, such as PDF or MP4: use [File Type](../file-type.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Attachment

### When to use

- Files carried by a chat turn, as chips in a composer tray or cards in an assistant reply
- Upload queues and pickers where each file reads as idle, uploading, processing, failed or done
- Rows of image thumbnails or file chips that scroll sideways on one line instead of wrapping

### When not to use

- A drop zone that takes files dragged in from the desktop: use [File Upload](../file-upload.md)
- A colored format badge that labels a document by its extension, such as PDF: use [File Type](../file-type.md)
- An upload list where each row needs a bar filling toward 100 percent: use [Progress](../progress.md)

### Agent notes

- `Attachment` uploads nothing and only styles the `state` you pass, so set `state` from your own transfer code
- The radix `Button` behind `AttachmentAction` sets no `type`, so pass `type` button inside a `form` or it submits
