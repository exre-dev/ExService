<!-- Generated from resources/components/signature-pad/c-signature-pad-10.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Clause Initials

> Initials per clause

- Type: example, free and open source (MIT)
- Component: [Signature Pad](../signature-pad.md)
- Page: [local reference](./c-signature-pad-10.md)
- Uses: Badge, Button, Item, Signature Pad

## Best for

Small pads with a thinner ink range in 4 item rows, holding back Submit until every row has a mark

## Agent notes

- Replace `CLAUSES` with your contract sections, keeping each `id` unique since `initialed` is keyed by it
- `initialed` keeps only a yes or no per clause, never the strokes, and Submit initials only sets `submitted`; store the strokes too

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
