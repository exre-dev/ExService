# Kanban composition

Read the [Kanban family reference](../components/kanban.md) for interaction and persistence guidance.

For compact boards, use `Card size="sm"` for both task cards and column cards. Its shared spacing is 1rem (16px at the default root font size), including the Card's vertical padding, content insets and header-to-content gap.

All six examples use a 1rem task radius and a 1.5rem column radius: 16px and 24px at the default root font size. Card-based examples use `rounded-[1rem]` and `rounded-[1.5rem]`. Frame-based examples set the column's `--frame-radius` to 1.5rem, and the task's `--frame-radius` and `--frame-panel-radius` to 1rem so both painted layers agree. These local radius overrides scale with the root font size.

Match a dashed `KanbanOverlay` to the surface that paints the dragged item:

- Card-based columns use `rounded-[1.5rem]`; their task cards use `rounded-[1rem]`. Use the overlay render function's `variant` to select the matching outline for an item or a column.
- The ghost Frame task examples use `rounded-[1rem]`, matching their FramePanel.
- A dynamic overlay should render the same card component with the same size as its source.

An overlay is portaled to the document body. Keep its radius tokens available there when customizing a board's theme; border radius does not inherit from the source card.
