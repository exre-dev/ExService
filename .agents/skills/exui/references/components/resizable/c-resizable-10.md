<!-- Generated from resources/components/resizable/c-resizable-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Size Tracking

> State-tracked resizable layout.

- Type: example, free and open source (MIT)
- Component: [Resizable](../resizable.md)
- Page: [local reference](./c-resizable-10.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/resizable.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/resizable.md
- Uses: Resizable

## Best for

Live percentage readouts in each pane, fed from the group layout callback into React state as the divider moves

## Agent notes

- `setSizes` stores the whole `layout`, keyed by each panel `id`, so rename `left` and `right` in the ids and the readouts together
- `onLayoutChange` runs `setSizes` on every pointer move of a drag; save a layout from onLayoutChanged, which fires once the pointer is released
- The `sizes` seed and the readout fallbacks repeat the 30 and 70 of `defaultSize`, so change all 3 places together

## Third-party libraries

- React Resizable Panels v4: [API reference](https://github.com/bvaughn/react-resizable-panels#documentation), [docs](https://react-resizable-panels.vercel.app/), through shadcn Resizable (v4 names its parts Group, Panel and Separator (v3 docs say PanelGroup))

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Resizable

### When to use

- Split views that set a sidebar beside content or a header over a body, sized by dragging the divider
- Editor and IDE style workspaces of 3 or more panes, in one row or nested across both directions
- Layouts that read live pane sizes back into app state, such as a percentage readout

### When not to use

- A complete product layout with navigation, header and content area already in place: use the App Shell blocks
- Task bars stretched along a timeline to change their start and end dates: use the Gantt blocks
- Table rows and columns that users reorder by hand or widen at the header edge: use the Drag & Drop blocks

### Agent notes

- A number in `defaultSize` or `minSize` is read as pixels, not percent; pass a string such as 30% when a panel should take a share of the group
- `orientation` vertical stacks the panels with horizontal dividers between them and horizontal sets them side by side; the v4 group has no direction prop
- react-resizable-panels needs every Panel and Separator to be a direct DOM child of its Group, so never wrap a `ResizablePanel` or `ResizableHandle` in a div
