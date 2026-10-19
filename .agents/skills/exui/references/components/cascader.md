<!-- Generated from resources/components/cascader.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Cascader

> Nested multi-level selection with drill-down navigation, breadcrumbs, search and custom rows.

- Type: upstream component, free
- Page: [local reference](./cascader.md)
- Examples: 21

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.

**ExUI adaptation**

### Cascader selection indicator

In `multiple` mode, each option keeps a visible checkbox even with `indicator={false}`: the box is the selection control, not optional decoration. Selected boxes show a check, and deselecting or clearing hides it. The marker also remains visible when application Tailwind utilities load after ExUI CSS.
<!-- exui-capabilities:end:skill -->

## When to use

- Form fields that commit one value from a nested tree, such as a category, region, file or department
- Picking several nodes at once, such as permissions, report columns or shipping zones with cascading checks
- Deep or large hierarchies as Miller columns, an expanding tree, an inline panel or levels fetched on demand

## When not to use

- A short flat list of options with no nesting: use [Select](./select.md)
- A folder hierarchy browsed on the page rather than picked into a form field: use [Tree](./tree.md)
- A table of records whose cells are edited in place and saved together: use the Editing blocks

## Agent notes

- Parts live in separate files with no index: `CascaderItems` comes from `cascader-item`, while `CascaderInput` and `CascaderValue` come from `cascader-nav`
- Give every node a `value` that is unique across the whole tree, not only within its level; a repeated `value` silently drops the later row

## Third-party libraries

- TanStack Virtual v3: [API reference](https://tanstack.com/virtual/v3/docs/api/virtualizer), [docs](https://tanstack.com/virtual/v3/docs/introduction)
- Base UI v1: [API reference](https://base-ui.com/react/components), [docs](https://base-ui.com/react/overview/quick-start), [llms.txt](https://base-ui.com/llms.txt)
- Radix UI v1: [docs](https://www.radix-ui.com/primitives/docs/overview/getting-started), through the Radix UI twin

## Examples

- [Attribute Picker](./cascader/c-cascader-1.md): Nested attribute picker with drill-down navigation.. Best for person, company and workspace fields with a type icon per row, counts on branches and a trigger path capped at 3 segments.
- [Multi-Select Cap](./cascader/c-cascader-2.md): Multi-select permissions with checkboxes and a selection cap.. Best for product area permissions like billing and deployments, capped at 5, with one disabled row and a clear X over the trigger and in the footer.
- [Deep Search](./cascader/c-cascader-3.md): Deep search across every level with path-annotated results.. Best for a source file tree whose search reaches files below the open folder, with folder paths telling repeated names like page.tsx apart.
- [Footer Flyout](./cascader/c-cascader-4.md): Pinned footer with a side-anchored import flyout.. Best for a property picker whose footer opens a flyout of 7 app and data source logos in 2 named groups.
- [Avatar Rows](./cascader/c-cascader-5.md): Custom rows with avatars and role badges.. Best for an assignee picker by team, each member row with a photo, an online or away dot and a seniority chip, and the face repeated in the trigger.
- [Path Formatting](./cascader/c-cascader-6.md): Trigger path formatting and collapsing.. Best for a connected app tree with a toggle that switches the trigger between collapsed, full, tail, leaf and a custom 2 line readout.
- [Embedded Panel](./cascader/c-cascader-7.md): Embedded panel without a popover.. Best for a docs table of contents searched and drilled right on the page inside a Card, with the list height capped at 240px.
- [Flat Data](./cascader/c-cascader-8.md): Flat adjacency data with a parent pointer.. Best for region and department rows as a database returns them, unsorted with a parent id each, plus a footer command that resets the pick.
- [Controlled State](./cascader/c-cascader-9.md): Controlled path, value, query and open state.. Best for a restaurant menu where outside code drives the open level and search text, and each commit reports its reason and full path.
- [Translated Labels](./cascader/c-cascader-10.md): Translated labels across a country picker.. Best for data and chrome both in German, down to plural forms like 1 Land and 2 Länder and the arrow key hint read to screen readers.
- [Two-Line Rows](./cascader/c-cascader-11.md): Two-line rows with descriptions and a disabled option.. Best for data center locations from country to city, each row a tile plus a second line of counts or region codes, with China locked.
- [Native Form Field](./cascader/c-cascader-12.md): Form field that submits like a native input.. Best for an uncontrolled support topic field in a labelled form, its popup matched to the trigger width and its pick read back from FormData.
- [Columns Mode](./cascader/c-cascader-13.md): Columns mode with independently scrolling panels.. Best for video, audio and article items grouped by library and collection, with a hued tile per library and a runtime chip on items and the trigger.
- [Tree Mode](./cascader/c-cascader-14.md): Tree mode with inline expand and multi-select scopes.. Best for a move to destination picker whose root level splits into Recently used and All spaces, reordering each time a folder is picked.
- [Async Loading](./cascader/c-cascader-15.md): Async drill-down that loads before it navigates.. Best for repositories, releases and paged release assets fetched on demand, with a toned badge per row and a button that fails the next request.
- [Virtualized List](./cascader/c-cascader-16.md): Virtualized level with thousands of rows.. Best for nearly 3,000 generated sales markets with flags, a territory name and a reach badge toned by subscriber tier.
- [Removable Chips](./cascader/c-cascader-17.md): Consumer-rendered removable chips with path-aware labels.. Best for a report builder that adds table columns several at a time, counting them in the trigger and listing each as a removable chip below.
- [Tree Multi-Select](./cascader/c-cascader-18.md): Cascading tree multi-select inside a popover.. Best for shipping zones by continent, region and country, where 1 press takes a whole region and the trigger names top picks plus a country total.
- [Color Dots](./cascader/c-cascader-19.md): Status and priority colour dots via renderLabel.. Best for workflow fields such as status, priority, severity and effort, each value marked by a colored dot that the trigger repeats beside its group.
- [Inherited Colors](./cascader/c-cascader-20.md): Expense accounts with a colour inherited down each branch.. Best for a chart of accounts where any level can be booked, each row with its ledger code and spend, and the picked tile filled in place of a check.
- [Global Search](./cascader/c-cascader-21.md): Global search across the whole tree from a nested level.. Best for a labelled store taxonomy preset to Headphones, with 2 Chargers rows under different branches told apart by their trail.
