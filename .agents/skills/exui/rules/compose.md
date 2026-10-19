# Compose a screen

Before a full screen, state the surface, archetype, container family, density, regions, states and motion briefly. Follow an explicit user layout or motion request when it differs from these defaults.

## Surface and archetype

| Surface     | Useful starting points                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Operational | Vertical rail settings, horizontal tabs, Frame stack, table management, dashboard grid, board or record detail |
| Marketing   | Card-led sections: headline, short supporting copy, primary action, concrete proof and media                   |
| Flow        | One centered Card or Dialog, one task per step and one primary action                                          |

Settings rails become horizontal or collapse below the host's small breakpoint. Dashboard KPIs can use `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`. Detail sidebars stack below the main content. Use Sidebar for an application shell, and verify its mobile Sheet behavior.

## Fill regions by responsibility

1. Select the matching ExUI public component: DataGrid for table interactions, Filters for query editing, Kanban for boards, ExForm/Form for validated input, ExItem for standalone title/description/control presentation.
2. Use public primitives for local composition: Tabs, Dialog, AlertDialog, Sheet, Card, Frame, Empty, Skeleton, Command.
3. Read a relevant [local pattern](../references/components.md), then compose its behavior using the installed ExUI API.

Keep one dominant container family; KPI Cards above a Frame table are a useful mix. Avoid nesting a Card inside a Frame merely to add another border. Use [Glass](../references/exui/glass.md) only for the surfaces the task calls for; preserve their ordinary geometry.

## Wiring

Read [components](components.md) for DataGrid's table instance, Filters' query tree and component-specific composition syntax. Use the ExUI root imports and bundled namespaces. CommandDialog needs a Command child; wire CommandItem's `onSelect` and use searchable labels as its `value`.

Keep [Filters chips](../references/exui/filters.md) joined and let the toolbar wrap complete conditions; avoid adding rounded corners or multiline labels to individual segments.

A settings form uses [Form](../references/exui/form.md) rather than a hand-built validator. An independent titled control uses ExItem. Titled overlays use Dialog composition; the old Modal export is removed.

## Headers, states and responsive behavior

Put a short title and description beside one primary action and quieter secondary actions. Keep actions accessible when toolbars wrap; hidden desktop controls need a reachable small-screen location.

Every data region handles loading, empty and failure locally. Use a Skeleton matching the real layout, one useful empty-state action, and a retry for recoverable errors. Do not replace the entire page with a spinner.

At narrow widths, use `min-w-0` on shrinking parents and let columns stack. Wide tables scroll inside their panel. Verify at 390px and the actual embedding width; root-font scaling changes the space controls need. Operational pages normally need no entrance motion. Follow [motion](motion.md) for feedback and transitions.
