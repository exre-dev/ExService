<!-- Generated from resources/components/label/c-label-12.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Inline Edit

> Label with inline edit toggle

- Type: example, free and open source (MIT)
- Component: [Label](../label.md)
- Page: [local reference](./c-label-12.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/label.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/label.md
- Uses: Button, Field, Input, Label

## Best for

A project name shown as read only text until a pencil button beside the name swaps in an input, then a check swaps it back

## Agent notes

- `value` is local state seeded with a sample name, and the check only flips `isEditing`; save the value at that point
- The pencil `Button` holds only an icon and no aria-label, so it reaches screen readers unnamed
- The radix `Button` sets no type, so in a form the pencil submits it; the base twin defaults to type button

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Label

### When to use

- Visible names for text inputs, text areas and checkboxes, each tied to its control by id
- Marks beside the field name: required or optional, a status badge or dot, an info tooltip or an edit toggle
- Field states and hints around the name: disabled, invalid, helper text under it and a live character count

### When not to use

- Form rows that need hint and error slots, grouped sets or a side by side layout: use [Field](../field.md)
- The text box itself, with typed entry for email, password, number or file: use [Input](../input.md)
- Lists of tick boxes, a mixed state or selectable cards with a ticked state: use [Checkbox](../checkbox.md)

### Agent notes

- Every `htmlFor` and its matching `id` is a fixed string such as `label-required`; make each pair unique when a field renders more than once
- `data-disabled` on `Field` does not dim a plain `Label`, whose dim rule needs an unnamed `group` ancestor while `Field` is a named group
