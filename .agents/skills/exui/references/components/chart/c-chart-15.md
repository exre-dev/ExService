<!-- Generated from resources/components/chart/c-chart-15.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Dotted Step Area

> Step area chart with dotted pattern fill

- Type: example, free and open source (MIT)
- Component: [Chart](../chart.md)
- Page: [local reference](./c-chart-15.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/chart.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/chart.md
- Uses: Badge, Card, Chart

## Best for

A stepped area that holds each month flat until the next, filled with a dot texture, for counts that rise in jumps

## When not to use

- Values that move smoothly between months rather than in steps: use [Gradient Area](./c-chart-13.md)

## Third-party libraries

- Recharts v3: [API reference](https://recharts.github.io/en-US/api/), [docs](https://recharts.github.io/en-US/guide/getting-started/)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Chart

### When to use

- Trend cards that plot monthly or weekly figures as bars, areas or a line
- Part to whole breakdowns such as traffic sources, task status or plan tiers as donut and pie slices
- Score profiles across several axes, such as team skills or audit results, as radar or radial bars

### When not to use

- A finished metric card with period tabs, KPI tiles and a range switcher built in: use the Area Chart blocks
- Headline numbers with trend badges and no plotted series: use the Stats blocks
- A whole overview page with summary tiles above a trend and a work list: use the Dashboard blocks

### Agent notes

- Replace the sample `chartData` array, and give each series or slice name it uses a `chartConfig` entry with a label and color
- Each example caps its `Card` at `max-w-md` or `max-w-xs`; drop the cap so the chart fills a grid cell
- `ChartContainer` sizes itself by `aspect-video` unless a class overrides it, so set an aspect ratio or height class to fit a fixed tile
