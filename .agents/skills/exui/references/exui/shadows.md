# ExUI shadows and elevation

Select the shadow layer the actual surface consumes. ExUI exposes both reusable shadow data and component-specific styling; changing one variable does not restyle every component.

## Four sources

| Source            | Public data / CSS                                                                                       | Purpose                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Foundation        | `exuiTokens.shadows.small/medium/large/focus/invalid`; `--exui-shadow-small/medium/large/focus/invalid` | Reusable elevation and focus/invalid rings                                      |
| Theme semantic    | `exuiTokens.themes.light.shadow` (also dark/pitchBlack); `--exui-shadow-card/modal/menu`                | Themed Card, dialog and popup elevation                                         |
| Component recipes | `componentRecipes` references and `--exui-component-*-shadow`                                           | A component's state-specific shadow, such as menu surface or form-control focus |
| Luma utility      | The component's own classes, such as Card's `shadow-md`                                                 | Some component surfaces retain Tailwind utility shadows                         |

Read the [exact inventory](../generated/token-paths.md) rather than inventing names. Theme-specific `shadow.card` and foundation `shadows.small` are distinct paths. Values are CSS shadow strings; do not convert them with parseFloat or assume they scale with rem. Built-in elevation/focus shadows intentionally retain fixed-pixel lengths.

## Custom surface

```css
.settings-panel {
  background: var(--exui-surface-card);
  color: var(--exui-text-primary);
  border-radius: var(--exui-radius-large);
  padding: 1rem;
  box-shadow: var(--exui-shadow-card);
}
```

For non-CSS rendering or another theme system:

```ts
import { exuiTokens } from '@exre/exui/tokens'

const themeElevation = exuiTokens.themes.dark.shadow.menu
const focusRing = exuiTokens.shadows.focus
```

JS data is frozen built-in data. CSS overrides do not change those values. Prefer CSS variables for live theming.

## Override the consumer's layer

Place unlayered root/theme overrides after ExUI CSS, as in [Token customization](token-customization.md). A recipe that references a foundation or semantic Token follows root-level changes. A recipe with a literal value needs its own recipe variable. A Luma component using `shadow-md` follows Tailwind's utility layer, not an unused `--exui-shadow-card` value; preserve its default or customize the actual utility in a deliberate app scope.

For a local control change, preserve ordinary, focus-visible, invalid and disabled states. Replacing `box-shadow` indiscriminately can remove focus or invalid rings; do not set `shadow-none` just to obtain a flatter surface without checking keyboard/error feedback.

## Glass composition

[Glass](glass.md) adds an inset edge and white highlight while retaining the host's outer shadow and Tailwind ring variables. Its edge is not a border and does not affect layout. The public `--exui-glass-shadow` customizes only the material edge, not outer elevation.

Use the supported component's `glass` prop, its existing variants and public Tokens. A plain `ex-glass` element can use a normal Tailwind `shadow-*` utility: the material includes Tailwind's shadow in its composition. Avoid a later raw `box-shadow` declaration on the glass element, which can replace that composition. Private `--_exui-glass-*` runtime variables are implementation details, not consumer configuration.

If changing `--exui-glass-border` only in a subtree, also redeclare the referencing `--exui-glass-shadow` in that scope so it resolves to the new edge color. Do not animate box-shadow, blur or backdrop-filter; keep elevation static and animate transform or a separate layer's opacity. Check the result in Light, Dark, Pitch Black and focus/invalid states that the app supports.
