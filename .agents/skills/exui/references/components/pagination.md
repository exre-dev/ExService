<!-- Generated from resources/components/pagination.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Pagination

> Open-source shadcn pagination components for table pagination, search results, and content archives.

- Type: shadcn/ui component, free
- Page: [local reference](./pagination.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/pagination.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/pagination.md
- Examples: 15

## When to use

- Numbered page links between previous and next controls under a list, a table or search results
- Compact pagers of back and forward controls alone or beside a page count, for narrow spaces
- Table footers pairing page controls with a rows per page select, a range count or a page jump field

## When not to use

- A records table that sorts and filters its rows and needs its pager built in: use [Data Grid](./data-grid.md)
- A whole table section with a title, toolbar, rows and a working pager: use the Base blocks
- Page controls kept in local state that run click handlers, with no URL per page: use [Button Group](./button-group.md)

## Agent notes

- `PaginationLink` renders its own anchor and takes neither `render` nor `asChild`; swap that anchor for your router link in your copy of the component
- Every `href` is a hash placeholder and each page number, count and current page is typed in; derive them from your page state or URL

## Examples

- [Basic](./pagination/c-pagination-1.md): Basic pagination.. Best for the stock pattern: labeled Previous and Next around 3 page links, with page 2 outlined as current.
- [No Labels](./pagination/c-pagination-2.md): Pagination without labels.. Best for chevron only arrows with aria labels and no Previous or Next text, around 3 numbers with page 2 current.
- [Hover Border](./pagination/c-pagination-3.md): Pagination with hover effect.. Best for labeled Previous and Next around 3 pages whose idle numbers draw a border on hover, like the outlined current page.
- [Circle Buttons](./pagination/c-pagination-4.md): Pagination with circle buttons.. Best for fully round page buttons and pill shaped Previous and Next, with page 2 outlined as current.
- [Compact Go-To](./pagination/c-pagination-5.md): Pagination with go-to-page input. Best for a 320px row fitting chevrons, pages 1 to 3 and an ellipsis beside a small Go to page number field.
- [In Card](./pagination/c-pagination-6.md): Numbered pagination in card. Best for a padded Card holding round chevrons, pages 1 to 3, an ellipsis, then 10 to 12, with page 1 filled in primary.
- [Arrow Links](./pagination/c-pagination-7.md): Pagination with arrows buttons. Best for two text links with straight arrow icons pushed to opposite ends of a narrow row, and no page numbers at all.
- [Centered Page Info](./pagination/c-pagination-8.md): Pagination with page info on center. Best for chevron arrows at both ends of a 320px row with a centered Page 1 of 10 count between them.
- [Left Page Info](./pagination/c-pagination-9.md): Pagination with page info on left. Best for a Page 1 of 10 count on the left, with labeled Previous and Next grouped together on the right.
- [Trailing Ellipsis](./pagination/c-pagination-10.md): Pagination with ellipsis indicator. Best for labeled arrows around pages 1 to 4 and a trailing ellipsis, with no last page link after it.
- [Outline Strip](./pagination/c-pagination-11.md): Pagination with outline style buttons. Best for one bordered strip of joined square cells split by dividers, with a muted fill on the current page.
- [Rows Per Page](./pagination/c-pagination-12.md): Rows per page select with range info and first/prev/next/last icons. Best for a footer with no page numbers: a rows per page select on the left, and a 1-25 of 100 range with 4 jump icons on the right.
- [Page Select](./pagination/c-pagination-13.md): Pagination with page select dropdown and first/last navigation. Best for a Page 1 to Page 10 dropdown flanked by first, previous, next and last icon links, with no numbered links.
- [Full Width Go-To](./pagination/c-pagination-14.md): Numbered pagination with go-to-page input. Best for chevrons and pages 1 to 4 on the left of a full width row, with the page number field at the far right.
- [Info & Per-Page](./pagination/c-pagination-15.md): Pagination with page info, numbered pages, ellipsis, and per-page select. Best for a 3 part footer: a Page 1 of 10 count, labeled arrows around pages 1 to 4 and a per page select.
