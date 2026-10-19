<!-- Generated from resources/components/accordion/c-accordion-7.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn In Frame

> Accordion items integrated within Frame and FramePanel

- Type: example, free and open source (MIT)
- Component: [Accordion](../accordion.md)
- Page: [local reference](./c-accordion-7.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/accordion.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/accordion.md
- Uses: Accordion, Badge, Frame

## Best for

Settings rows with icon tiles joined in a stacked Frame, where each panel opens without closing the others

## Agent notes

- Each `FramePanel` wraps its own `Accordion`, so rows open independently and only the first matches `defaultValue`

## When not to use

- Stacked panels that only group content and never expand or collapse: use [Frame](../frame.md)
- Sections where only one may be open at any moment: use [Icons & Badges](./c-accordion-6.md)

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
