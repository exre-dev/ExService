<!-- Generated from resources/components/signature-pad/c-signature-pad-4.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Signing Workspace

> Signing workspace

- Type: example, free and open source (MIT)
- Component: [Signature Pad](../signature-pad.md)
- Page: [local reference](./c-signature-pad-4.md)
- Uses: Badge, Button, Card, Dropdown Menu, Separator, Signature Pad

## Best for

Ink and weight picked from ghost icon menus under the pad, an animated replay of the drawing, and Edit to reopen it once signed

## Agent notes

- Sign statement only stores a formatted date in `signedAt`; send `strokes` to your API from that handler
- Base radio items carry `closeOnClick` so a pick closes the menu; the radix twin closes on its own and drops the prop

## When not to use

- An agreement that asks for a consent tick and offers no drawing tools: use [Agreement Card](./c-signature-pad-7.md)

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Signature Pad

### When to use

- Contracts, agreements and statements of work signed in place, down to initials per clause
- Required form fields, proof of delivery on a phone and a profile signature reused on documents
- Mouse, finger or stylus ink exported as PNG, JPEG, SVG or JSON, or uploaded as an image Blob

### When not to use

- A sign in or sign up page where people type an email and a password: use the Auth blocks
- A scanned or photographed mark the signer already has as an image: use [File Upload](../file-upload.md)
- A whole data entry page of typed fields with nothing drawn by hand: use the Form blocks

### Agent notes

- Image exports draw ink with no `color` of its own in black, on a transparent background except `jpeg`; pass `background` for paper white
- `readOnly` locks a signed pad at full ink strength while `disabled` dims it; both stop input and drop the area from the tab order
- With `name` set, keep `format` as `svg` or `json`; `png` and `jpeg` rasterize the hidden form field after every stroke
