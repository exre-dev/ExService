<!-- Generated from resources/components/attachment/c-attachment-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Composer Tray

> Composer tray with removable attachments

- Type: example, free and open source (MIT)
- Component: [Attachment](../attachment.md)
- Page: [local reference](./c-attachment-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/attachment.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/attachment.md
- Uses: Attachment, Field, Input Group

## Best for

A chat textarea topped by xs chips that scroll sideways, a paperclip that adds files and a live attached count

## Agent notes

- The paperclip appends the next entry of `FILES` rather than opening a file dialog; wire a real picker as in `c-attachment-6`
- The `form` `onSubmit` only calls `preventDefault`, so Send posts nothing until you add your handler

## When not to use

- Picked files from the system dialog, checked against count, size and type limits: use [File Picker](./c-attachment-6.md)

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
