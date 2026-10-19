<!-- Generated from resources/components/skeleton.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Skeleton

> Open-source shadcn skeleton components for loading placeholders, perceived performance, and content previews.

- Type: shadcn/ui component, free
- Page: [local reference](./skeleton.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/skeleton.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/skeleton.md
- Examples: 10

## When to use

- Placeholders for avatars and user info, text paragraphs, forms and media cards while data loads
- Loading states for data tables, dashboard stats, lists with row actions, profile pages and chat threads

## When not to use

- Sortable record tables that draw their own placeholder rows during a fetch: use [Data Grid](./data-grid.md)
- Menu links in an app navigation rail that are still being fetched: use [Sidebar](./sidebar.md)
- A wait whose result has no known shape, such as a file being processed: use [Spinner](./spinner.md)

## Agent notes

- `Skeleton` has no size of its own, so every placeholder here sets its height and width by class; size yours to the content it stands in for
- `Skeleton` is a bare div with no role or text, so screen readers hear nothing; set aria-busy on the region it fills while loading
- The default radius of `Skeleton` follows the style, square in lyra and sera and rounded-2xl in luma and rhea; circles need rounded-full

## Examples

- [Avatar Info](./skeleton/c-skeleton-1.md): Skeleton loader for avatars and user info.. Best for a 48px avatar circle beside 2 fixed width text bars, the second shorter, with no card around them.
- [Card](./skeleton/c-skeleton-2.md): Skeleton loader for a card component.. Best for a card that opens with 2 title bars of falling width above a 16:9 media block, with no footer.
- [Text Paragraphs](./skeleton/c-skeleton-3.md): Skeleton loader for text and paragraphs.. Best for body copy in 2 paragraphs of full width lines, each closing on a shorter line, with no heading or image.
- [Form](./skeleton/c-skeleton-4.md): Skeleton loader for a form.. Best for a stack of 2 label bars over full width input bars, closed by one shorter button bar.
- [Data Table](./skeleton/c-skeleton-5.md): Skeleton loader for a data table.. Best for a 3 column header row with a bottom border over 4 body rows, laid out with flex divs, not table markup.
- [Stats Row](./skeleton/c-skeleton-6.md): Skeleton loader for a dashboard stats row. Best for a row of 3 metric cards, each a small label bar over a tall value bar and a caption line.
- [List With Actions](./skeleton/c-skeleton-7.md): Skeleton loader for a list with actions. Best for a titled list with a header button bar over 3 divided rows of avatar, 2 text lines and a trailing action bar.
- [Card Grid](./skeleton/c-skeleton-8.md): Skeleton loader for a card grid. Best for a card led by a 16:9 media block, then a heading bar and 2 copy lines over a footer with a wide and a square button bar.
- [Profile Page](./skeleton/c-skeleton-9.md): Skeleton loader for a full profile page. Best for a profile card with an 80px avatar, name lines and 3 stat pairs, above a details card of 4 label and value rows.
- [Chat Messages](./skeleton/c-skeleton-10.md): Skeleton loader for chat messages. Best for incoming bubbles with an avatar and sender bar, one outgoing bubble on the right and a reply field with a square button bar.
