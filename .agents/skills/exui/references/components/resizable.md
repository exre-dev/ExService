<!-- Generated from resources/components/resizable.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Resizable

> Open-source shadcn resizable components for split panes, workspace layouts, and draggable dividers.

- Type: shadcn/ui component, free
- Page: [local reference](./resizable.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/resizable.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/resizable.md
- Examples: 10

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Split views that set a sidebar beside content or a header over a body, sized by dragging the divider
- Editor and IDE style workspaces of 3 or more panes, in one row or nested across both directions
- Layouts that read live pane sizes back into app state, such as a percentage readout

## When not to use

- A complete product layout with navigation, header and content area already in place: use the App Shell blocks
- Task bars stretched along a timeline to change their start and end dates: use the Gantt blocks
- Table rows and columns that users reorder by hand or widen at the header edge: use the Drag & Drop blocks

## Agent notes

- A number in `defaultSize` or `minSize` is read as pixels, not percent; pass a string such as 30% when a panel should take a share of the group
- `orientation` vertical stacks the panels with horizontal dividers between them and horizontal sets them side by side; the v4 group has no direction prop
- react-resizable-panels needs every Panel and Separator to be a direct DOM child of its Group, so never wrap a `ResizablePanel` or `ResizableHandle` in a div

## Third-party libraries

- React Resizable Panels v4: [API reference](https://github.com/bvaughn/react-resizable-panels#documentation), [docs](https://react-resizable-panels.vercel.app/) (v4 names its parts Group, Panel and Separator (v3 docs say PanelGroup))

## Examples

- [Horizontal Layout](./resizable/c-resizable-1.md): Horizontal resizable layout. Best for a header pane stacked over a content pane, split 25 to 75, with a plain line dragged up and down.
- [Vertical Layout](./resizable/c-resizable-2.md): Vertical resizable layout.. Best for a sidebar beside a content pane, split 25 to 75, with a plain 1px divider dragged left and right.
- [Mixed Directions](./resizable/c-resizable-3.md): Nested mixed-direction resizable layout.. Best for a side pane beside a column that splits again into top and bottom, 3 panes in 2 directions on plain line dividers.
- [Nested Grips](./resizable/c-resizable-4.md): Nested resizable. Best for equal halves where the right half splits 25 to 75 top and bottom, on grip dividers with sizes written as percent strings.
- [Animated Pill](./resizable/c-resizable-5.md): Handle with animated pill indicator. Best for a short pill on a 30 to 70 split that lengthens on hover, then grows longer and turns primary while pressed.
- [Spring Pill](./resizable/c-resizable-6.md): Handle pill with spring scale on drag. Best for a pill drawn at 75 percent scale that eases to full scale on hover, then stretches and turns primary while pressed.
- [Capsule Expansion](./resizable/c-resizable-7.md): Handle with large capsule expansion on drag. Best for the longest press state: a pill that widens on hover and reaches 5rem while pressed, as the whole divider line tints primary.
- [Nested Pills](./resizable/c-resizable-8.md): Nested layout with animated pill handles. Best for nav beside a toolbar over an editor, with an upright pill on the outer divider and a wide pill on the inner one.
- [Three Panels](./resizable/c-resizable-9.md): Three-panel layout with animated pill handles. Best for files, editor and preview in one row split 25, 50 and 25, with 2 pill handles and a minimum size on every pane.
- [Size Tracking](./resizable/c-resizable-10.md): State-tracked resizable layout.. Best for live percentage readouts in each pane, fed from the group layout callback into React state as the divider moves.
