# Quality gate

Complete only after checking the changed files against the contracts actually used. Use the consuming project's validation commands; use its existing tooling for validation.

## Contracts

- Every component and type comes from an installed public ExUI entry; verify unfamiliar exports and aliases in the declaration.
- No upstream registry install is needed for a local `c-*` reference.
- Component sizes, variants and composition syntax match ExUI's installed version.
- Forms use one ExUI-owned instance and stable initialization schemas. Verify invalid, submitting, parsed output, server errors and cancellation where changed.
- For effects, verify the actual component supports `glass`; preserve elevation and focus rings. Read [Glass](../references/exui/glass.md) for what computed styles cannot establish.

## Accessibility and behavior

Use real links for navigation, named icon buttons and decorative icons with `aria-hidden`. Keep labels, descriptions and errors associated with the focusable control. Dialogs have a title, keyboard handling and focus return. Pending destructive confirmations must not accidentally dismiss; implement this through the installed API rather than assuming a `dismissible` prop exists.

Check sensible Tab order, visible focus, Escape behavior, and async status/error announcements. External new-tab links use the project's safe `rel` convention. Render untrusted content as text or use the project's established sanitizer.

## Visual and scroll checks

Check the supported themes, narrow width, long labels and the application's root scale. Every changed data region has loading, empty and error handling where applicable. Scroll regions need a resolving height chain (`min-h-0` for shrinking flex ancestors) and locally owned `overflow-auto`; the page should not scroll sideways for a table.

Review custom motion for `transition-all`, animated blur/shadow/layout, large entrance staggers and missing reduced-motion behavior. Read [motion](motion.md) and [anti-patterns](anti-patterns.md). These checks apply to consuming code; existing library motion remains component-owned.

## Hand-back

State the resulting behavior, checks actually run, visual/browser coverage and remaining gaps. Distinguish strict type checks, build output, computed styles and rendered appearance. In particular, do not claim rendered Glass refraction from syntax acceptance or computed styles.
