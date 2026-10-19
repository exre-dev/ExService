# Package and reference boundaries

Consume ExUI through the npm package `@exre/exui`. The package uses ExUI Tokens and Lucide icons; application registry settings do not replace its compiled styling or icons.

## Available contracts

- Public components, hooks, namespaces, and types: [export inventory](../references/generated/component-exports.md), verified against the installed package.
- Component patterns: [87 families and their local examples](../references/components.md).
- Forms, materials, and visual foundations: [Form](../references/exui/form.md), [Glass](../references/exui/glass.md), [Shadows](../references/exui/shadows.md), and [Tokens](../references/exui/token-usage.md).

Compose `c-*` patterns from public components. Pattern pages describe usage ideas; they do not define exports or guarantee that every alternative prop applies to ExUI.

## Public imports

Use the six supported entries in [setup](../references/exui/setup.md). Look up collision aliases in the export inventory and check exact props against the installed declarations.

## Reference sources

Local component links resolve inside this skill. Third-party API links supplement the ExUI contract. Source metadata is retained in the generated reference lock and the [third-party notice](../LICENSE.third-party.md).
