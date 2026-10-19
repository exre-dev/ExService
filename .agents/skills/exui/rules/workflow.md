# Workflow: choose -> read -> adapt -> verify

## Choose the existing part

For a screen, start with [compose](compose.md). For one control, find its family in the [local catalog](../references/components.md). Read its when-to-use, when-not-to-use, agent notes and the closest `c-*` example description. A simple record table can use `Table`; sorting, paging, filtering or selection usually calls for `DataGrid`. Boards use `Kanban`; destructive confirmations use `AlertDialog`.

When the ExUI docs site is available, start at `/<locale>/docs/` to browse every family through representative previews and actual example counts, then open `/<locale>/docs/components/<family>/` (for example, `/en/docs/components/button/`) for a component page. Overview previews are inert; use the linked detail page to exercise controls. The same family has a local MDX source at `packages/docs/content/<locale>/components/<family>.mdx`. Preview density is scoped to examples. The local site may be built at `/` or the configured `EXUI_DOCS_BASE` subpath.

## Read the installed contract

Read [setup](../references/exui/setup.md), check the application's installed package version, and locate the exact public names in the [inventory](../references/generated/component-exports.md). Read the installed declaration for every unfamiliar prop. A local upstream page explains a pattern; its Base UI and Radix alternatives do not override ExUI's adapter.

For ExUI-native capabilities, read their own references before reaching for an upstream substitute: [Form](../references/exui/form.md), [Glass](../references/exui/glass.md), [Shadows](../references/exui/shadows.md), [Tokens](../references/exui/token-usage.md), [notifications](../references/exui/notifications.md).

## Adapt the pattern

Use public imports, typed data and stable identifiers. Replace sample actions with handlers. Use documented variants and sizes, semantic colors and Lucide icons. Preserve the working composition and keyboard behavior; make layout changes in the consuming page rather than editing package internals.

A downloaded example is a description, not a component you can import. Compose its behavior from the installed ExUI parts. If the needed API is absent in the installed version, explain the version gap and choose a supported composition.

## Verify

Check [quality](quality.md) and [anti-patterns](anti-patterns.md), then run the consuming project's applicable checks. Exercise changed keyboard, overlay, form and async states. Validate themes and viewport widths for visual changes. Report the layer actually checked; type checking alone does not establish rendered appearance.
