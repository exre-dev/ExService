<!-- Generated from resources/components/label.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Label

> Open-source shadcn label components for form labels, accessible inputs, and field pairing.

- Type: shadcn/ui component, free
- Page: [local reference](./label.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/label.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/label.md
- Examples: 13

## When to use

- Visible names for text inputs, text areas and checkboxes, each tied to its control by id
- Marks beside the field name: required or optional, a status badge or dot, an info tooltip or an edit toggle
- Field states and hints around the name: disabled, invalid, helper text under it and a live character count

## When not to use

- Form rows that need hint and error slots, grouped sets or a side by side layout: use [Field](./field.md)
- The text box itself, with typed entry for email, password, number or file: use [Input](./input.md)
- Lists of tick boxes, a mixed state or selectable cards with a ticked state: use [Checkbox](./checkbox.md)

## Agent notes

- Every `htmlFor` and its matching `id` is a fixed string such as `label-required`; make each pair unique when a field renders more than once
- `data-disabled` on `Field` does not dim a plain `Label`, whose dim rule needs an unnamed `group` ancestor while `Field` is a named group

## Examples

- [Basic](./label/c-label-1.md): Basic label.. Best for the bare pairing of a Username name over one text input, with no marks, hints or states.
- [Checkbox](./label/c-label-2.md): Label paired with a checkbox.. Best for a one line terms consent with the name set to the right of a tick box in a horizontal row.
- [Textarea](./label/c-label-3.md): Label for a textarea field.. Best for a Message name over a multi line text area for longer free text, with no counter or hint.
- [Disabled](./label/c-label-4.md): Label in a disabled state.. Best for a field locked from editing, with the input disabled and the wrapper flagged data-disabled.
- [Required](./label/c-label-5.md): Label with required indicator. Best for an email field marked mandatory by a red asterisk after the name, with the browser required check on the input.
- [Optional](./label/c-label-6.md): Label with optional indicator. Best for a phone number field marked as skippable by muted optional text in parentheses after the name.
- [Tooltip Info](./label/c-label-7.md): Label with tooltip info icon. Best for an API key name followed by a small info icon whose hover or focus opens a hint about where to find the key.
- [Badge](./label/c-label-8.md): Label with badge indicator. Best for a webhook URL with a small Active badge in the success tint beside the name, for a setting whose state matters at a glance.
- [Character Counter](./label/c-label-9.md): Label with character counter. Best for a bio box whose name row carries a running count of typed characters against a 200 limit at the right end.
- [Helper Text](./label/c-label-10.md): Label with helper description text. Best for an API key name with a line of helper copy stacked between it and the input, always on screen.
- [Error State](./label/c-label-11.md): Label with error state. Best for an email that failed validation, its name in red, the box outlined red and an error line under it.
- [Inline Edit](./label/c-label-12.md): Label with inline edit toggle. Best for a project name shown as read only text until a pencil button beside the name swaps in an input, then a check swaps it back.
- [Status Dot](./label/c-label-13.md): Label with status indicator dot. Best for a server status row with a pinging green dot after the name and the current state in a locked input.
