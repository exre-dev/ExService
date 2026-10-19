<!-- Generated from resources/components/collapsible/c-collapsible-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Checkbox Settings

> Collapsible with checkbox settings

- Type: example, free and open source (MIT)
- Component: [Collapsible](../collapsible.md)
- Page: [local reference](./c-collapsible-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/collapsible.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/collapsible.md
- Uses: Button, Card, Checkbox, Collapsible, Field

## Best for

A full-width outline button that opens a card of 3 notification channel checkboxes, starting open

## Agent notes

- Replace `settings` with your channels; each `Checkbox` takes only `defaultChecked`, so no choice is read or saved yet

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Collapsible

### When to use

- Cards and panels that hold back secondary detail, such as order items, a usage breakdown or a profile
- Optional settings, advanced form fields and single help answers kept closed until asked for
- Nested navigation menus and file trees, built by placing one collapsible inside another

### When not to use

- Several stacked sections that open and close as one group, often one at a time: use [Accordion](../accordion.md)
- A large folder hierarchy that people move through and expand with arrow keys: use [Tree](../tree.md)
- A complete account or workspace configuration page of grouped switch rows: use the Settings blocks

### Agent notes

- The trigger's `aria-expanded` carries open state in both twins and stays scoped when collapsibles nest, so key chevrons and fills on it
- A closed `CollapsibleContent` renders none of its children in either twin, so that text is missing from the server HTML
- Base UI `CollapsibleTrigger` swaps its element through `render` and the Radix one through `asChild`; each reads only its own prop
