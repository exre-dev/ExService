<!-- Generated from resources/components/collapsible.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Collapsible

> Open-source shadcn collapsible components for expandable sections, detail rows, and progressive disclosure.

- Type: shadcn/ui component, free
- Page: [local reference](./collapsible.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/collapsible.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/collapsible.md
- Examples: 10

## When to use

- Cards and panels that hold back secondary detail, such as order items, a usage breakdown or a profile
- Optional settings, advanced form fields and single help answers kept closed until asked for
- Nested navigation menus and file trees, built by placing one collapsible inside another

## When not to use

- Several stacked sections that open and close as one group, often one at a time: use [Accordion](./accordion.md)
- A large folder hierarchy that people move through and expand with arrow keys: use [Tree](./tree.md)
- A complete account or workspace configuration page of grouped switch rows: use the Settings blocks

## Agent notes

- The trigger's `aria-expanded` carries open state in both twins and stays scoped when collapsibles nest, so key chevrons and fills on it
- A closed `CollapsibleContent` renders none of its children in either twin, so that text is missing from the server HTML
- Base UI `CollapsibleTrigger` swaps its element through `render` and the Radix one through `asChild`; each reads only its own prop

## Examples

- [Basic](./collapsible/c-collapsible-1.md): Basic collapsible. Best for an order summary that keeps its status row in view and opens the shipping address and items from an icon button.
- [Checkbox Settings](./collapsible/c-collapsible-2.md): Collapsible with checkbox settings. Best for a full-width outline button that opens a card of 3 notification channel checkboxes, starting open.
- [Animated Card](./collapsible/c-collapsible-3.md): Collapsible animated card. Best for a single help question in a small card, where the whole question line opens its answer below.
- [Bottom Trigger](./collapsible/c-collapsible-4.md): Collapsible card with bottom trigger. Best for a billing usage card with a progress bar whose round chevron button, centered on the bottom edge, opens a cost breakdown.
- [Form Fields](./collapsible/c-collapsible-5.md): Collapsible form fields. Best for a price input with a sliders icon button beside it that reveals tax rate and discount fields, its open state held in React state.
- [In Frame](./collapsible/c-collapsible-6.md): Collapsible frame. Best for a deployment status note in a stacked Frame, open on load, its whole header row toggling the release summary.
- [Nested List](./collapsible/c-collapsible-7.md): Nested collapsible list with actions. Best for a list of 3 API keys under a toggling Frame header, each row's menu copying its key or deleting the row.
- [User Profile](./collapsible/c-collapsible-8.md): Collapsible User profile. Best for a user handle with avatar that opens to last activity, an online since time and a country flag for location.
- [Multi-Level Menu](./collapsible/c-collapsible-9.md): Multi-level collapsible menu. Best for a 3 level navigation menu of icon rows where folders open in place and the chosen leaf row stays highlighted.
- [File Tree](./collapsible/c-collapsible-10.md): Tree view with file actions. Best for a code file explorer under Explorer and Outline tabs, file rows showing download and delete buttons on hover or selection.
