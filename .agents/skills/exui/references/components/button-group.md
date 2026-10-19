<!-- Generated from resources/components/button-group.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Button Group

> Open-source shadcn button group components for segmented controls, toolbar actions, and view switchers.

- Type: shadcn/ui component, free
- Page: [local reference](./button-group.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/button-group.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/button-group.md
- Examples: 57

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Connected controls

`ButtonGroup` keeps adjoining controls connected with square inner corners and one shared border, including `InputGroup`, Select triggers and captions. These seams remain connected when the application compiles its own utility stylesheet. Use `orientation="vertical"` for stacked controls.

Use `ButtonGroupText` for a noninteractive caption or count; `asChild` keeps the joining behavior on your own element. Nested `ButtonGroup` elements form separate, spaced clusters. A Select's hidden native form control does not become a visible segment or remove the last trigger's outer corners.
<!-- exui-capabilities:end:skill -->

## When to use

- Toolbars of related actions joined into one strip, such as editor, media, zoom or export controls
- Split buttons that pair a main action with a chevron menu of its variants, such as Save or Publish
- Segmented pickers and filter bars that join buttons to selects, inputs, counters and status text

## When not to use

- Segmented choices whose pressed option screen readers must hear announced: use [Toggle Group](./toggle-group.md)
- A text field with an icon, prefix or action drawn inside its own border: use [Input Group](./input-group.md)
- A single standalone action, or actions spaced apart with no shared border: use [Button](./button.md)

## Agent notes

- On the base twin only children with a `data-slot` join at the seams, while radix joins every child; wrap custom markup in `ButtonGroupText`
- `ButtonGroup` sets `role` group but no name; pass `aria-label` so screen readers say what the set controls

## Examples

- [Two Buttons](./button-group/c-button-group-1.md): Basic button group with two buttons. Best for the minimal join: 2 outline text buttons sharing one seam, with no icons, menus or handlers.
- [Button & Input](./button-group/c-button-group-2.md): Button group with button followed by input. Best for an outline button fused to the left end of a plain text field, the smallest control and field pair.
- [Buttons & Badge](./button-group/c-button-group-3.md): Button group with buttons and badge. Best for mixed content in one strip: a file icon with a Draft badge, an Edit button with text and an icon only upload.
- [Dropdown Menu](./button-group/c-button-group-4.md): Button group with dropdown menu. Best for an Update action beside a chevron menu of Production, Staging and Development deploy targets.
- [Team Activity](./button-group/c-button-group-5.md): Team activity and collaboration group. Best for a team presence strip: Team button, 3 stacked avatars with a 3 Live dot, plus and clock icons and a settings menu.
- [Icon Actions](./button-group/c-button-group-6.md): Button group using icons for visual actions. Best for icon only flip horizontal, flip vertical and rotate tools, with no text on any of them.
- [Status Indicator](./button-group/c-button-group-7.md): Dropdown menu with status indicator. Best for a deploy status strip: a branch menu with main checked, a pulsing Production dot, then refresh and open icons.
- [Like Counter](./button-group/c-button-group-8.md): Button group styled as a like button with a counter. Best for a Like action with a heart icon fused to a 1.2K count styled as a matching outline cell.
- [Nested Groups](./button-group/c-button-group-9.md): Nested button groups for complex action sets. Best for nested groups that set an icon only send button apart from a message field with a Voice Mode tooltip addon.
- [Basic Pagination](./button-group/c-button-group-10.md): Button group used for standard pagination. Best for previous and Next text buttons with arrows around small page numbers 1 to 3, none marked as current.
- [Split Pagination](./button-group/c-button-group-11.md): Pagination split into page numbers and navigation arrows. Best for icon only arrows hugging small page numbers 1 to 3, with all 5 buttons nested in one inner group.
- [Text Alignment](./button-group/c-button-group-12.md): Button group for editor text alignment controls. Best for left, center, right and justify alignment as small icon buttons, each named for screen readers.
- [Vertical Orientation](./button-group/c-button-group-13.md): Vertical button group orientation. Best for a vertical pair of named add and subtract icon buttons stacked into one column.
- [Vertical Tool Palette](./button-group/c-button-group-14.md): Nested vertical button group for complex tool palettes. Best for a vertical tool palette of search, copy and share icons, with delete held apart in its own group below.
- [Star With Dropdown](./button-group/c-button-group-15.md): Star button group with count and dropdown. Best for a repository Star action with a 2.4k badge and a chevron menu from Watch and Fork down to Report.
- [Search Filter Clear](./button-group/c-button-group-16.md): Search input with filter menu and clear button. Best for a record filter bar: a Filter scope menu, a plain search field and an X button at the end.
- [Conversation Menu](./button-group/c-button-group-17.md): Button group with comprehensive action menu. Best for a Conversation button with a kebab menu of 6 thread actions above a red Delete Conversation item.
- [Git Split Button](./button-group/c-button-group-18.md): Advanced git toolbar with branch selection and split commit button. Best for a filled Execute split with a play icon and a chevron menu to commit and push, sync or amend.
- [Search With Menu](./button-group/c-button-group-19.md): Button group with dropdown menu and input group. Best for a search field with a leading magnifier icon and an icon only kebab menu of record scopes at its end.
- [Search With Button](./button-group/c-button-group-20.md): Button group with input group and button. Best for a search field ending in a filled primary Search button that opens a menu of record scopes.
- [File Name Menu](./button-group/c-button-group-21.md): Button group with dropdown menu and input group. Best for a file name field with a leading file icon and a plus menu to create a file, folder or workspace.
- [Disabled Button](./button-group/c-button-group-22.md): Basic button group with disabled button. Best for files, Folder and Trash text buttons with icons, where the middle one is disabled and dimmed.
- [Separated Buttons](./button-group/c-button-group-23.md): Button group buttons with separators. Best for filled primary Files, Folder and Media buttons with borders stripped, split by tinted separators.
- [Dashboard Views](./button-group/c-button-group-24.md): View switcher for dashboard layouts. Best for grid, list and table view icons named for screen readers, with no current view tracked or shaded.
- [Rating Scale](./button-group/c-button-group-25.md): Rating scale using numerical buttons. Best for a 1 to 10 likelihood scale with Not likely and Very likely end labels, the picked score filled.
- [User Selection](./button-group/c-button-group-26.md): Button group with user selection select. Best for a team member Select with avatar and name in its trigger, joined to add tag and settings icons.
- [Status Select](./button-group/c-button-group-27.md): Button group with select status addon. Best for a status Select with colored dots, preset to Completed, joined to a task search field.
- [Volume Control](./button-group/c-button-group-28.md): Volume controller with plus/minus actions. Best for a volume stepper moving in steps of 5 from 0 to 100, whose middle readout toggles mute on click.
- [Follower Count](./button-group/c-button-group-29.md): Button group with follower count. Best for an outline Follow action with a user plus icon and a muted 2.4k followers caption beside it.
- [Active Count](./button-group/c-button-group-30.md): Active state button group with count. Best for a filled Star action whose 2.4k count sits in a text cell outlined in the primary color.
- [Share Caption](./button-group/c-button-group-31.md): Horizontal button group with primary and secondary labels. Best for a filled Share action trailed by a 128 Shares caption on a transparent, tightly padded text cell.
- [Sort & View](./button-group/c-button-group-32.md): Button group with dropdown menu and view toggle. Best for a sort icon menu, a grid or list pair and a filled Add New menu in one row, with only the view pair joined.
- [Select Controls](./button-group/c-button-group-33.md): Button group with select controls. Best for joined environment and time range Selects, the range list split into recent and Observability Plus groups.
- [Segmented Control](./button-group/c-button-group-34.md): Segmented control with dropdown inside button group. Best for routes, Paths and Bot Name segments with icons, Paths shaded first, ending in a chevron options menu.
- [Numbered Pagination](./button-group/c-button-group-35.md): Pagination button group. Best for square page buttons 1 to 5 between chevrons, with page 3 filled to mark the current page.
- [View Switcher](./button-group/c-button-group-36.md): View switcher button group. Best for list, grid and table view icons with the list view shaded as current by a fixed class.
- [Zoom Controls](./button-group/c-button-group-37.md): Zoom controls button group. Best for a zoom stepper of 10 percent steps between 10 and 200, the level shown in a fixed width text cell.
- [Media Controls](./button-group/c-button-group-38.md): Media player controls button group. Best for skip back, play and skip forward transport icons, each named for screen readers, with no playback state.
- [Split Button](./button-group/c-button-group-39.md): Split button with dropdown trigger. Best for a filled Save split with a faint separator and a chevron menu to publish, keep a draft or exit.
- [Vertical List](./button-group/c-button-group-40.md): Vertical button group. Best for a vertical list of 4 left aligned text items with no icons, Dashboard shaded as current.
- [Model Selector](./button-group/c-button-group-41.md): Model selector with tier badges. Best for an AI model picker with icons, Fast, Pro and Preview badges and a context size tooltip per model.
- [Order Type](./button-group/c-button-group-42.md): Segmented order type selector. Best for a trading order type picker for Market, Limit, Stop and Stop Limit, each with an explanatory tooltip.
- [Buy Sell Hold](./button-group/c-button-group-43.md): Buy sell hold toggle group. Best for buy, Hold and Sell stances that fill when picked and clear on a second click, starting with none.
- [Pipeline Stage](./button-group/c-button-group-44.md): Pipeline stage mover with dropdown. Best for a CRM stage stepper whose arrows disable at the ends around a Jump to stage menu with a check.
- [Environment Switcher](./button-group/c-button-group-45.md): Environment switcher with indicator. Best for dev, Staging and Production segments with tooltips, where a Live dot appears only while Production is on.
- [Time Interval](./button-group/c-button-group-46.md): Compact time interval selector. Best for compact time intervals from 1m to 1W plus Auto, on 28px tall buttons with small tabular text.
- [Review Actions](./button-group/c-button-group-47.md): Review actions split button. Best for a filled Approve split whose chevron menu offers approve with conditions, request changes or a red Reject.
- [Export Toolbar](./button-group/c-button-group-48.md): Toolbar filter with export and view toggle. Best for one joined toolbar: Filter, Export CSV with a chevron for Excel, JSON and PDF, then a grid or list switch.
- [Vertical Nav](./button-group/c-button-group-49.md): Vertical nav links with icons. Best for a vertical nav of 4 icon and text items where a click moves the shaded highlight.
- [Filter Sort More](./button-group/c-button-group-50.md): Toolbar filter sort and more. Best for small icon only Filter and Sort buttons, a default separator, then a More menu for link, share and export.
- [Create Menu](./button-group/c-button-group-51.md): New button with create dropdown. Best for a small New button with a plus joined to a more menu that creates a customer, order or invoice.
- [Dashboard Actions](./button-group/c-button-group-52.md): Refresh share and export dropdown. Best for dashboard header actions: an icon only refresh, a Share button and a More menu to edit or export CSV or PNG.
- [Publish Controls](./button-group/c-button-group-53.md): Publish controls with split button and overflow. Best for a publishing header row: 2 viewer avatars, a Preview button, a filled Publish split and a ghost overflow menu.
- [Service Selectors](./button-group/c-button-group-54.md): API service environment and version selectors. Best for compact API service, environment and version menus joined in a row, the version set in monospace.
- [Payout Release](./button-group/c-button-group-55.md): Payout release controls with amount context. Best for a payout row: a USD 12,480 amount cell joined to Hold, beside a filled Release split with Cancel payout.
- [File Attachment](./button-group/c-button-group-56.md): Attachment button group with download action. Best for a file chip: paperclip, file name and size on an extra small button, joined to an icon only download.
- [Agent Mode](./button-group/c-button-group-57.md): Agent mode selector with credit cap dropdown. Best for assist, Review and Auto agent modes, a default separator and a credit cap menu from 2k credits to Unlimited.
