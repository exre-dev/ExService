<!-- Generated from resources/components/stepper/c-stepper-36.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Shipping Route

> Stepper with shipping route and stop details

- Type: example, free and open source (MIT)
- Component: [Stepper](../stepper.md)
- Page: [local reference](./c-stepper-36.md)
- Uses: Avatar, Badge, Button, Icon Tile, Stepper

## Best for

A container query route that sheds rows as it narrows, a skewed segment bar on one leg and an arrow past the last port

## Agent notes

- The sailed share in `wave` is fixed at 75%; compute it from the real distance of the active leg
- The captain photo is an Unsplash URL in `avatar`; replace it with an image you serve

## When not to use

- A truck run with rest breaks and a vehicle badge on the moving leg: use [Truck Route](./c-stepper-30.md)

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
