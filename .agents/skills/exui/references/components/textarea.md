<!-- Generated from resources/components/textarea.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Textarea

> Open-source shadcn textarea components for comments, long-form input, and support tickets.

- Type: shadcn/ui component, free
- Page: [local reference](./textarea.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/textarea.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/textarea.md
- Examples: 6

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Textarea`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Textarea } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Textarea>) {
  return <Textarea {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Messages, feedback and other free text answers that run over several lines
- Labeled long text fields with a hint under the box, an error state or a disabled state
- Profile bios that count characters toward a limit and grow as the user types

## When not to use

- A comment or prompt box with buttons or a live count inside its border: use [Input Group](./input-group.md)
- A modal that asks for a note along with reasons to tick, such as a churn survey: use the Dialog blocks
- A complete page of fields, such as a support ticket or a profile edit, saved together: use the Form blocks

## Agent notes

- `Textarea` grows with its text through `field-sizing-content` with no height cap, and Chromium ignores `rows`; set min-h and max-h classes
- Only `aria-invalid` on `Textarea` turns its border red, in every style; a data-invalid flag on `Field` leaves the border as it was

## Examples

- [Basic](./textarea/c-textarea-1.md): Basic textarea.. Best for the bare multi line box with placeholder text and no label, Field or hint around it.
- [Invalid](./textarea/c-textarea-2.md): Invalid textarea.. Best for the red invalid state set by aria-invalid alone, with no label or message saying what is wrong.
- [With Label](./textarea/c-textarea-3.md): Textarea with label.. Best for a Your Message label above the box, tied to it by htmlFor and id, with nothing printed below.
- [With Description](./textarea/c-textarea-4.md): Textarea with description.. Best for a Feedback label above the box and one line of help text printed below it.
- [Disabled](./textarea/c-textarea-5.md): Disabled textarea.. Best for a labeled box locked by the disabled attribute, dimmed to half opacity with a not allowed cursor.
- [Auto-Resize Counter](./textarea/c-textarea-6.md): Auto-resize textarea with character count. Best for a 280 character Bio whose live count by the label turns to the warning tone 20 short of the cap and red at it.
