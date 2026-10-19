<!-- Generated from resources/components/attachment.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Attachment

> Open-source shadcn attachment components for chat composers, upload states, and file previews.

- Type: shadcn/ui component, free
- Page: [local reference](./attachment.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/attachment.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/attachment.md
- Examples: 6

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Attachment`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Attachment } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Attachment>) {
  return <Attachment {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI adaptation**

### Attachment media corners

`AttachmentMedia` follows the outer `Attachment` radius with an inset, concentric corner shape. This applies to image previews and icon or file media inside the attachment. Keep the media within `Attachment` so the shared geometry remains aligned when density and the outer radius change.
<!-- exui-capabilities:end:skill -->

## When to use

- Files carried by a chat turn, as chips in a composer tray or cards in an assistant reply
- Upload queues and pickers where each file reads as idle, uploading, processing, failed or done
- Rows of image thumbnails or file chips that scroll sideways on one line instead of wrapping

## When not to use

- A drop zone that takes files dragged in from the desktop: use [File Upload](./file-upload.md)
- A colored format badge that labels a document by its extension, such as PDF: use [File Type](./file-type.md)
- An upload list where each row needs a bar filling toward 100 percent: use [Progress](./progress.md)

## Agent notes

- `Attachment` uploads nothing and only styles the `state` you pass, so set `state` from your own transfer code
- The radix `Button` behind `AttachmentAction` sets no `type`, so pass `type` button inside a `form` or it submits

## Examples

- [Assistant Reply](./attachment/c-attachment-1.md): Single file attachment in an assistant reply. Best for a full width report card under a reply paragraph, with type and size and a secondary download button.
- [Composer Tray](./attachment/c-attachment-2.md): Composer tray with removable attachments. Best for a chat textarea topped by xs chips that scroll sideways, a paperclip that adds files and a live attached count.
- [Image Strip](./attachment/c-attachment-3.md): Image thumbnails in a snapping strip. Best for vertical image cards whose full card button marks one as pressed and prints its name and dimensions below.
- [Three Sizes](./attachment/c-attachment-4.md): Three sizes carrying three levels of an answer. Best for default, sm and xs cards stacked under text labels to rank a deliverable, its working files and cited snippets.
- [Upload Queue](./attachment/c-attachment-5.md): Upload queue across all five states. Best for each of the 5 states on its own row, with a spinner while uploading, a retry on the failure and cancel or remove labels by state.
- [File Picker](./attachment/c-attachment-6.md): File picker that fills an attachment tray. Best for a dashed idle card that opens the system dialog, then lists picks as sm rows with image previews, sizes and limit errors.
