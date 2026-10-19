<!-- Generated from resources/components/button/c-button-5.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Destructive

> Destructive button

- Type: example, free and open source (MIT)
- Component: [Button](../button.md)
- Page: [local reference](./c-button-5.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/button.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/button.md
- Uses: Button

## Best for

An action in a soft destructive tint with destructive text, for delete, remove or revoke

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Button

### When to use

- Page, form and dialog actions in primary, secondary, outline, ghost, destructive and link weights
- Icon only controls and sign in rows, such as close, search, copy, menu or theme switches and provider logos
- Actions that report state or carry extras, such as a spinner, a saved check, a count or a shortcut

### When not to use

- Several related actions joined edge to edge as one segmented control: use [Button Group](../button-group.md)
- A control that stays pressed on or off, such as bold in an editor toolbar: use [Toggle](../toggle.md)
- An action attached inside a text field, such as a search submit or a clear: use [Input Group](../input-group.md)

### Agent notes

- The base twin `Button` defaults to `type` button, so pass `type` submit inside a form; the radix twin renders a plain `button` that submits by default
- A link needs its anchor passed through `render` with `nativeButton` false on the base twin, or wrapped with `asChild` on the radix twin
- Set `data-icon` to inline-start or inline-end on a leading or trailing icon so the text sizes trim the padding on that side
