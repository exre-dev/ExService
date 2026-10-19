<!-- Generated from resources/components/progress/c-progress-6.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn With Slider

> Progress bar with slider.

- Type: example, free and open source (MIT)
- Component: [Progress](../progress.md)
- Page: [local reference](./c-progress-6.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/progress.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/progress.md
- Uses: Progress, Slider

## Best for

A bar and a 0 to 100 slider under it with a step of 1, both bound to one value state

## Agent notes

- `onValueChange` returns an array because `Slider` gets `value` as an array, and `setValue` stores it whole; store its first item so `Progress` gets a number

## When not to use

- An input the user drags to choose a level, with no task to report: use [Slider](../slider.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Progress

### When to use

- Labeled bars that report how far an upload, a download or a workspace setup has got, as a percent
- File transfer rows with time left, and setup checklists whose bar counts the steps done
- Compact bars in dense list rows, and bars pinned to a set height or filled in a color of their own

### When not to use

- A drop zone or picker where people choose the documents and images to send: use [File Upload](../file-upload.md)
- Numbered steps the user can open or move between, each with its own panel: use [Stepper](../stepper.md)
- A wait of unknown length, where no share of the work done can be shown: use [Spinner](../spinner.md)

### Agent notes

- `ProgressLabel` and `ProgressValue` exist in the base twin only; radix `Progress` drops its children, so print the label and percent beside it
- Set bar height on the `progress-track` slot in base, as `c-progress-2` does, and with a height class on `Progress` in radix, whose root is the track
- Only a base `ProgressLabel` names the bar for screen readers; give every other bar, radix ones included, an aria-label naming the task
