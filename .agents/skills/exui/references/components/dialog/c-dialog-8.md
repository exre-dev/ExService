<!-- Generated from resources/components/dialog/c-dialog-8.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Cookie Consent

> Cookie consent dialog

- Type: example, free and open source (MIT)
- Component: [Dialog](../dialog.md)
- Page: [local reference](./c-dialog-8.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/dialog.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/dialog.md
- Uses: Button, Dialog, Label, Switch

## Best for

Cookie category switches with a locked essential row and Save Preferences or Accept All actions

## Agent notes

- The `Switch` rows are uncontrolled and neither footer button has a handler or closes the dialog; wire both to your consent store

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Dialog

### When to use

- Short forms and settings that need an answer before the page continues
- Long text such as terms, read in a scrolling body that can grow to nearly full screen
- Reference overlays and notices, such as a keyboard shortcuts list or a session timeout

### When not to use

- A yes or no confirmation before a destructive action: use [Alert Dialog](../alert-dialog.md)
- Long forms or record details that slide in from the screen edge: use [Sheet](../sheet.md)
- Mobile panels that open from the bottom and close with a swipe: use [Drawer](../drawer.md)

### Agent notes

- Compose the trigger through `render` on the base twin and `asChild` on the radix twin; the other one is silently ignored
- `DialogContent` renders its own close button; pass `showCloseButton` as false to drop it
