<!-- Generated from resources/components/stepper/c-stepper-20.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Purchase Orders

> Stepper with purchase order checks

- Type: example, free and open source (MIT)
- Component: [Stepper](../stepper.md)
- Page: [local reference](./c-stepper-20.md)
- Uses: Badge, Button, Dropdown Menu, Separator, Tree

## Best for

A Tree of orders with Ready or Review badges and an actions menu on the active step row, also opened by Shift+F10

## Agent notes

- Built on the `Tree` primitive with `useTree` from `@headless-tree/react`, so it renders no Stepper parts at all
- The `DropdownMenuItem` actions and the More rows in `links` have no handlers yet; route `links` from `onPrimaryAction`, which skips them now
- Swap `orders` for your data; badges and step states are derived from each order's `checks`

## When not to use

- A plain folder outline with no pass, fail or pending result per row: use [Tree](../tree.md)

## Third-party libraries

- Headless Tree v1: [API reference](https://headless-tree.lukasbach.com/api/core/), [docs](https://headless-tree.lukasbach.com/getstarted/)

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
