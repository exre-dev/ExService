<!-- Generated from resources/components/signature-pad.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Signature Pad

> Open-source shadcn signature pad components for e-signature forms, agreements, and proof of delivery.

- Type: upstream component, free
- Page: [local reference](./signature-pad.md)
- Examples: 12

## When to use

- Contracts, agreements and statements of work signed in place, down to initials per clause
- Required form fields, proof of delivery on a phone and a profile signature reused on documents
- Mouse, finger or stylus ink exported as PNG, JPEG, SVG or JSON, or uploaded as an image Blob

## When not to use

- A sign in or sign up page where people type an email and a password: use the Auth blocks
- A scanned or photographed mark the signer already has as an image: use [File Upload](./file-upload.md)
- A whole data entry page of typed fields with nothing drawn by hand: use the Form blocks

## Agent notes

- Image exports draw ink with no `color` of its own in black, on a transparent background except `jpeg`; pass `background` for paper white
- `readOnly` locks a signed pad at full ink strength while `disabled` dims it; both stop input and drop the area from the tab order
- With `name` set, keep `format` as `svg` or `json`; `png` and `jpeg` rasterize the hidden form field after every stroke

## Examples

- [Pinned Actions](./signature-pad/c-signature-pad-1.md): Pinned clear and save. Best for a bottom corner Clear and Save pair, with Save redrawing the kept strokes as a small preview under the pad.
- [Undo & Redo](./signature-pad/c-signature-pad-2.md): Undo and redo toolbar. Best for history buttons in a row above the pad, a Ctrl Z hint on wider screens and a labelled Clear at the far end.
- [Form Validation](./signature-pad/c-signature-pad-3.md): Form field with validation. Best for a name input and a pad read back from FormData on submit, showing a field error when the pad was left empty.
- [Signing Workspace](./signature-pad/c-signature-pad-4.md): Signing workspace. Best for ink and weight picked from ghost icon menus under the pad, an animated replay of the drawing, and Edit to reopen it once signed.
- [Export Formats](./signature-pad/c-signature-pad-5.md): Export PNG, JPEG, SVG or JSON. Best for one Save button per format in a labelled group, the output shown in a Frame panel as an image or raw JSON text.
- [Draw or Type](./signature-pad/c-signature-pad-6.md): Draw or type. Best for a typed name echoed in large serif italics as the other tab, and one Adopt and sign button for whichever tab is open.
- [Agreement Card](./signature-pad/c-signature-pad-7.md): Agreement signing card. Best for a consent checkbox that must be ticked before the full width Sign agreement button enables, and Start over in the header.
- [In Dialog](./signature-pad/c-signature-pad-8.md): Signature in a dialog. Best for edits made on a draft copy so Cancel keeps the stored mark, shown afterwards as a small preview in the row footer.
- [Stylus Mode](./signature-pad/c-signature-pad-9.md): Stylus mode with palm rejection. Best for a switch that limits drawing to a stylus, and a badge naming which pointer drew the last stroke.
- [Clause Initials](./signature-pad/c-signature-pad-10.md): Initials per clause. Best for small pads with a thinner ink range in 4 item rows, holding back Submit until every row has a mark.
- [Proof of Delivery](./signature-pad/c-signature-pad-11.md): Proof of delivery. Best for a narrow order card whose large full width button needs a typed receiver and ink, then locks both.
- [File Upload](./signature-pad/c-signature-pad-12.md): Upload with apiRef. Best for a 3x scale PNG Blob wrapped in a File object, with Attach and Clear buttons outside the pad driving it by ref.
