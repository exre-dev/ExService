# Customize ExUI Tokens

Use CSS overrides to adapt ExUI colors, typography, and radii. Load the appropriate stylesheet from [React setup](setup.md) or [Token usage](token-usage.md) first. JavaScript Token objects are deeply frozen data; CSS overrides do not mutate them.

## Override at the theme root

Place unlayered declarations after the ExUI stylesheet. ExUI emits its Token declarations outside `@layer`, so a normal override inside `@layer base` or Tailwind `@theme` loses to those declarations.

```css
@import '@exre/exui/style.css';

:root {
  --exui-control-primary: #0f62fe;
  --exui-control-primary-foreground: #ffffff;
  --exui-font-family: 'Inter', sans-serif;
  --exui-radius-extra-large: 0.75rem;
}

.dark {
  --exui-control-primary: #6ea8ff;
  --exui-control-primary-foreground: #0b0b0b;
}
```

Load your chosen font separately. This example changes the primary fill and its label; customize hover, active, link, and focus Tokens separately when the full brand palette must change. Check their contrast and rendered interaction states after overriding them.

Light is declared on `:root`. `.dark` and `.pitch-black` declare only values that differ from Light. When the theme class is on the root element, a later `:root` rule has the same specificity and can override all three themes. Place explicit `.dark` and `.pitch-black` overrides after it when those palettes need different values. A `.dark` override also applies to Pitch Black only when the element actually carries both classes.

For subtree themes, declare overrides on the themed element. A declaration on a descendant takes precedence over an inherited root value regardless of the root rule's specificity. Portal content follows the DOM container it renders into, so prefer document-root theming or arrange matching variables on the portal container.

## Choose the variable family

| Goal                            | Variables                                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recolor product UI              | `--exui-surface-*`, `--exui-text-*`, `--exui-control-*`, `--exui-border-*`, `--exui-feedback-*`, `--exui-sidebar-*`, `--exui-editor-*`, `--exui-chart-*` |
| Change fonts and ordinary radii | `--exui-font-*`, `--exui-line-height-*`, `--exui-radius-*`                                                                                               |
| Change foundation shadows       | `--exui-shadow-*`                                                                                                                                        |
| Tune a specific recipe field    | `--exui-component-*`                                                                                                                                     |
| Restyle translucent surfaces    | `--exui-glass-*`; read [Glass material](glass.md) for states, fallback colors, and composition                                                           |

Use the [generated Token inventory](../generated/token-paths.md) for exact names. Recipe values that reference semantic or foundation Tokens are emitted as `var(--exui-…)`, so root-level overrides propagate to those recipes. Literal recipe fields stay independent: the button action radius, dialog radius, and menu radius use their own recipe variables. `--radius` references `--exui-radius-large` and feeds the component stylesheet's Tailwind radius scale.

The short semantic aliases (`--background`, `--primary`, `--ring`, `--sidebar-*` and feedback names) reference their `--exui-*` Tokens. A root-level Token override propagates through those references; do not duplicate fixed colors into both families. For a subtree-only override, redeclare the dependent alias in that same scope when an inherited alias already resolved at the theme root. This also applies to the [Fumadocs theme](docs-theme.md).

CSS variable references resolve where the referencing variable is declared. If you override a foundation value only on a child, an inherited recipe variable may already contain its root-resolved value. Prefer root-level foundation overrides; for a local component adjustment, redeclare the relevant recipe variable on that component or scope as well.

`.density-compact` changes applicable default basic controls through `--density-*`. It does not uniformly resize explicit sizes or complex widgets. See [scaling](scaling.md) for the control scope and root-font rules.
