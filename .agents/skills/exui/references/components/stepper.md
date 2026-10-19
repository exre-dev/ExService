<!-- Generated from resources/components/stepper.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Stepper

> Open-source shadcn stepper components for multi-step forms, checkout flows, and onboarding.

- Type: upstream component, free
- Page: [local reference](./stepper.md)
- Examples: 44

## When to use

- Forms and setup flows split into numbered steps that people move back and forth through
- Shipment, delivery and freight tracking shown as stops with times, ETAs and the leg underway
- Incident, ticket, sales, proposal and review workflows laid out as stages, cards, rows or nested tasks

## When not to use

- A finished screen that runs a billing, invoice or vendor task through numbered steps: use the Wizard blocks
- A complete first run account setup shown right after signup, with invites and goals: use the Onboarding blocks
- A storefront purchase that takes shipping and card details beside the cart total: use the Checkout blocks

## Agent notes

- `StepperTrigger` takes another element through `render` on the base twin and `asChild` on the radix twin
- Trigger ids come from `step` alone, so 2 steppers on one page need their own `id` and `aria-controls` on each `StepperTrigger`
- `StepperContent` unmounts every inactive step, so keep field values in parent state or pass `forceMount`

## Third-party libraries

- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt), through the Base UI twin
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin
- Headless Tree v1: [API reference](https://headless-tree.lukasbach.com/api/core/), [docs](https://headless-tree.lukasbach.com/getstarted/), used by 2 of 44 examples
- Embla Carousel v8: [API reference](https://www.embla-carousel.com/docs/v8/api), [docs](https://www.embla-carousel.com/docs/v8/get-started/react), used by 1 of 44 examples

## Examples

- [Basic](./stepper/c-stepper-1.md): Basic stepper. Best for a row of 4 numbered circles, uncontrolled, whose connector takes the primary color after each passed step.
- [Completed State](./stepper/c-stepper-2.md): Stepper with completed state. Best for passed steps painted green on both the circle and its connector, with later numbers in gray.
- [Loading State](./stepper/c-stepper-3.md): Stepper with loading state. Best for number free ring markers: a dot marks the current step, a spinner the loading one and a check each passed step.
- [Controlled](./stepper/c-stepper-4.md): Controlled stepper. Best for the active step kept in React state and moved by Previous and Next buttons that disable at either end.
- [Labels Below](./stepper/c-stepper-5.md): Stepper with title and indicator. Best for numbered circles that become checks once passed, each with a short label centered below it.
- [Left Aligned Titles](./stepper/c-stepper-6.md): Stepper with progress bar indicator. Best for left aligned numbers over bold titles from User Details to Preview Form, with no lines between steps.
- [Icons & Badges](./stepper/c-stepper-7.md): Stepper with icons and badges. Best for icon circles above a Step N eyebrow, a bold title and an In Progress, Completed or Pending badge.
- [Descriptions](./stepper/c-stepper-8.md): Stepper with descriptions. Best for centered steps stacking a number, a title and a one line description, with connectors between them.
- [Inline Titles](./stepper/c-stepper-9.md): Stepper with inline titles. Best for a number or check beside each title in one row, with a connector that fills once the step is passed.
- [Title & Caption](./stepper/c-stepper-10.md): Stepper with content for each step. Best for a number or check beside a 2 line title and caption per step, joined by muted connectors that never fill.
- [Bar With Titles](./stepper/c-stepper-11.md): Stepper with progress bar and titles. Best for full width bar segments, one per step, filling with the primary color up to the current one, titles below.
- [Segmented Bar](./stepper/c-stepper-12.md): Stepper with segmented progress bar. Best for one thick bar of 4 joined segments, a Back link, a current of total counter and a Next button.
- [Vertical Descriptions](./stepper/c-stepper-13.md): Stepper with vertical orientation and descriptions. Best for a top to bottom column of numbered markers, each with a title and a description beside it, links greening once done.
- [Vertical](./stepper/c-stepper-14.md): Stepper with vertical orientation. Best for a bare column of 3 numbered circles with green links between finished ones and a spinner on the loading step.
- [Vertical Titles](./stepper/c-stepper-15.md): Stepper with vertical orientation and titles. Best for vertical numbered steps labelled with one title each and no supporting text, content centered below.
- [Delivery Stops](./stepper/c-stepper-16.md): Stepper with delivery stops and ETAs. Best for a route list that moves beside its stop detail in wider containers, a spinner on the current stop, Previous and Next.
- [Dotted Progress](./stepper/c-stepper-17.md): Stepper with dotted progress. Best for tiny ring dots joined by dotted links in a box at most 240px wide, each named only by its aria label.
- [Stage Details](./stepper/c-stepper-18.md): Stepper with key-value stage details. Best for a stage row that turns into a draggable carousel with faded edges when it overflows, each stage listing label and value pairs.
- [Frame Icon Tiles](./stepper/c-stepper-19.md): Stepper with icon tiles in a frame. Best for a muted Frame header strip with arrows between steps above an empty placeholder panel and Previous and Next.
- [Purchase Orders](./stepper/c-stepper-20.md): Stepper with purchase order checks. Best for a Tree of orders with Ready or Review badges and an actions menu on the active step row, also opened by Shift+F10.
- [Security Checks](./stepper/c-stepper-21.md): Stepper with grouped security checks. Best for a 3 level Tree of areas, numbered steps and checks, whose row status follows where the active check sits.
- [Bottom Color Bars](./stepper/c-stepper-22.md): Stepper with color-coded bottom bars. Best for step tabs pinned under the content as a footer strip, each in its own color, shortening to numbers when narrow.
- [Top Color Bars](./stepper/c-stepper-23.md): Stepper with top color bars and card art. Best for colored tabs across the top of a Frame panel over static card artwork, for a card entry flow with no fields yet.
- [Icon Tile Rows](./stepper/c-stepper-24.md): Stepper with icon tile rows. Best for stacked Frame rows clickable edge to edge, each with an IconTile and a status marker at its end, above a Step N of 4 detail.
- [Phase Track](./stepper/c-stepper-25.md): Stepper with phase track. Best for a pale track where only the current phase's slice fills blue, with a spinning dashed dot and refund case copy below.
- [Timestamped Checkpoints](./stepper/c-stepper-26.md): Stepper with timestamped checkpoints. Best for a muted track whose current slice fills with the foreground color, and times shown only for reached checkpoints.
- [Transit Arrow](./stepper/c-stepper-27.md): Stepper with transit arrow. Best for times on passed stops and estimates for the rest, over tick marks with an arrow drawn into the selected stop.
- [Breadcrumb Steps](./stepper/c-stepper-28.md): Stepper with breadcrumb steps. Best for text only step names beside an Onboarding label and a step counter, dropping to a row of their own below 48rem.
- [Compact Inline](./stepper/c-stepper-29.md): Stepper with compact inline progress. Best for a row of dashed rings and names that keeps only the current name when narrow, the current ring spinning and done ones blue.
- [Truck Route](./stepper/c-stepper-30.md): Stepper with truck route and rest stops. Best for icon stops in rings with short fixed legs for rest breaks and a green destination once it is selected.
- [Chevron Icon Tiles](./stepper/c-stepper-31.md): Stepper with icon tiles and chevrons. Best for a row of IconTile steps split by chevron icons, with the focus ring drawn on the tile, folding to bare tiles when narrow.
- [Numbered Chevrons](./stepper/c-stepper-32.md): Stepper with numbered chevron stages. Best for clip path chevrons that nest notch into arrow, outlined by a drop shadow on focus because the clip hides the ring.
- [Filled Chevrons](./stepper/c-stepper-33.md): Stepper with filled status chevrons. Best for an inverse Frame strip of chevrons that hug their labels with no done count, folding to icons around the current step.
- [Outlined Chevrons](./stepper/c-stepper-34.md): Stepper with outlined chevron plan. Best for full width chevrons whose traced SVG edges outline the done and current steps at low opacity, after a Plan count chip.
- [Flat Chevrons](./stepper/c-stepper-35.md): Stepper with flat chevron plan. Best for chevrons clipped on the trigger itself, with an inner pill that draws the focus ring, for a contract plan.
- [Shipping Route](./stepper/c-stepper-36.md): Stepper with shipping route and stop details. Best for a container query route that sheds rows as it narrows, a skewed segment bar on one leg and an arrow past the last port.
- [Horizontal Step Cards](./stepper/c-stepper-37.md): Stepper with horizontal step cards. Best for cards that are the tabs themselves via a FramePanel render, in a 2 or 4 column grid above the detail.
- [Shipment Progress](./stepper/c-stepper-38.md): Stepper with shipment progress bar. Best for icon labels under a tick track that turns solid green when passed, folding to evenly spaced bare icons when narrow.
- [Vertical Step Cards](./stepper/c-stepper-39.md): Stepper with vertical step cards. Best for stacked tab cards in a 240px column with useId scoped ids, the detail moving under them below 28rem.
- [Side Rail Icons](./stepper/c-stepper-40.md): Stepper with side rail and step icons. Best for a glyph of its own per row that turns blue when selected, and a solid green check only at the end of finished rows.
- [Status List](./stepper/c-stepper-41.md): Stepper with status list. Best for a 180px rail whose current title turns blue, with a spinning ring that follows the selection and useId scoped ids.
- [Vertical Status Bars](./stepper/c-stepper-42.md): Stepper with vertical status bars. Best for a bar per row that splits into 4 dashes on the current step, with the focus ring moved onto the label clear of it.
- [Collapsible Sub-Steps](./stepper/c-stepper-43.md): Stepper with sub-steps in a collapsible card. Best for numbered phases with a turning chevron, the open one boxed in a Frame that folds when picked again, its live task on a blue edge bar.
- [Right-Aligned Sub-Steps](./stepper/c-stepper-44.md): Stepper with right-aligned sub-steps. Best for end aligned labels on a segmented rail with a nested task rail, and status announced through useStepItem.
