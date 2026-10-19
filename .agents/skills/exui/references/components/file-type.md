<!-- Generated from resources/components/file-type.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn File Type

> Open-source shadcn file type icon components for file extensions, export formats, and file browsers.

- Type: upstream component, free
- Page: [local reference](./file-type.md)
- Examples: 15

## When to use

- Attachment lists, upload queues and file browser rows, each icon resolved from a name or MIME type
- Export format pickers and legends of the formats a product accepts or produces
- Version tags, document codes and marks such as a lock or star drawn on a document

## When not to use

- A drop zone or picker that collects documents before they are sent: use [File Upload](./file-upload.md)
- Documents carried by a chat message as chips with idle, uploading and error states: use [Attachment](./attachment.md)
- A complete drive page with a folder tree, list and grid views and bulk actions: use the Files blocks

## Agent notes

- `type` takes an extension, not a file name: report.pdf passed straight in draws a neutral page labeled REPORT.PDF, so run names through `getFileType`
- `FileType` is not focusable and has no keyboard behavior, so an action goes on a wrapping `Button` or link with its own accessible name

## Third-party libraries

- TanStack Table v9: [API reference](https://tanstack.com/table/v9/docs/framework/react/reference/index), [docs](https://tanstack.com/table/v9/docs/framework/react/quick-start), used by 1 of 15 examples

## Examples

- [Common Formats](./file-type/c-file-type-1.md): Common formats. Best for a 5 column grid of 10 everyday formats in the default outline at 40px, uncaptioned because each icon names itself.
- [Variants](./file-type/c-file-type-2.md): Outline, solid, light and mono. Best for one row per variant over the same 5 types, PDF, DOCX, XLSX, JPG and ZIP, so only the paint changes between rows.
- [Sizes](./file-type/c-file-type-3.md): Sizes. Best for a PDF at each size preset from mini to xl, captioned with the prop value and its pixel box, bottoms aligned.
- [Family Glyphs](./file-type/c-file-type-4.md): Family glyphs. Best for all 13 family types from the exported category list, captioned by name, with the blank empty page placed last.
- [All Formats](./file-type/c-file-type-5.md): All formats. Best for the full extension table split into 11 family rows with counts, painted in whichever of 4 variant tabs is active.
- [File Browser](./file-type/c-file-type-6.md): Data grid file browser. Best for folders sorted ahead of files, a Type column filled from each family, and item counts in place of sizes for folders.
- [Attachment List](./file-type/c-file-type-7.md): Attachment list. Best for static rows pairing a light page with the name, size and a dated time element, ending in a ghost download button.
- [Upload Queue](./file-type/c-file-type-8.md): Upload queue. Best for a live count of uploaded and failed items above rows that swap a named bar for a size line, with retry and cancel.
- [Resolve From Name](./file-type/c-file-type-9.md): Resolve from a file name. Best for sample chips under one input with a clear button, the result in all 4 variants and a live Type and Family readout.
- [Custom Labels](./file-type/c-file-type-10.md): Custom labels. Best for a revision history newest first, rows tagged SIGNED or V1 to V3, under a large blank page carrying a CA-1042 code.
- [Custom Colors](./file-type/c-file-type-11.md): Custom colors and unknown types. Best for the same 4 CAD and 3D formats twice, on the default neutral page and then recolored teal, indigo, orange and rose.
- [Format Picker](./file-type/c-file-type-12.md): Export format picker. Best for a preselected PDF choice among 5, a button labeled with the picked extension, and a status line naming the result.
- [Locked & Starred](./file-type/c-file-type-13.md): Locked, linked and starred. Best for pairs of outline and solid pages for 6 states, from verified and hidden to uploading, captioned with state and format.
- [Restyled Labels](./file-type/c-file-type-14.md): Restyled labels. Best for each badge recipe printed beside its class string, from a pill and an inverted band to a DRAFT tag in amber.
- [Dotfiles & Build Names](./file-type/c-file-type-15.md): Dotfiles and build names. Best for a 2 column list of 12 repository entries, dotfiles and extensionless build scripts among them, each icon read from the name.
