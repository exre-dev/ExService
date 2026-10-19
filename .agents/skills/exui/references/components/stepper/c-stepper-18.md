<!-- Generated from resources/components/stepper/c-stepper-18.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Stage Details

> Stepper with key-value stage details

- Type: example, free and open source (MIT)
- Component: [Stepper](../stepper.md)
- Page: [local reference](./c-stepper-18.md)
- Uses: Avatar, Badge, Button, Carousel, Stepper

## Best for

A stage row that turns into a draggable carousel with faded edges when it overflows, each stage listing label and value pairs

## Agent notes

- The agent photo in `stages` is a hot linked Unsplash URL; swap `avatar` for an image you host

## When not to use

- A sea freight route whose ports show carrier, voyage and dates: use [Shipping Route](./c-stepper-36.md)

## Third-party libraries

- Embla Carousel v8: [API reference](https://www.embla-carousel.com/docs/v8/api), [docs](https://www.embla-carousel.com/docs/v8/get-started/react), through shadcn Carousel

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Stepper

### When to use

- Forms and setup flows split into numbered steps that people move back and forth through
- Shipment, delivery and freight tracking shown as stops with times, ETAs and the leg underway
- Incident, ticket, sales, proposal and review workflows laid out as stages, cards, rows or nested tasks

### When not to use

- A finished screen that runs a billing, invoice or vendor task through numbered steps: use the Wizard blocks
- A complete first run account setup shown right after signup, with invites and goals: use the Onboarding blocks
- A storefront purchase that takes shipping and card details beside the cart total: use the Checkout blocks

### Agent notes

- `StepperTrigger` takes another element through `render` on the base twin and `asChild` on the radix twin
- Trigger ids come from `step` alone, so 2 steppers on one page need their own `id` and `aria-controls` on each `StepperTrigger`
- `StepperContent` unmounts every inactive step, so keep field values in parent state or pass `forceMount`
