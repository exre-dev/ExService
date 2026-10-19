<!-- Generated from resources/components/avatar.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Avatar

> Open-source shadcn avatar components for user profiles, team directories, and comment threads.

- Type: shadcn/ui component, free
- Page: [local reference](./avatar.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/avatar.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/avatar.md
- Examples: 35

## When to use

- Profile photos with initials or a user icon that stand in when the picture is missing or fails
- Presence dots, verified marks and number badges pinned to the corners of a person's photo
- Overlapping team stacks, social proof rows and user chips inside buttons or account triggers

## When not to use

- An account panel opened from a trigger, with the name, email and grouped actions: use [Dropdown Menu](./dropdown-menu.md)
- A full account settings page where a person edits photo, name and details: use the Profile blocks
- A workspace members directory with roles, invites and access status: use the Users blocks

## Agent notes

- Initials inside `AvatarFallback` are typed by hand in every example; derive them from each person's name rather than copying the sample letters
- A square `Avatar` needs the same radius on `AvatarImage`, `AvatarFallback` and its after pseudo element border, since all 3 default to round

## Examples

- [Basic](./avatar/c-avatar-1.md): Basic avatar. Best for the minimal markup: 1 photo at the default size with 2 letter initials kept as the fallback.
- [Fallbacks](./avatar/c-avatar-2.md): Avatar with fallback. Best for photo free placeholders: 2 letter initials and a user icon, both on the muted fallback fill.
- [Sizes](./avatar/c-avatar-3.md): Avatars with different sizes. Best for the 3 built-in steps of the size prop, sm, default and lg, shown side by side on 1 photo.
- [Border Radius](./avatar/c-avatar-4.md): Avatars with different border radiuses. Best for square and soft cornered photos with md, lg and xl radius set next to the default circle.
- [Custom Sizes](./avatar/c-avatar-5.md): Avatars with custom sizes. Best for free sizing through className at 16, 32, 48 and 64 pixels, beyond the 3 presets of the size prop.
- [Status Dots](./avatar/c-avatar-6.md): Avatar with an online status badge. Best for plain presence dots in the default bottom right spot, colored primary, green, yellow and destructive.
- [Badge Icons](./avatar/c-avatar-7.md): Avatar with badge icon. Best for corner badges holding a plus, check, star or shield icon on primary, success, warning and info fills.
- [Round Badge Corners](./avatar/c-avatar-8.md): Avatar with different badge positions. Best for round photos with the dot moved to each of the 4 corners, sitting on the edge of the circle.
- [Square Badge Corners](./avatar/c-avatar-9.md): Avatar with different badge positions. Best for square photos with the dot pushed 4 pixels past each of the 4 corners.
- [Avatar Group](./avatar/c-avatar-10.md): Basic avatar group. Best for a stack of 3 overlapping photos with a background ring and no count chip at the end.
- [Group With Count](./avatar/c-avatar-11.md): Avatar group with numerical count. Best for a 3 photo stack closed by a muted chip from the group count part that reads +3.
- [Plus Chip Group](./avatar/c-avatar-12.md): Avatar group with an icon count. Best for a 3 photo stack ending in a round plus chip in place of a number.
- [Border Rings](./avatar/c-avatar-13.md): Avatar with a distinct border ring. Best for offset outer rings in 4 colors, primary, destructive, violet and yellow, around each photo.
- [Soft Fallbacks](./avatar/c-avatar-14.md): Avatar with light background color fallback. Best for initials on soft tinted fills with a matching border, including dark mode shades for green and fuchsia.
- [Solid Fallbacks](./avatar/c-avatar-15.md): Avatar with a solid background color fallback. Best for initials in white or primary foreground text on full strength primary, destructive, green and blue fills.
- [User Details](./avatar/c-avatar-16.md): Avatar with user details and badge. Best for a name line with a small Pro badge and a job title stacked beside the photo.
- [Grayscale](./avatar/c-avatar-17.md): Avatar with grayscale image filter. Best for a single photo turned black and white by the grayscale class on the image only.
- [Group Presence](./avatar/c-avatar-18.md): Avatar group with online status on one. Best for a 3 person stack where only the first photo carries a success colored presence dot.
- [Outline Button](./avatar/c-avatar-19.md): Avatar inside small outline button. Best for a 20 pixel photo next to an @ handle inside a small outline button.
- [Social Proof Pill](./avatar/c-avatar-20.md): Avatar social proof with text label. Best for a bordered pill with 4 small stacked photos and a bold 100K+ figure in its caption.
- [Compact Social Proof](./avatar/c-avatar-21.md): Compact social proof with initials. Best for a Frame panel holding 4 developer photos and a Joined by 500+ developers caption.
- [Lift Tooltips](./avatar/c-avatar-22.md): Avatar group with hover tooltips and lift effect. Best for a hand built overlap where the hovered photo rises 4 pixels with a shadow and a name tooltip.
- [Hover Fan](./avatar/c-avatar-23.md): Avatar group with hover effect. Best for a stack that fans apart on hover, each photo sliding by its index and the hovered one growing 10 percent.
- [Fan With Tooltips](./avatar/c-avatar-24.md): Avatar group with hover effect and tooltips. Best for the fan out hover stack with a name tooltip on each photo, the Avatar itself rendered as the trigger.
- [Bordered Count Pill](./avatar/c-avatar-25.md): Avatar group with numerical count. Best for a bordered pill of 4 small photos split by background borders, with a plain +3 text tally.
- [Pill Outline Button](./avatar/c-avatar-26.md): Pilled small outline button with avatar. Best for a pill shaped outline button whose 24 pixel photo hugs its left edge inside a background border.
- [Pill Primary Button](./avatar/c-avatar-27.md): Pilled small button with avatar. Best for a solid primary pill button with a thin primary border around the 24 pixel photo at its left.
- [Empty State](./avatar/c-avatar-28.md): Avatar inside an empty state example. Best for a no collaborators prompt with 3 grayscale photos, an add person chip and invite copy below.
- [Group Add Button](./avatar/c-avatar-29.md): Avatar group with icon count and button. Best for a 3 photo stack with a +5 chip beside a round add user button that shows a tooltip.
- [Loading State](./avatar/c-avatar-30.md): Avatar with loading state demonstration. Best for a spinner over a 60 percent background veil on the photo, switched on and off by a demo timer.
- [Custom Badge](./avatar/c-avatar-31.md): Avatar with custom badge. Best for a blue verified rosette drawn as inline SVG, placed at a different corner on each of 4 large photos.
- [Pulsing Ring](./avatar/c-avatar-32.md): Avatar with ring animation. Best for a photo and green offset ring pulsing together, with a green dot drawn as a plain span past the bottom right.
- [Gradient Ring](./avatar/c-avatar-33.md): Avatar with gradient animated ring. Best for a story style ring: a blurred yellow to violet gradient spinning behind the photo, brighter on hover.
- [Multiple Badges](./avatar/c-avatar-34.md): Avatar with multiple badges. Best for a presence dot at the bottom right and a red count of 3 at the top right of one photo.
- [Dropdown Menu](./avatar/c-avatar-35.md): Compact avatar dropdown menu. Best for a pill trigger with photo, name and up down chevron that opens Profile, Settings, Teams, Invite and Log out.
