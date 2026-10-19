# Filters layout

Import `Filters` and its query helpers from `@exre/exui`, with `@exre/exui/style.css` loaded once by the application.

Each built-in chip joins the field, operator, value and action into one outline. Internal corners stay square and shared edges stay single, including when application Tailwind utilities occupy a later CSS layer. Keep the toolbar free to wrap complete chips.

In narrow containers, labels stay on one line and long paths or operators shorten. The field's title, the chip's accessible name and the editor retain the full wording. Do not add wrapping or per-segment radius overrides to fit a chip.

These defaults apply to the built-in chip. A consumer supplying `renderChip` owns its custom layout and accessible names. Read the [family reference](../components/filters.md) for the query tree and editor APIs.
