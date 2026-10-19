<!-- Generated from resources/components/progress.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Progress

> Open-source shadcn progress components for upload progress, goal tracking, and setup steps.

- Type: shadcn/ui component, free
- Page: [local reference](./progress.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/progress.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/progress.md
- Examples: 8

## When to use

- Labeled bars that report how far an upload, a download or a workspace setup has got, as a percent
- File transfer rows with time left, and setup checklists whose bar counts the steps done
- Compact bars in dense list rows, and bars pinned to a set height or filled in a color of their own

## When not to use

- A drop zone or picker where people choose the documents and images to send: use [File Upload](./file-upload.md)
- Numbered steps the user can open or move between, each with its own panel: use [Stepper](./stepper.md)
- A wait of unknown length, where no share of the work done can be shown: use [Spinner](./spinner.md)

## Agent notes

- `ProgressLabel` and `ProgressValue` exist in the base twin only; radix `Progress` drops its children, so print the label and percent beside it
- Set bar height on the `progress-track` slot in base, as `c-progress-2` does, and with a height class on `Progress` in radix, whose root is the track
- Only a base `ProgressLabel` names the bar for screen readers; give every other bar, radix ones included, an aria-label naming the task

## Examples

- [Basic](./progress/c-progress-1.md): Basic progress.. Best for a name on the left and its percent on the right, over a bar left at the active style's default height.
- [Small](./progress/c-progress-2.md): Small progress.. Best for a slim bar pinned to a 4px track, whatever height the active style gives it by default.
- [Large](./progress/c-progress-3.md): Large progress.. Best for a heavy bar pinned to a 12px track, with its name and percent on the row above.
- [Status Messages](./progress/c-progress-4.md): Progress bar with status messages.. Best for a bar that fills by itself and loops, with a status line under it that rewords as each cutoff is passed.
- [File Uploads](./progress/c-progress-5.md): File upload list with progress & status.. Best for rows of 4 files, each with a file icon, a cut off name, a 4px bar and the time left or Complete at the end.
- [With Slider](./progress/c-progress-6.md): Progress bar with slider.. Best for a bar and a 0 to 100 slider under it with a step of 1, both bound to one value state.
- [Multi-Step](./progress/c-progress-7.md): Multi-step progress indicator. Best for a setup checklist whose bar fills by the share of finished steps, with a done count and a check or empty circle per step.
- [Custom Colors](./progress/c-progress-8.md): Progress bar with custom colors.. Best for stacked bars in 5 fixed palette fills from green to violet that all slide from 45 to 75 together on load.
