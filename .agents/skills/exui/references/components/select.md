<!-- Generated from resources/components/select.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Select

> Open-source shadcn select components for form selection, settings menus, and filter controls.

- Type: shadcn/ui component, free
- Page: [local reference](./select.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/select.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/select.md
- Examples: 33

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI additions and adaptations**

### ExUI Select APIs

ExUI adds the simplified `Select` wrapper: it requires `options` and reports the selected string through `onChange`. Its `className`, `size` and `glass` style the trigger only. The adapted `SelectField` exposes the Radix root for custom groups, items or a Glass popup; this root uses `onValueChange`. The popup opts into Glass separately on `SelectContent`.

```tsx verify
import {
  Select,
  SelectContent,
  SelectField,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@exre/exui'

export function SelectChoices() {
  return (
    <div>
      <Select
        options={[
          { value: 'design', label: 'Design' },
          { value: 'build', label: 'Build' },
        ]}
        onChange={(value) => console.log(value)}
        placeholder="Team"
        glass
      />
      <SelectField defaultValue="design" onValueChange={(value) => console.log(value)}>
        <SelectTrigger glass>
          <SelectValue placeholder="Team" />
        </SelectTrigger>
        <SelectContent glass>
          <SelectGroup>
            <SelectItem value="design">Design</SelectItem>
          </SelectGroup>
        </SelectContent>
      </SelectField>
    </div>
  )
}
```

**ExUI addition**

### Shared Glass material

`glass` and the exact `ex-glass` class opt a surface into ExUI's material; each surface opts in independently, including a Select popup. Import `@exre/exui/style.css`.

Glass surfaces in this family: `Select`, `SelectTrigger`, `SelectContent`.

Keep this surface in its usual family composition; the wrapper opts that surface into Glass.

```tsx
import type { ComponentProps } from 'react'
import { Select } from '@exre/exui'

export function GlassExample(props: ComponentProps<typeof Select>) {
  return <Select {...props} glass />
}
```

Read [Shared Glass material](../exui/glass.md) for the ExUI contract and complete examples.

**ExUI addition**

### Density and root-font sizing

The compact density scope changes the default geometry of `Button`, `Input`, `Textarea`, `Select`, `NativeSelect` and `InputGroup`. Explicit sizes and complex widget layouts do not all follow that compact scope.

Read [Density and root-font sizing](../exui/scaling.md) for the ExUI contract and complete examples.
<!-- exui-capabilities:end:skill -->

## When to use

- Form fields that pick one value from a short fixed list, such as a fruit, timezone, country or size
- Pickers whose options carry a status dot, badge, avatar, flag, icon or one line description
- Toolbar filters and property pickers, such as status, priority, access level or assignee

## When not to use

- A long list the user wants to search by typing part of a name: use [Combobox](./combobox.md)
- A plain form field that should open the phone or browser's own picker: use [Native Select](./native-select.md)
- Options nested in levels, such as a category and then its subcategories: use [Cascader](./cascader.md)

## Agent notes

- Pass `alignItemWithTrigger` false on the base twin or `position` popper on radix to open the list below the trigger, not over it
- With no children, base `SelectValue` prints a string value raw unless `Select` gets `items`; radix `SelectValue` mirrors the chosen `SelectItem`
- Base `SelectItem` can take a whole object as `value`, matched to `defaultValue` by reference; radix values must be non-empty strings

## Examples

- [Basic](./select/c-select-1.md): A basic select component with a list of options. Best for the minimal pattern: 5 fruits in a dropdown below the trigger, led by a prompt row that clears the pick.
- [Icons](./select/c-select-2.md): Select with icons and placeholder state. Best for app sections such as Dashboard and Security led by muted icons, with a scan icon beside the prompt before any pick.
- [Grouped Labels](./select/c-select-3.md): Select component with grouped options and labels. Best for fruits and vegetables in 2 labeled groups of 3 split by a rule, the prompt kept out of the open list.
- [Large List](./select/c-select-4.md): Select component with a large list of options. Best for a 100 row generated list that opens over the trigger and scrolls within the space left in the viewport.
- [Small Trigger](./select/c-select-5.md): Select component with small trigger size. Best for the sm trigger size on a 3 fruit list, a shorter control for dense forms and toolbars.
- [Plan Picker](./select/c-select-6.md): Select component with a subscription plan style. Best for a plan picker whose trigger grows to show the chosen plan's name and one line description, built from Item parts.
- [Disabled Item](./select/c-select-7.md): Select component with item alignment disabled. Best for a fruit list where Grapes is shown faded and cannot be picked while the other rows stay open to choice.
- [Field With Label](./select/c-select-8.md): Select component within a Field with label and description. Best for a Favorite Fruit label tied to the trigger by id, with a one sentence hint under the control.
- [Invalid](./select/c-select-9.md): Select component in an invalid state. Best for an error state set on both the Field and the trigger, with a message printed below the control.
- [Disabled](./select/c-select-10.md): Select component in a disabled state. Best for the entire control switched off and faded, so its list of fruits cannot be opened at all.
- [In Dialog](./select/c-select-11.md): Select component inside a Dialog. Best for a full width fruit picker inside a modal with a title and description, opened from a button.
- [Multiple Selection](./select/c-select-12.md): Select component with multiple selection. Best for several fruits checked in one open list, the trigger reading the single name or a count such as 3 fruits selected.
- [Inline With Input](./select/c-select-13.md): Select component inline with Input. Best for a narrow status filter of All, Active and Inactive beside a search box in one toolbar row.
- [With Button](./select/c-select-14.md): Select component with Button side by side. Best for a picker that stretches across a row ending in a Submit button, as a quick one field form.
- [Item Aligned](./select/c-select-15.md): Select component with item alignment enabled. Best for a list laid over the trigger so the current fruit sits exactly where the trigger text was.
- [Access Levels](./select/c-select-16.md): Select with custom access level descriptions. Best for permission levels from Full access to No access, each with a short line on what it allows, the trigger keeping the name only.
- [Status Bullets](./select/c-select-17.md): Select with colored bullets for status. Best for statuses such as In Progress and Rejected marked by small colored dots in the rows and the trigger.
- [User Avatars](./select/c-select-18.md): Select with user avatars. Best for a people picker of 10 users with photo avatars under a heading, the trigger repeating a smaller avatar.
- [Status Badges](./select/c-select-19.md): Select with status badges. Best for a Status: prefix in the trigger ahead of an outlined colored badge, with each row drawn as its own badge.
- [Left Indicator](./select/c-select-20.md): Select with indicator on the left side. Best for the check mark moved to the left edge of each row, with the row padding flipped to make room.
- [Clear Button](./select/c-select-21.md): Select with clear button. Best for an X in the trigger that empties a controlled framework pick, taking the chevron's place once a value is set.
- [Custom Chevrons](./select/c-select-22.md): Select with custom chevrons up down icon. Best for an up and down chevron pair in place of the stock arrow, swapped for a clearing X when a fruit is chosen.
- [Overlapping Dots](./select/c-select-23.md): Multi-select with overlapping dots. Best for statuses such as Ready, Building and Error, several picked at once and summed up as overlapping dots and a count badge.
- [Grouped Separators](./select/c-select-24.md): Select with grouped options and separators. Best for frontend and backend tech under 2 headings with a divider, from React and Vue to Node.js and Go.
- [Country Flags](./select/c-select-25.md): Country picker select with flag emojis. Best for countries led by their flag emoji in the rows and the trigger, with United States chosen on load.
- [Status Filter](./select/c-select-26.md): Status filter select with colored dots. Best for a filter that starts on an All Status row with no dot, above 4 states that each carry one.
- [Option Descriptions](./select/c-select-27.md): Select with description text per option. Best for startup, Business and Enterprise tiers with a muted subtitle under each, the trigger keeping the tier name alone.
- [Timezone Offsets](./select/c-select-28.md): Timezone select with UTC offsets. Best for timezone codes grouped by Americas, Europe and Asia, each row trailed by its UTC offset in muted text.
- [Team Assignment](./select/c-select-29.md): Select with avatar items for team member assignment. Best for an Assign to list of 4 teammates with photos, the first of them chosen on load.
- [Priority Badges](./select/c-select-30.md): Priority select with colored badges. Best for priority levels from No Priority to Urgent as small outline, solid and light badges in the rows and the trigger.
- [Font Preview](./select/c-select-31.md): Font family select with preview. Best for each font option set in its own typeface, Inter, Mono and Serif, in the rows and the trigger.
- [Category Icons](./select/c-select-32.md): Select with icon-labeled categories. Best for file types such as Documents, Images and Archives led by an icon, which stays beside the name in the trigger.
- [Size Scale](./select/c-select-33.md): Size variant select with small trigger. Best for a 4 step size scale from Small to Extra Large behind the compact sm trigger.
