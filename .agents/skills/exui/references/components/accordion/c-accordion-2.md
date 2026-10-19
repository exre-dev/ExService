<!-- Generated from resources/components/accordion/c-accordion-2.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Plus Minus Icons

> Accordion with plus/minus indicators

- Type: example, free and open source (MIT)
- Component: [Accordion](../accordion.md)
- Page: [local reference](./c-accordion-2.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/accordion.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/accordion.md
- Uses: Accordion

## Best for

Feature summaries that can all stay open at once, each row ending in a plus that flips to a minus

## Agent notes

- Keep the class on `AccordionTrigger` that hides `accordion-trigger-icon`, or the built-in chevron shows beside the plus and minus

## When not to use

- A list where opening one answer should close the one already open: use [Single Expand](./c-accordion-1.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Accordion

### When to use

- Help and FAQ sections where each question opens its own answer
- Settings, plans, product details and onboarding steps grouped into sections that expand on demand
- Lists of people or records that open to show detail, such as team members and roles

### When not to use

- One block of extra content shown and hidden by a single trigger: use [Collapsible](../collapsible.md)
- A complete questions section for a landing page, with heading and support prompt: use the FAQ blocks
- Switching between views of the same space where exactly one is always shown: use [Tabs](../tabs.md)

### Agent notes

- The base twin takes `multiple` and an array `defaultValue`; the radix twin takes `type`, and `defaultValue` is a string only when `type` is single
- A closed `AccordionContent` ships no text in the server HTML of either twin unless kept mounted, so crawlers without JS never read it
