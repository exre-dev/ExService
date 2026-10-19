<!-- Generated from resources/components/spinner/c-spinner-3.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn In Badges

> Spinners in badges.

- Type: example, free and open source (MIT)
- Component: [Spinner](../spinner.md)
- Page: [local reference](./c-spinner-3.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/spinner.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/spinner.md
- Uses: Badge, Spinner

## Best for

Status labels in primary, secondary and outline plus light destructive, success and info tints, each led by a spinner

## Agent notes

- `Badge` here is the upstream primitive; the shadcn badge has no `destructive-light`, `success-light` or `info-light` variant

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Spinner

### When to use

- Pending states inside buttons, status badges and search fields while a request runs
- Loading views for a card or an empty panel, including blurred covers over content being refreshed
- Inline notes such as checking, syncing or reconnecting, led by a small tinted spinner or bouncing dots

### When not to use

- Content of a known layout, held as muted placeholder shapes until it arrives: use [Skeleton](../skeleton.md)
- A wait where the share of work done is known, such as an upload percent: use [Progress](../progress.md)
- A save control that tracks its own pending and done states after a click: use [Button](../button.md)

### Agent notes

- No example holds a pending flag and `disabled` is hardcoded where it appears; show the indicator and lock controls from your own request state
