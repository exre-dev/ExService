# ExUI Token Usage

Use `@exre/exui/tokens` when a consuming project needs ExUI's visual contract without React. Use `@exre/exui` for React components instead of recreating those components from Tokens. Both entries ship from the same package, so one install covers either need.

## Install and import

Tokens are framework-neutral and require no React, React DOM, or React type packages:

```bash
pnpm add @exre/exui
```

```ts
import { componentRecipes, exuiTokens } from '@exre/exui/tokens'
import '@exre/exui/tokens/style.css'
```

Import `@exre/exui/tokens/font.css` separately only when the consumer wants the ExUI font assets. The JavaScript tokens entry also supports CommonJS through the package's declared require export.

For React components:

```tsx
import '@exre/exui/style.css'
import { Button } from '@exre/exui'
```

React consumers additionally install `react@19` and `react-dom@19`, which are optional peers. TypeScript consumers also install `@types/react@19` and `@types/react-dom@19`; the type packages are not declared peers or transitive dependencies.

`@exre/exui/style.css` already includes the Token stylesheet and font stylesheet. Do not import either Token CSS file again in the same React application path.

## Choose the right layer

Use the most semantic public expression that fits:

1. Prefer theme semantic Tokens for product UI: `surface`, `text`, `control`, `border`, `feedback`, `editor`, `chart`, `sidebar`, theme `shadow`, and `glass` for translucent materials.
2. Use `componentRecipes` only when a non-React consumer needs to reproduce the visual contract for `button`, `formControl`, `sidebarItem`, `menu`, `dialog`, or `tabs`.
3. Use `density`, `typography`, `radii`, and foundation `shadows` directly only when the semantic and recipe layers cannot express the requirement.

Do not copy resolved colors, lengths, shadows, or typography values into application code when a public Token path or CSS custom property expresses the intent.

## JavaScript Tokens and CSS variables

- Use `exuiTokens` when code needs typed, framework-neutral Token paths or must adapt ExUI into another theme system.
- Use `componentRecipes` for non-React component geometry, typography, states, motion, and variants. Recipe references point back to public semantic or foundation Tokens; do not treat them as a second React component API.
- Use `@exre/exui/tokens/style.css` when styling can consume CSS custom properties directly. The stylesheet exposes Light under `:root`, Dark under `.dark`, and Pitch Black under `.pitch-black`.

Consult the [generated Token path inventory](../generated/token-paths.md) for exact `exuiTokens` paths, `componentRecipes` paths, and CSS custom-property names. That inventory lists the built-in names, not runtime CSS override results.

To override colors, fonts, radii, or individual recipes, read [Token customization](token-customization.md). It covers unlayered overrides, the referencing semantic aliases, and root versus subtree scope.

Each current `ThemeTokens` object requires a `glass` group. If you maintain complete custom themes, copy a built-in group's values before customizing them. Token-only CSS provides the material variables; the `.ex-glass` class behavior requires `@exre/exui/style.css` as described in [Glass material](glass.md).

## Density

`exuiTokens.density` publishes two sets of control geometry, `standard` and `compact` — control height, inline padding, control radius, control gap, and icon size. The stylesheet emits them as five `--density-*` custom properties: the `standard` values under `:root`, and a `.density-compact` block that overrides all five. Apply the class to the root element or any ancestor; it is a separate axis from the theme classes, so it combines with `.dark` or `.pitch-black`.

Default Button, Input, Textarea, Select, NativeSelect and InputGroup consume the applicable density variables. Explicit sizes and complex widget geometry are not guaranteed to follow this class. Read `exuiTokens.density` directly for custom CSS, and verify the particular control at its selected size.

## Sizing and root font size

For custom React components and content, follow the standalone [ExUI scaling rules](scaling.md). That file can be copied directly into another project's AI instructions; the Token-specific conversion details follow here.

Scalable length Tokens are published in `rem` against a 16px base, so a 16px root font size reproduces the original pixel design exactly. Setting a different root font size scales ExUI's type, control heights, padding, gaps, icons, and ordinary radii together:

```css
html {
  font-size: 20px; /* every scalable ExUI length grows by 20 / 16 */
}
```

Library code never sets a root font size and declares no scale variable; the root font size is an application decision. Keep it at `16px` to preserve the previous rendering. A changed root font size also affects every other `rem` value in the application, and percentages, `em` tracking, and `auto` keep their usual meaning.

These stay fixed on purpose: hairline borders and dividers (`componentRecipes.menu.separator.thickness` is `1px`), focus rings, foundation and theme drop shadows, `radii.none` (`0`), and `radii.full` (`9999px`). Glass blur is `0.25rem` and the inset edge is `0.0625rem`; both scale. The token checks enforce these built-in values, and `componentRecipes.menu.shortcut.letterSpacing` stays an `em` value that follows its own font size.

Because token values now carry the `rem` unit, do not read them with `parseFloat(token)` and treat the result as pixels. Pass the string to CSS unchanged. When an application really needs pixels, note which kind of value it holds:

- A scalable token such as `exuiTokens.density.standard.controlHeight` (`"2.25rem"`) is a rem value, so multiply it by the root font size: `Number.parseFloat(token) * rootFontSize`.
- A value quoted from the pre-migration pixel design is a 16px-base measurement, so scale it instead: `basePixels * (rootFontSize / 16)`.

Supported bundled React boundaries adapt their omitted defaults, including Sonner and Recharts geometry. Explicit numeric overrides keep their pixel semantics. Read [root-font scaling](scaling.md) for the exact low-level and private dependency boundaries.

## Public entrypoints

Supported consumer entries are:

- `@exre/exui`
- `@exre/exui/style.css`
- `@exre/exui/tokens`
- `@exre/exui/tokens/style.css`
- `@exre/exui/tokens/font.css`
- `@exre/exui/docs/theme.css`

`docs/theme.css` is the Fumadocs UI colour contract, not a general-purpose stylesheet; see [Fumadocs docs theme](docs-theme.md) before using it.

Do not import from package `src/`, `dist/`, or `types/` paths, and do not reference the internal `@exre/exui-tokens` workspace, which is not published.
