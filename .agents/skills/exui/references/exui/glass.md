# Glass material

Glass is a shared translucent surface: a translucent tint, a backdrop blur, an inset edge, and a white inset highlight, with optional SVG refraction driven by one seed per document. Enable it independently of the component's variant and size.

## Enabling it

There are two entry points and they produce the same material.

1. The `glass` prop on a supported surface:

```tsx
<Card glass />
<Button glass variant="danger">Delete</Button>
```

2. The `ex-glass` class on any element, including a plain `div` that uses no ExUI component:

```tsx
<div className="ex-glass" style={{ borderRadius: '0.75rem', padding: '1rem' }}>
  Custom surface
</div>
```

Notes:

- `glass` defaults to `false` and is never forwarded to the DOM.
- The class token is matched exactly, so `ex-glass-foo` is a different class and does not enable the material.
- `glass={false}` does not remove a class you wrote yourself: an explicit `ex-glass` still wins.
- `ex-glass` needs no React context and no ExUI ancestor. Importing `@exre/exui/style.css` is enough.
- The marker does not spread to descendants. Each surface opts in on its own.

## Mounting the seed

```tsx
import '@exre/exui/style.css'
import { GlassSeed } from '@exre/exui'

function App() {
  return (
    <>
      <GlassSeed />
      {/* application */}
    </>
  )
}
```

- Mount one seed per document. Every React root in the same document can share it; an app inside an `iframe` needs its own.
- The seed renders no children, occupies no layout space, is not focusable, and takes no pointer events. It is not a provider.
- It renders static markup, so a server render is safe. The enhancement is turned on in a ref callback once the browser has confirmed it accepts the shared filter chain, and is withdrawn when the seed unmounts. The withdrawal only undoes the value that seed itself wrote, so overlapping seeds and a dev Fast Refresh remount cannot strand a stale reference. A server-rendered page therefore ships the base material and may gain refraction after hydration — a progressive change, not a mismatch.
- Mounting several seeds is not supported.
- The acceptance check tests syntax, not rendering. It cannot prove the engine paints the chain it accepts, and because the filter reference shares one declaration with the blur, an engine that accepts a URL chain and then fails to paint it can lose the blur too. The automated Chromium checks cover computed styles, marker placement, and seed lifecycle; they do not establish rendered refraction quality. Measure the effect in your target browser before relying on the enhancement.

## Supported surfaces

These components accept `glass`. Any other element can still use `className="ex-glass"`.

| Category                  | Components                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actions and markers       | `Button`, `ActionButton`, `InputGroupButton`, `Toggle`, `ToggleGroupItem`, `Badge`                                                                                        |
| Content surfaces          | `Card`, `Alert`, `Item`, `Attachment`, `Bubble`, `BubbleContent`, `BubbleReactions`                                                                                       |
| Input surfaces            | `Input`, `Textarea`, `InputGroup`, `NativeSelect`, `Select`, `SelectTrigger`, `ComboboxInput`, `ComboboxChips`, `ComboboxChip`                                            |
| Dialogs and popups        | `DialogContent`, `AlertDialogContent`, `SheetContent`, `DrawerContent`, `PopoverContent`, `HoverCardContent`, `TooltipContent`                                            |
| Selection and menu panels | `SelectContent`, `ComboboxContent`, `DropdownMenuContent`, `DropdownMenuSubContent`, `ContextMenuContent`, `ContextMenuSubContent`, `MenubarContent`, `MenubarSubContent` |
| Command palette           | `Command`, `CommandDialog`                                                                                                                                                |
| Navigation surfaces       | `Sidebar`, `SidebarInset`, `TabsList`, `TabsTrigger`, `Menubar`                                                                                                           |

Composition details worth knowing:

- `Bubble` paints through its own `BubbleContent`, so `glass` on the `Bubble` is delegated to that child. Enabling `BubbleContent` directly works too, and the two entries never stack.
- `NativeSelect` keeps the classes you pass for layout on its wrapper and paints the material on the inner `select`.
- `Sidebar` applies the material to whichever branch the viewport renders. The mobile branch renders in a `Sheet` and has always ignored `className`; `glass` is carried across because it is a boolean, and nothing else about that branch changed.
- `ComboboxInput` enables the material on the surrounding `InputGroup`.
- `Select glass` enables only its trigger. Use the composed `SelectField` with `SelectTrigger glass` and `SelectContent glass` when both surfaces need glass; the simplified wrapper has no popup-glass option.
- `InputGroup` owns the shared background and focus/invalid ring. Put `glass` on the group, and pass `aria-invalid` to the inner control. `InputGroupInput` and `InputGroupTextarea` stay transparent and do not expose a `glass` prop. `InputGroupButton` inherits the button prop for an independently styled action.
- `DrawerContent glass` keeps its existing rounded, inset panel on `::before`; the content element's background and shadow are cleared so the rectangular box does not cover that panel.
- `TooltipContent glass` retints its built-in arrow with the surface background. The arrow does not add another refraction filter.
- `CommandDialog` puts the material on the dialog surface and clears the palette's own opaque background, but only for a direct `Command` that did not enable the material itself.
- Popup surfaces that ship their own `::before` backdrop layer switch that layer off while the material is on, so two materials never stack.

## Theme customisation

The material reads `--exui-glass-*` custom properties published by the Token stylesheet, in `:root` and overridden in `.dark` and `.pitch-black`.

| Variable                           | Meaning                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `--exui-glass-background`          | Translucent surface colour                                                            |
| `--exui-glass-foreground`          | Matching text colour                                                                  |
| `--exui-glass-border`              | The material's edge colour. It is a colour only — it never sets a border width        |
| `--exui-glass-shadow`              | The material's inset edge. It never replaces a component's outer shadow or focus ring |
| `--exui-glass-blur`                | Backdrop blur radius; built-in value is `0.25rem`                                     |
| `--exui-glass-saturation`          | Backdrop saturation                                                                   |
| `--exui-glass-hover-background`    | Hover tint on surfaces with existing interaction feedback                             |
| `--exui-glass-active-background`   | Active/pressed tint                                                                   |
| `--exui-glass-selected-background` | Selected, checked, or expanded tint                                                   |
| `--exui-glass-fallback-background` | Opaque background when backdrop filtering is unsupported                              |

The material's edge is an inset shadow, never a border. Its built-in thickness is `0.0625rem`; it and the `0.25rem` blur scale with the root font size. The stylesheet adds a separate fixed-pixel white inset highlight. The surface's own border color and state transitions stay intact, so a bordered surface shows both its border and the material's inner edge.

Set direct material values on the surface or an ancestor to restyle it:

```css
.panel {
  --exui-glass-blur: 1rem;
  --exui-glass-background: rgb(255 255 255 / 0.6);
}
```

Declare a matching hover/active/selected background when an interactive surface needs a complete custom palette. For overrides of referenced values, such as a local edge color, also redeclare `--exui-glass-shadow: inset 0 0 0 0.0625rem var(--exui-glass-border)` in that scope; an inherited shadow value may already have resolved its reference at the theme root. See [Token customization](token-customization.md).

Danger semantics have their own values (`--exui-glass-danger-*`). Components derive the tone from their variants, so use `variant="danger"` or the component's destructive variant rather than internal marker attributes. Adding `ex-glass` later still uses that tone. Glass state priority is active, then selected, then hover, then default; disabled surfaces retain the default material tint and their component's disabled feedback.

## What it does not change

- Layout and geometry: no `display`, `position`, `z-index`, size, padding, gap, radius, or `overflow` change, and no new wrapper element.
- States: hover, active, focus-visible, invalid, disabled, selected/pressed/expanded keep their existing feedback and stay distinguishable. A static `div` does not become hoverable just because it is glass.
- Outer shadows and focus rings: they are composed with the material's inset edge, not replaced.

## Degradation

| Condition                                                                    | Result                                                                                                                                                      |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No seed mounted                                                              | Base translucency and blur; the chain contains no filter URL                                                                                                |
| Seed mounted and the engine accepts the chain                                | Base material plus refraction, provided the engine also paints the chain — see the limitation below                                                         |
| Seed mounted, the engine accepts the chain, and the engine fails to paint it | Neither: the reference shares one declaration with the blur, so a dropped chain takes the blur with it. This is the case the acceptance check cannot detect |
| `backdrop-filter` unsupported                                                | An opaque themed background, so the surface stays readable and interactive                                                                                  |
| Seed unmounted                                                               | The enhancement is withdrawn; the surface keeps the base material                                                                                           |

## Boundaries

- A non-`none` `backdrop-filter` makes the element a containing block for absolutely and fixed positioned descendants. Do not wrap viewport-anchored content in a glass surface and expect its coordinates to be unchanged; keep such content in a portal.
- The material samples what is actually behind the element in DOM order. It does not promise that a nested surface sees the page background through its ancestors' effects.
- Every glass surface costs a backdrop sample. Do not apply it to every row of a long list or stack many layers of refraction.
- Theme follows real DOM inheritance. A subtree that carries a theme class and then portals out of that subtree does not carry the theme with it; apply the theme to the portal container instead.
- Danger surfaces override `--exui-glass-border` locally. That variable inherits into nested content; give nested custom surfaces their own values when isolating palettes, and follow the referenced-variable rule above for their shadow.
- Shadow DOM and cross-`iframe` filter sharing are not part of the contract.

For a runnable version of everything above, see [完整示例：玻璃材质](../../examples/glass-surfaces.tsx).
