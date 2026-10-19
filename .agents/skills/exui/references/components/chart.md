<!-- Generated from resources/components/chart.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Chart

> Open-source shadcn chart components for analytics dashboards, KPI tracking, and reports.

- Type: shadcn/ui component, free
- Page: [local reference](./chart.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/chart.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/chart.md
- Examples: 25

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.

**ExUI addition**

### Bundled chart and table runtimes

Import `Recharts` and `TanStackTable` from the root package when composing ExUI charts or DataGrid. These namespaces use the same bundled instances as ExUI's components. The wrapped Recharts axes, tooltip and legend scale their omitted numeric defaults with the document root font. `TanStackTable.useTable` and its app hooks do the same for omitted column sizes. Explicit numeric sizes are pixels; bare non-React `constructTable` retains its upstream pixel defaults.

```tsx verify
import { Recharts, TanStackTable } from '@exre/exui'

export const ExuiXAxis = Recharts.XAxis
export const ExuiTableHook = TanStackTable.useTable
```

<!-- exui-capabilities:end:skill -->

## When to use

- Trend cards that plot monthly or weekly figures as bars, areas or a line
- Part to whole breakdowns such as traffic sources, task status or plan tiers as donut and pie slices
- Score profiles across several axes, such as team skills or audit results, as radar or radial bars

## When not to use

- A finished metric card with period tabs, KPI tiles and a range switcher built in: use the Area Chart blocks
- Headline numbers with trend badges and no plotted series: use the Stats blocks
- A whole overview page with summary tiles above a trend and a work list: use the Dashboard blocks

## Agent notes

- Replace the sample `chartData` array, and give each series or slice name it uses a `chartConfig` entry with a label and color
- Each example caps its `Card` at `max-w-md` or `max-w-xs`; drop the cap so the chart fills a grid cell
- `ChartContainer` sizes itself by `aspect-video` unless a class overrides it, so set an aspect ratio or height class to fit a fixed tile

## Third-party libraries

- Recharts v3: [API reference](https://recharts.github.io/en-US/api/), [docs](https://recharts.github.io/en-US/guide/getting-started/)
- Motion v12: [API reference](https://motion.dev/docs/react-motion-component), [docs](https://motion.dev/docs/react), used by 1 of 25 examples (the docs follow the latest Motion, with no React API break since v12)

## Examples

- [Basic Bars](./chart/c-chart-1.md): Basic bar chart. Best for a single revenue series as solid bars over 12 months with horizontal grid lines and a dollar amount in the tooltip.
- [Multi-Dataset Bars](./chart/c-chart-2.md): Multi-dataset bar chart. Best for desktop and mobile bars grouped side by side for 6 months, each series in its own theme color with a matching tooltip swatch.
- [Diagonal Stripe Bars](./chart/c-chart-3.md): Diagonal stripe bar chart. Best for single series bars hatched with diagonal lines on a faint tint, each bar outlined in the series color.
- [Dotted Bars](./chart/c-chart-4.md): Dotted pattern bar chart. Best for single series bars textured with a fine grid of dots over a faint tint of the series color.
- [Striped Solid Bars](./chart/c-chart-5.md): Striped and solid bar chart. Best for desktop bars diagonally striped beside solid mobile bars, so one of 2 series reads apart from the other.
- [3D Gradient Bars](./chart/c-chart-6.md): 3D gradient bar chart. Best for bars extruded into 3D blocks whose front, top, side and back faces each take their own gradient.
- [Gradient Bars](./chart/c-chart-7.md): Gradient bar chart. Best for single series bars that fade from 70 to 20 percent opacity downward, with rounded corners and no grid lines.
- [Isometric Bars](./chart/c-chart-8.md): 3D isometric bar chart. Best for isometric 3D blocks in one flat series color, with the back, side and top faces at 60, 70 and 80 percent opacity.
- [Dotted Solid Bars](./chart/c-chart-9.md): Dotted and solid bar chart. Best for a pair of series in the same color told apart by fill, a dotted texture for desktop and solid bars for mobile.
- [Duotone Bars](./chart/c-chart-10.md): Duotone gradient bar chart. Best for bars split down the middle into a pale left half and a solid right half through a hard stop gradient.
- [Animated Monochrome Bars](./chart/c-chart-11.md): Animated monochrome bar chart. Best for thin bars that widen on hover to print their value, while the header figure follows the hovered month.
- [Horizontal Bars](./chart/c-chart-12.md): Vertical bar chart. Best for horizontal bars with months down the side and the value axis hidden, comparing desktop against mobile.
- [Gradient Area](./chart/c-chart-13.md): Gradient area chart with stripe overlay. Best for a single visitor series as a smooth area fading from 50 to 5 percent opacity under its line, over a dashed grid.
- [Stacked Dashed Area](./chart/c-chart-14.md): Stacked area chart with dashed strokes. Best for organic, paid and referral traffic stacked as 3 areas, the lower 2 traced with dashed strokes.
- [Dotted Step Area](./chart/c-chart-15.md): Step area chart with dotted pattern fill. Best for a stepped area that holds each month flat until the next, filled with a dot texture, for counts that rise in jumps.
- [Glowing Dot Area](./chart/c-chart-16.md): Area chart with glowing dot markers. Best for weekly signups as a smooth area under a glowing line, with a glowing dot on every point that grows on hover.
- [Forecast Line](./chart/c-chart-17.md): Forecast line chart with stripe pattern zone. Best for a projected sales line over a faintly striped area, with a legend below and dollar values in the tooltip.
- [Crosshatch Area](./chart/c-chart-18.md): Stacked area chart with crosshatch pattern fill. Best for request volume from API calls and webhooks stacked as 2 areas, each filled with a crosshatch of thin lines in its own color.
- [Donut Center Total](./chart/c-chart-19.md): Donut chart with center total. Best for visits from 5 traffic sources as rounded donut slices with gradient fills and a drop shadow, totaled in thousands at the center.
- [Donut Center Stats](./chart/c-chart-20.md): Donut chart with center stats. Best for sprint tasks by status in a donut whose center reads the completed share as a percent, with a legend below.
- [Striped Pie](./chart/c-chart-21.md): Bug priority pie with stripe patterns. Best for open bugs by priority with a striped critical slice in the destructive color and a dotted medium slice beside 2 solid ones.
- [Active Segment Donut](./chart/c-chart-22.md): Active segment donut with center label. Best for plan tiers in a donut whose hovered slice grows outward, with paid users at the center and the paid share in the subtitle.
- [Gradient Radar](./chart/c-chart-23.md): Radar chart with gradient fill. Best for team skill scores on a 6 axis radar with a top to bottom gradient fill, a soft glow and solid point dots.
- [Glowing Stroke Radar](./chart/c-chart-24.md): Filled radar with glowing stroke. Best for a radar held to a 0 to 100 scale by a hidden radius axis, with hollow point markers and a diagonal gradient.
- [Radial Scores](./chart/c-chart-25.md): Lighthouse scores radial with labels. Best for platform scores as 3 radial bars on a 0 to 100 track, each labeled with its value and filled with its own gradient.
