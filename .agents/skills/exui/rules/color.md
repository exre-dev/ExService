# Color

## Semantic colors first

Use semantic variables for surfaces, text, borders, emphasis and state. ExUI supplies `background`, `foreground`, `card`, `popover`, `muted`, `primary`, `secondary`, `accent`, `destructive`, `border`, `ring`, `success`, `info`, `warning`, `focus` and `invert`, with their documented foreground partners.

These aliases already resolve through `--exui-*` Tokens. Use the shared theme values for feedback colors in a consuming app. Load [the appropriate stylesheet](../references/exui/setup.md) and read the [Token inventory](../references/generated/token-paths.md) for exact names.

## Meaning and identity

- A state uses a semantic component variant: `<Badge variant="success-light">Active</Badge>` or `<Alert variant="warning">`.
- A neutral label uses `Badge variant="outline"`; do not color every label.
- Categorical identity, such as chart series or team labels, can use a deliberate palette. Prefer `--chart-1` through `--chart-5` or `--exui-chart-*` when appropriate; verify every supported theme and add non-color labels.
- Read the installed variant before assuming a state `-foreground` variable is appropriate on a solid fill. Upstream light-status and solid-status variants have different text treatments.

## Theme and customization

Light, Dark and Pitch Black are separate Token palettes. The provider accepts only light/dark/system; read [theme usage](../references/exui/theme-usage.md) before implementing the third palette. Verify text, border, state and focus contrast in all palettes the application exposes.

Override semantic Tokens in unlayered CSS after ExUI's CSS. Root-level aliases and recipes reference them; scoped overrides can require redeclaring the dependent alias in the same scope. Follow [customization](../references/exui/token-customization.md) rather than duplicating fixed hex values. JavaScript Tokens stay deeply frozen and do not observe CSS overrides.
