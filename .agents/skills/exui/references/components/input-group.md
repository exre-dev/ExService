<!-- Generated from resources/components/input-group.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Input Group

> Open-source shadcn input group components for prefixed inputs, suffixed actions, and combined form controls.

- Type: shadcn/ui component, free
- Page: [local reference](./input-group.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/input-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/input-group.md
- Examples: 40

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `InputGroup`, `InputGroupButton`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { InputGroup } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof InputGroup>) {
  return <InputGroup {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Text fields with a leading icon, prefix or suffix text, a unit or a status mark inside one border
- Search, link and API bars that end in a copy, clear, filter, menu or send control
- Prompt and comment composers: a text area with a toolbar row above or below the text

## When not to use

- Selects, fields and actions joined edge to edge, each keeping its own border: use [Button Group](./button-group.md)
- A plain text field with no icon, text or action inside its border: use [Input](./input.md)
- A complete assistant screen with a message thread above the prompt box: use the AI Chat blocks

## Agent notes

- The border turns red from `aria-invalid` on the control; `data-invalid` on `Field` only tints text, so set both as `c-input-group-3` does
- Addon icons and text never name the control; tie a `FieldLabel` to the input or textarea id as `c-input-group-20` does, or give it an aria label
- `InputGroupButton` defaults `type` to button, so pass submit when it should send the surrounding form

## Third-party libraries

- Sonner v2: [API reference](https://sonner.emilkowal.ski/toast), [docs](https://sonner.emilkowal.ski/getting-started), used by 2 of 40 examples

## Examples

- [Basic](./input-group/c-input-group-1.md): Basic input group. Best for the bare shell: one field inside the bordered wrapper with no addon yet, the base to add icons, text or controls to.
- [Disabled](./input-group/c-input-group-2.md): Input group in disabled state. Best for a locked field that takes no focus or typing, with its Field wrapper flagged as disabled to match.
- [Invalid](./input-group/c-input-group-3.md): Input group in invalid state. Best for the error look on its own, a red border on the whole wrapper with no message text printed below it.
- [Prefix Icon](./input-group/c-input-group-4.md): Input group with prefix icon. Best for a single leading search icon ahead of the field, with nothing at the trailing end.
- [Suffix Icon](./input-group/c-input-group-5.md): Input group with suffix icon. Best for an email field with a mail icon after the typed text and nothing before it.
- [Prefix Suffix Icons](./input-group/c-input-group-6.md): Input group with both prefix and suffix icons. Best for a listening state with a mic icon before the field and a pulsing red broadcast icon after it.
- [Prefix Text](./input-group/c-input-group-7.md): Input group with prefix text addon. Best for a fixed https scheme printed ahead of a domain field as muted prefix text.
- [Suffix Text](./input-group/c-input-group-8.md): Input group with suffix text addon. Best for a username field followed by a fixed mail domain as trailing text.
- [Prefix Suffix Text](./input-group/c-input-group-9.md): Input group with both prefix and suffix text addons. Best for a money amount with a dollar sign before and a USD code after a number field.
- [Action Button](./input-group/c-input-group-10.md): Input group with action button addon. Best for a text Search control at the trailing end of a query field, with no icon on either side.
- [Icon Button](./input-group/c-input-group-11.md): Input group with icon button action. Best for a read only share URL with one icon only copy control at the end.
- [Dropdown Select](./input-group/c-input-group-12.md): Input group with dropdown menu selection. Best for a calling code menu at the start of a phone field, its trigger showing the picked code such as +1.
- [Keyboard Shortcut](./input-group/c-input-group-13.md): Input group with keyboard shortcut (Kbd). Best for a documentation search ending in a single Command K key hint.
- [Tooltip Action](./input-group/c-input-group-14.md): Input group with tooltip action. Best for a numeric limit with an info icon control whose tooltip explains the value on hover or focus.
- [Loading Spinner](./input-group/c-input-group-15.md): Input group with loading spinner. Best for a busy state: a locked field keeping its value while a spinner turns at the trailing end.
- [Block-Start Addon](./input-group/c-input-group-16.md): Input group with block-start addon. Best for a header row inside the border above the field, holding a User Profile caption with an info icon pushed to its far end.
- [Character Limit](./input-group/c-input-group-17.md): Textarea input group with dynamic character limit. Best for a multi line description whose bottom row counts typed characters live against a 140 limit.
- [AI Chat Toolbar](./input-group/c-input-group-18.md): AI Chat textarea with rich toolbar actions. Best for a prompt box whose bottom toolbar holds add, voice and web search tools, a model menu and a send arrow.
- [AI Chat Attachments](./input-group/c-input-group-19.md): AI Chat interface with file and context attachments. Best for a composer with a top row of an @ mention button and file and tab count chips over the text, and a model menu below.
- [Label Usage](./input-group/c-input-group-20.md): Input group demonstrating label usage. Best for a visible Search Components label above the border, tied to the field through a matching id.
- [Multiple End Actions](./input-group/c-input-group-21.md): Input group with multiple icons/buttons at the end. Best for a trailing pair of a muted star icon and an icon only copy control after a name field.
- [Popover Trigger](./input-group/c-input-group-22.md): Input group with popover trigger addon. Best for a read only address led by a green shield that opens a Secure Connection popover on click.
- [Sparkles Shortcut](./input-group/c-input-group-23.md): Input group with Sparkles icon and complex Kbd shortcut. Best for an AI generate field led by a green sparkles icon and ending in a Command plus Enter key chord.
- [Success Indicator](./input-group/c-input-group-24.md): Input group with success indicator circle. Best for a filled username followed by a small green circle with a white check, marking the value as accepted.
- [Results Count](./input-group/c-input-group-25.md): Input group with search results count. Best for a log search with a leading search icon and a muted 12 results count at the trailing end.
- [Textarea Actions](./input-group/c-input-group-26.md): Textarea input group with action buttons. Best for a comment box with Cancel at the left and Post Comment at the right of its bottom row.
- [Button Group](./input-group/c-input-group-27.md): Input group wrapped in a button group with text prefixes/suffixes. Best for a domain field held between https and dot com cells that sit outside its border, all joined at shared seams.
- [Three Dot Menu](./input-group/c-input-group-28.md): Input group with a menu button (three dots) at the end. Best for a file name field ending in a three dot menu of Rename, Duplicate and a red Delete.
- [Pill Category](./input-group/c-input-group-29.md): Pill-shaped input group with a category dropdown at the end. Best for a fully rounded product search ending in a category menu that starts unset and shows the picked one.
- [Inline Addons](./input-group/c-input-group-30.md): Input group with inline addons (no separating borders). Best for a euro amount whose sign and EUR code are set off from the field by thin vertical rules on both sides.
- [Inline Block-End](./input-group/c-input-group-31.md): Input group with inline start and block-end addon. Best for a muted euro sign hugging the amount with no rule, and a single thin rule setting the EUR code apart.
- [Member Row](./input-group/c-input-group-32.md): Member row with avatar, email and role selection. Best for a member row with a small avatar before the handle and an Admin, Member or Viewer role menu after it.
- [Project Save](./input-group/c-input-group-33.md): Project save interface with status and action buttons. Best for a wide create panel stacking a name line over a description beside an icon tile, then a Save to menu, Cancel and Save.
- [Pill AI Prompt](./input-group/c-input-group-34.md): Pill-shaped AI prompt bar with voice and audio icons. Best for a tall pill prompt bar: a plus opening an upward tools menu with a More submenu, and mic and voice buttons at the far end.
- [Password Toggle](./input-group/c-input-group-35.md): Password input with visibility toggle. Best for a password field with a lock icon in front and an eye control that reveals or hides the characters.
- [API Request](./input-group/c-input-group-36.md): API request input with method selector and send action. Best for an API endpoint bar led by a color coded GET, POST, PUT, PATCH or DELETE menu and ending in Send.
- [Order Search](./input-group/c-input-group-37.md): Order search input with status filter. Best for an order search with a clear control that appears once typing starts and a Status popover of checkboxes with a count.
- [Company Search](./input-group/c-input-group-38.md): Company search input with region selector. Best for a company search scoped by a globe region menu of Global, United States, Europe and APAC, plus a clear control.
- [Contact Search](./input-group/c-input-group-39.md): Contact search input with filter and actions menu. Best for a contact search with per status totals in its filter popover and a more actions menu for bulk email, export and add.
- [Share Link](./input-group/c-input-group-40.md): Share link input with visibility selector and copy action. Best for an editable share link with a Private, Team or Public access menu and a copy control at the end.
