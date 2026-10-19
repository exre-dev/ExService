# Layout: hierarchy, spacing and surfaces

## House defaults

- Use parent `gap-*` for siblings: `gap-1` to `gap-2` within a row, `gap-3` to `gap-4` between groups and `gap-6` to `gap-8` between sections. Keep title and description close.
- Use `text-sm` body, `text-xs` metadata, and `tabular-nums` for comparable numbers. Keep CardTitle and FrameTitle's own typography.
- Use the supported compact size on dense controls. Frame `spacing` and Card `size` own slot padding; keep ordinary layout classes outside those slots.
- Neutral labels generally use `Badge variant="outline"`; state labels use verified `success-light`, `info-light`, `warning-light` or `destructive-light` variants.
- Let controls size their icons. Standalone row icons generally use `size-4`; read [icons](icons.md).

## Hierarchy and copy

Give each region one focal task or metric, then its label and supporting detail. Use surfaces and separators to establish hierarchy. Remove repeated context, decorative badges and unnecessary actions before adding another panel. Keep text legible with real long names and translated labels; allow wrapping rather than shrinking text.

## Surface families

Use Frame for tool/data regions and Card for bounded content. Prefer one family per screen; KPI Cards and a Frame table can coexist. Avoid redundant nested panels. A DataGrid inside Frame can use `FramePanel className="p-0"` to avoid double padding.

Place `CardAction` directly inside `CardHeader` for a trailing action or progress indicator. The header keeps its title and description stacked in the leading column, including Questionnaire titles rendered through `CardTitle` and descriptions rendered through `CardDescription`.

Use ExItem for title/description/control presentation; FormItem owns registered field errors. Do not put a layout-only settings row into a form just to obtain its label spacing.

Material and elevation are separate choices. Read [Glass](../references/exui/glass.md) before using translucent surfaces, and [Shadows](../references/exui/shadows.md) before adjusting elevation. Do not hand-roll a frosted background when `glass` or `ex-glass` covers the requirement.

## Buttons, states and width

Use one primary action per task, outline secondary actions and ghost row actions. Set non-submit buttons to `type="button"`. Toolbars may wrap at small widths; keep every action reachable.

Use layout-matching Skeletons, an actionable empty state and local error recovery. At narrow widths, stack grids and sidebars. Give shrinking flex/grid children `min-w-0`; contain table scrolling within the panel. Test text, controls and dialogs at the application's root font size.
