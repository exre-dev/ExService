<!-- Generated from resources/components/pagination/c-pagination-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Compact Go-To

> Pagination with go-to-page input

- Type: example, free and open source (MIT)
- Component: [Pagination](../pagination.md)
- Page: [local reference](./c-pagination-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/pagination.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/pagination.md
- Uses: Input, Pagination

## Best for

A 320px row fitting chevrons, pages 1 to 3 and an ellipsis beside a small Go to page number field

## Agent notes

- The number `Input` keeps `defaultValue` 1 and a fixed `max` of 10 with no handler; set `max` to your page count and jump on Enter
- The Go to page text is a plain `span`, not a label, so the `Input` has no accessible name; pass an `aria-label`

## When not to use

- A full width table footer with the jump field at the far edge: use [Full Width Go-To](./c-pagination-14.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Pagination

### When to use

- Numbered page links between previous and next controls under a list, a table or search results
- Compact pagers of back and forward controls alone or beside a page count, for narrow spaces
- Table footers pairing page controls with a rows per page select, a range count or a page jump field

### When not to use

- A records table that sorts and filters its rows and needs its pager built in: use [Data Grid](../data-grid.md)
- A whole table section with a title, toolbar, rows and a working pager: use the Base blocks
- Page controls kept in local state that run click handlers, with no URL per page: use [Button Group](../button-group.md)

### Agent notes

- `PaginationLink` renders its own anchor and takes neither `render` nor `asChild`; swap that anchor for your router link in your copy of the component
- Every `href` is a hash placeholder and each page number, count and current page is typed in; derive them from your page state or URL
