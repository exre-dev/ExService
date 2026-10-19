<!-- Generated from resources/components/accordion.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Accordion

> Open-source shadcn accordion components for FAQ layouts, settings panels, and help sections.

- Type: shadcn/ui component, free
- Page: [local reference](./accordion.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/accordion.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/accordion.md
- Examples: 11

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Nova-style Accordion

ExUI's Accordion keeps the Radix single/multiple API but uses a plain Nova-style list: no outer panel border, separators between items and transparent open rows. The trigger has a visible keyboard focus ring. Expanded content follows its current content height, including nested items and text wrapping after width changes; do not set a fixed height to compensate.

```tsx verify
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@exre/exui'

export function Details() {
  return (
    <Accordion type="single" collapsible defaultValue="delivery">
      <AccordionItem value="delivery">
        <AccordionTrigger>Delivery</AccordionTrigger>
        <AccordionContent>Track the order in your account.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

<!-- exui-capabilities:end:skill -->

## When to use

- Help and FAQ sections where each question opens its own answer
- Settings, plans, product details and onboarding steps grouped into sections that expand on demand
- Lists of people or records that open to show detail, such as team members and roles

## When not to use

- One block of extra content shown and hidden by a single trigger: use [Collapsible](./collapsible.md)
- A complete questions section for a landing page, with heading and support prompt: use the FAQ blocks
- Switching between views of the same space where exactly one is always shown: use [Tabs](./tabs.md)

## Agent notes

- The base twin takes `multiple` and an array `defaultValue`; the radix twin takes `type`, and `defaultValue` is a string only when `type` is single
- A closed `AccordionContent` ships no text in the server HTML of either twin unless kept mounted, so crawlers without JS never read it

## Examples

- [Single Expand](./accordion/c-accordion-1.md): A basic single-expand accordion. Best for the minimal pattern: 3 questions with one answer open at a time and the first open on load.
- [Plus Minus Icons](./accordion/c-accordion-2.md): Accordion with plus/minus indicators. Best for feature summaries that can all stay open at once, each row ending in a plus that flips to a minus.
- [Bordered Rounded](./accordion/c-accordion-3.md): Accordion with borders and rounded corners. Best for each question boxed on its own with a gap between, holding long answers in muted text, one open at a time.
- [In Card](./accordion/c-accordion-4.md): Accordion embedded within a Card. Best for plan, billing and security questions under a titled Card header that can open together, the first ending in a View plans button.
- [Disabled Items](./accordion/c-accordion-5.md): Accordion with disabled items and highlighted state. Best for one outlined box whose open row takes a muted tint, with a locked middle row that cannot be opened.
- [Icons & Badges](./accordion/c-accordion-6.md): Advanced accordion with custom icons and badges. Best for spaced card rows led by an icon tile, one open at a time, with a New badge and the panel text indented under the label.
- [In Frame](./accordion/c-accordion-7.md): Accordion items integrated within Frame and FramePanel. Best for settings rows with icon tiles joined in a stacked Frame, where each panel opens without closing the others.
- [Nested](./accordion/c-accordion-8.md): Nested accordion example with bordered items. Best for a product details list where one section opens onto its own inner set of sub sections, both levels open on load.
- [User List](./accordion/c-accordion-9.md): User list accordion with avatars and role indicators. Best for team members shown by avatar, name and role badge, each opening to a summary of what they may access.
- [Rotating Arrow](./accordion/c-accordion-10.md): Accordion with rotating arrow indicator. Best for a chevron ahead of each question that turns to point down when open, with the answer indented under the text.
- [Setup Steps](./accordion/c-accordion-11.md): Accordion component for onboarding or setup steps with icons, badges, and QR codes. Best for a 3 step setup checklist with done, in progress and pending states, the open step holding an email field and QR code.
