# Fumadocs UI docs theme

Render a documentation site built with [Fumadocs UI](https://www.fumadocs.dev/docs/ui) in ExUI colours by importing one stylesheet. This is a colour contract only: it does not wrap, replace, or re-export any Fumadocs component.

## Install

ExUI names `fumadocs-ui` in no dependency field, so install it yourself — a Fumadocs site needs it anyway:

```bash
npm add fumadocs-ui
```

The sheet is verified against `fumadocs-ui@^16.15.0`.

## Import

```tsx
import '@exre/exui/docs/theme.css'
```

Import it once per docs surface, like any other stylesheet. It carries the ExUI Token sheet itself, so a Fumadocs-only site needs no separate Token import.

## What the sheet does

`docs/theme.css` is three `@import` rules in a pinned order:

1. `@exre/exui/tokens/style.css` — the ExUI Token variables.
2. `fumadocs-ui/css/shadcn.css` — Fumadocs' colour sheet.
3. `fumadocs-ui/css/preset.css` — Fumadocs' preset.

Fumadocs maps its `--color-fd-*` names onto shadcn's short variables (`--background`, `--primary`, `--sidebar`) **without fallbacks**. Loading Fumadocs' color sheet alone without those variables leaves its color references unset. ExUI's entry supplies the Token sheet first to satisfy that contract. To recolor the docs, override the short aliases as described in [Token customization](token-customization.md).

The sheet ships unprocessed, exactly like Fumadocs' own `css/*` sheets, so your Tailwind build resolves the three imports. If `fumadocs-ui` is missing, the imports fail loudly instead of yielding an unthemed page.

## Boundaries

- **Colour only.** Fumadocs keeps its own radii, spacing, and animations; they follow neither ExUI's `--radius` nor its density values.
- **No component wrapping.** Fumadocs ships its own `Tabs` and `Accordion` with APIs that differ from ExUI's (`<Tabs items={[...]}><Tab value="..." />` against ExUI's `<TabsList>` composition). Import those from `fumadocs-ui`; ExUI does not re-export Fumadocs components.
- **One theme driver per page.** Fumadocs' `RootProvider` (next-themes) and ExUI's `ThemeProvider` both read and write the `theme` `localStorage` key. In an SSR framework use Fumadocs' provider: it is hydration-safe, while ExUI's `ThemeProvider` is not. See [Theme usage](theme-usage.md).
- **Stylesheet subpath only.** There is no `@exre/exui/docs` JavaScript entry.
