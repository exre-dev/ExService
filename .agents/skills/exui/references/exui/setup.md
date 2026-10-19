# ExUI consumer setup

## Package and runtime

Use `@exre/exui` as one public package. React UI requires the host's React and React DOM 19 (`>=19 <20`); the root is ESM only. TypeScript consumers also need the host React type packages. General-purpose application icons use a direct `lucide-react` dependency. ExUI bundles its implementation libraries; install an additional library only when the application itself imports it.

```tsx
import '@exre/exui/style.css'
import { Button, Card, CardContent } from '@exre/exui'
import { SaveIcon } from 'lucide-react'

export function SaveCard() {
  return (
    <Card>
      <CardContent>
        <Button type="button">
          <SaveIcon aria-hidden="true" data-icon="inline-start" />
          Save
        </Button>
      </CardContent>
    </Card>
  )
}
```

The component stylesheet includes Tokens and fonts; do not import either Token CSS again on that application path. In a token-only/non-React app, import `@exre/exui/tokens/style.css`, optionally `@exre/exui/tokens/font.css`, and read `exuiTokens`/`componentRecipes` from `@exre/exui/tokens`. That JS entry supports ESM and CommonJS without React.

## Supported entries

| Entry                         | Use                                                          |
| ----------------------------- | ------------------------------------------------------------ |
| `@exre/exui`                  | React components, hooks, public types and bundled namespaces |
| `@exre/exui/style.css`        | Full component styles, Tokens and font                       |
| `@exre/exui/tokens`           | Framework-neutral frozen Token/recipe data and types         |
| `@exre/exui/tokens/style.css` | Variables only, no component or glass behavior               |
| `@exre/exui/tokens/font.css`  | Optional font for token-only consumers                       |
| `@exre/exui/docs/theme.css`   | Fumadocs integration; see [docs theme](docs-theme.md)        |

There are no supported component subpath imports. Do not use package `src`, `dist`, `types`, application-local component aliases or the private `@exre/exui-tokens` workspace name.

## Bundled namespaces and adapters

Use `TanStackTable` from the root for DataGrid's v9 table instance and `Recharts` for chart primitives. Use root `toast` with root `Toaster`; a separately installed Sonner instance has separate state. Consult the [export inventory](../generated/component-exports.md) for alias names, including `Reui`-prefixed collision resolutions.

Radix-derived Button and Dialog triggers use their `asChild` contract. Combobox, Autocomplete, Cascader and NumberField use Base UI contracts even though the package's selected style is Radix Luma. Read declarations component by component rather than translating every `render` or `asChild` mechanically. ExUI's own Form hooks replace upstream form recipes. The old Modal export is removed; use Dialog.

## Scrollspy anchors

Set each `data-scrollspy-anchor` to its section's exact DOM `id`. When composing repeated instances with generated ID prefixes, apply the same prefix to both attributes. Check intermediate sections and click-to-scroll behavior: the first and last active items alone do not prove that the anchor targets resolve.

## Accordion appearance

ExUI's Accordion uses a plain list appearance: no outer border or container radius, transparent open items, and separators between items. Triggers use `py-2.5` with a visible keyboard focus ring; content has no horizontal padding and uses `pb-2.5`. Colors continue to use ExUI's semantic Tokens. This component-specific adaptation does not change the package's other Luma-based components.

Import `Accordion`, `AccordionItem`, `AccordionTrigger`, and `AccordionContent` from `@exre/exui`. The API follows Radix: use `type="single"` with a string `defaultValue`, or `type="multiple"` with a string array. Add `collapsible` to a single accordion when its open item should also close.

```tsx
<Accordion type="single" collapsible defaultValue="delivery">
  <AccordionItem value="delivery">
    <AccordionTrigger>When will my order arrive?</AccordionTrigger>
    <AccordionContent>Track your delivery from your account.</AccordionContent>
  </AccordionItem>
</Accordion>
```

Use `className` on the root or individual items for an optional bordered or tinted composition. `AccordionContent.className` styles the inner content wrapper. The [upstream examples](../components/accordion.md) describe additional compositions, while this section defines ExUI's default appearance and Radix API.

Expanded content sizes to its contents, including nested accordions and text that wraps after a width change. Consumers do not need a height override to keep the content visible.

## Checkbox field appearance

A `FieldLabel` containing a `Checkbox` keeps its background unchanged when the checkbox is toggled, including card and settings-row compositions. The checkbox fill and checkmark still show its checked state, and clicking the label toggles the control.

## Switch field appearance

A `FieldLabel` containing a `Switch` keeps its background unchanged when the switch is toggled, including card and settings-row compositions. The switch track still shows its checked state.

## Radio field appearance

A `FieldLabel` containing a `RadioGroupItem` keeps its background unchanged when an option is selected. The radio circle and indicator show the selection; label clicks and arrow-key navigation still select the corresponding option. Add an explicit background class when the composition needs a tinted row or card.

## Cascader selection appearance

With `multiple`, Cascader shows a checkmark inside each selected checkbox, including when the application's Tailwind utilities load after ExUI CSS. Deselecting an option or clearing the selection hides its checkmark. Multi-select checkboxes remain visible with `indicator={false}`.

## NavigationMenu popup sizing

NavigationMenu's default popup uses its measured content width on desktop and full width below the `md` breakpoint. Its options remain visible and clickable when application Tailwind utilities load after ExUI CSS; consumers do not need a width override for the default viewport.

## Calendar selection appearance

Calendar keeps single and multiple date selections circular throughout the week, including the first and last columns and calendars with week numbers. Range endpoints stay round while the intervening dates form a connected band. Consumers do not need an edge-specific radius override.

## Resizable separator sizing

`ResizablePanelGroup orientation="vertical"` stacks panels with a full-width horizontal separator; `orientation="horizontal"` places panels side by side with a 1px vertical separator. Both directions support dragging in nested groups, including when application Tailwind utilities load in a higher CSS layer. Consumers do not need a width override for the default `ResizableHandle`.

## Local documentation boundary

The [component catalog](../components.md) links family pages whose opening ExUI notes describe reviewed additions and adaptations. Read those notes before the `c-*` pattern descriptions below them. Example descriptions are not full source, and presence in the upstream catalog does not establish an ExUI export or a prop. Read the installed package declarations for exact APIs and version compatibility. Pattern descriptions do not define the installed package contract.

## SSR

The installed root can supply server-renderable components, but browser state belongs in client code. [ThemeProvider](theme-usage.md) reads localStorage during initialization and must mount only in the browser. GlassSeed can server-render static markup. A form schema that uses the browser `File` constructor must be initialized where that constructor exists. Keep initialization schemas stable across rerenders.
