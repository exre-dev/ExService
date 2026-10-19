<!-- Generated from resources/components/pagination/c-pagination-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn In Card

> Numbered pagination in card

- Type: example, free and open source (MIT)
- Component: [Pagination](../pagination.md)
- Page: [local reference](./c-pagination-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/pagination.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/pagination.md
- Uses: Card, Pagination

## Best for

A padded Card holding round chevrons, pages 1 to 3, an ellipsis, then 10 to 12, with page 1 filled in primary

## Agent notes

- The primary fill comes from a `className` keyed on `page` 1, apart from `isActive`; tie both to your current page

## When not to use

- Page links set straight on the page with no card around them: use [Basic](./c-pagination-1.md)

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
