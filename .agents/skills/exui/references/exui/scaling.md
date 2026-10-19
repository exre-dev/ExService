# Root-font scaling and density

ExUI's scalable built-in Tokens use rem against a 16px design base. The application owns `html` font size; the library supplies no global scale variable. Use rem for custom dimensions that must follow it. Do not scale the application with CSS transform or zoom, and do not set a fixed-pixel body font that defeats the root scale.

```css
html {
  font-size: 16px;
}
.settings-layout {
  display: grid;
  gap: 1rem;
  max-width: 48rem;
}
```

Built-in typography, padding, ordinary radii, control geometry and Glass blur follow the root. Glass blur is 0.25rem and its inset edge is 0.0625rem. Hairlines, focus rings, drop shadows, capsule radii and border compensation stay fixed.

Omitted numeric defaults for popup offsets, virtual rows, Gantt panels and gestures resolve from rem at runtime. Explicit numeric props retain CSS-pixel semantics: `sideOffset={8}`, `indent={20}`, column sizes and controlled resize state stay pixels. Prefer rem strings where the prop accepts CSS lengths. DOM measurements, SVG drawing coordinates, chart data and signature strokes retain their original units.

Use ExUI's `Recharts` and `TanStackTable` namespaces. Their supported React boundaries adapt omitted axis/tick/tooltip/legend sizes and table column defaults; explicit numeric overrides stay pixels. Toaster/ExMessage, Resizable and MessageScroller also adapt their owned defaults. The low-level non-React `TanStackTable.constructTable` API retains upstream pixel defaults. InputOTP's private password-manager badge reserve/probe (40px/18px) remains a dependency limitation. The docs theme adapts the named Fumadocs slide motions and scrollbar; the consuming app still owns its Fumadocs version and other preset geometry. Read [Tokens](token-usage.md) for conversions when a rendering API really needs pixels.

`.density-compact` changes control height, inline padding, radius, gap and icon size variables. Default Button, Input, Textarea, Select, NativeSelect and InputGroup consume their applicable values; this is not a promise about explicit sizes or every complex widget. Use supported size props for other density choices.

Verify narrow viewports, translated labels, portal contents and keyboard focus at the host's real root scale. Dynamic CSS variables or measured canvas values can use inline style; prefer ordinary CSS/Tailwind classes for static layout.
