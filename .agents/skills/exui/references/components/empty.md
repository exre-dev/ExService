<!-- Generated from resources/components/empty.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Empty

> Open-source shadcn empty state components for zero-data screens, first-run onboarding, and guided next steps.

- Type: shadcn/ui component, free
- Page: [local reference](./empty.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/empty.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/empty.md
- Examples: 20

## When to use

- First run screens and card sections that add the first record, invite a team or connect a data source
- Search with no matches, a not found page with a search field, or a prompt shown before the first search
- Caught up notices with nothing left to act on, such as inbox zero or no new notifications

## When not to use

- A complete first run page with finished copy, artwork and actions, ready to drop in: use the Empty State blocks
- A screen shown while a fetch is still running and no result is known yet: use [Spinner](./spinner.md)
- A square container for one glyph in a list row, feature card or settings item: use [Icon Tile](./icon-tile.md)

## Agent notes

- Adding `border` to `Empty` draws a dashed outline, since every style sets a dashed border style on it; add border-solid for a solid line
- `EmptyMedia` with `variant` icon puts the glyph in a small muted tile; the default variant has no fill, so drawings go there
- `Empty` takes `flex-1` and centers its children, so in a flex column with a set height it fills the free space

## Examples

- [Basic](./empty/c-empty-1.md): Basic empty state. Best for a text only first project prompt with Create and Import buttons side by side and a muted Learn more link below.
- [No Results](./empty/c-empty-2.md): Search empty state. Best for a no results message on a muted fill with no icon, a Try again button and a Learn more link with an arrow.
- [Search Input](./empty/c-empty-3.md): Empty state with search input. Best for a 404 page in a dashed outline holding a search field with a slash shortcut hint and a Contact support link.
- [Add Button](./empty/c-empty-4.md): Empty state with add button. Best for a folder tile over copy that links to the first post, in a dashed outline with an outline New Post button.
- [Documents](./empty/c-empty-5.md): Document empty state. Best for a Recent Documents Card whose body holds a file tile and a small solid Create Document button.
- [Dashed Upload](./empty/c-empty-6.md): Dashed upload empty state. Best for a dashed drop area of capped width with a cloud tile, a Browse Files button and an accepted types and size hint.
- [Inbox](./empty/c-empty-7.md): Inbox empty state. Best for an inbox zero notice with an inbox tile and no button, for a message list that has been cleared.
- [Team Members](./empty/c-empty-8.md): Team members empty state. Best for a Team Members Card that asks for the first collaborators through a small Invite People button with a user plus glyph.
- [No Notifications](./empty/c-empty-9.md): No notifications empty state. Best for a muted filled panel with a crossed out bell and no action, waiting for the first alert to arrive.
- [Analytics](./empty/c-empty-10.md): No data analytics empty state. Best for an analytics placeholder in a dashed outline with a bar chart tile and Connect Data Source and View Docs buttons.
- [Bookmarks](./empty/c-empty-11.md): Bookmarks empty state. Best for a saved items list before the first bookmark, with a bookmark tile and one outline Browse Items button.
- [Tasks](./empty/c-empty-12.md): Tasks empty state. Best for a Tasks Card showing an all clear check tile and an outline New Task button once every to-do is done.
- [Automations](./empty/c-empty-13.md): No automations empty state with toggle illustration. Best for a switch drawn in SVG between branching connector lines, above one Create new automation button.
- [Comments Board](./empty/c-empty-14.md): Comments empty state with isometric board illustration. Best for an isometric board drawing over a prompt to leave the first comment, with no button to press.
- [Stacked Products](./empty/c-empty-15.md): No products empty state with stacked cards and blur effect. Best for a catalog with no products, drawn as 3 stacked div cards fading into the page, with no button.
- [Search File Cards](./empty/c-empty-16.md): Search empty state with stacked file cards illustration. Best for a prompt before the first search over 3 fading placeholder cards, naming files, folders, tags and transcripts.
- [Chat Bubbles](./empty/c-empty-17.md): No messages empty state with chat bubbles illustration. Best for a 2 bubble chat drawing in muted and primary tints above a Send a message button for a first conversation.
- [Credit Card](./empty/c-empty-18.md): No payments empty state with credit card illustration. Best for a credit card drawing with a chip and contactless waves over a tilted shadow card, above Add payment method.
- [Connected Nodes](./empty/c-empty-19.md): No integrations empty state with connected nodes illustration. Best for a hub node joined to 4 satellites by dashed lines, above Browse integrations and an outline Learn more.
- [Events Calendar](./empty/c-empty-20.md): No events empty state with calendar illustration. Best for a calendar page drawing with one highlighted day among 12 dots, above a single Create event button.
