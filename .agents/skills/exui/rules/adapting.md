# Adapt by reuse

## Preserve the component design

Change data, copy and documented props before changing structure. Preserve ExUI's selected Luma geometry, recipe-based controls, focus handling and overlay behavior. Use `size` and `variant` before layout classes; do not restyle package internals from the consuming app.

## Reuse local patterns

Read the relevant [component page](../references/components.md) and one matching `c-*` description. Reproduce the pattern through ExUI's public exports. These files document intent and gotchas; they do not contain complete example source. A described feature still needs a real handler, state or data source.

When given a docs example URL (`examples/<id>/`), read its static HTML or sibling `source.md` or `source.json` with an ordinary webpage reader. These files come from the same export and contain the example TSX, required local helpers, styles, setup, dependency versions and asset links. Recreate the listed relative paths or adapt the helpers into the consuming app. Keep source attribution, check the installed ExUI API, and replace sample data with application data. A locally generated reference can include unpublished library changes, so its version alone does not prove compatibility with an npm release.

## Read instead of guessing

Verify imports and props through the installed declaration and [export inventory](../references/generated/component-exports.md). ExUI uses Radix-derived primitives but some complex widgets use Base UI; choose composition syntax per component. A source-path import or an upstream API name is not proof of a public ExUI symbol.

## Wire real data

Use typed arrays and stable keys rather than duplicated JSX. Keep initialization schemas stable. Derive view state from data; use ExUI's form subscriptions when observing form values. Read browser-only APIs after mounting or in handlers when server rendering is possible. Use React `useId` for accessible identifiers.

Replace stub actions and sample values. Handle the region's loading, empty and error states; retain the draft on a recoverable save error. Confirm whether cancellation stops local writes or actually aborts a server operation.

For theme, icon and material changes, follow [color](color.md), [icons](icons.md), [Glass](../references/exui/glass.md) and [Shadows](../references/exui/shadows.md). Keep normal application code portable unless the host framework is required by the task.
