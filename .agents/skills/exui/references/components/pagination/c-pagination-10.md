<!-- Generated from resources/components/pagination/c-pagination-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Trailing Ellipsis

> Pagination with ellipsis indicator

- Type: example, free and open source (MIT)
- Component: [Pagination](../pagination.md)
- Page: [local reference](./c-pagination-10.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/pagination.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/pagination.md
- Uses: Pagination

## Best for

Labeled arrows around pages 1 to 4 and a trailing ellipsis, with no last page link after it

## When not to use

- A long range that keeps the last pages in view after the ellipsis: use [In Card](./c-pagination-6.md)

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
