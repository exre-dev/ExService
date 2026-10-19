<!-- Generated from resources/components/trace/c-trace-21.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Domain Setup

> Domain DNS setup

- Type: example, free and open source (MIT)
- Component: [Trace](../trace.md)
- Page: [local reference](./c-trace-21.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/trace.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/trace.md
- Uses: Button, Card, Table, Trace

## Best for

A setup checklist with copyable DNS records, a lookup per record, then a pending go live step

## Agent notes

- `copy` writes to `navigator.clipboard`, which only works in a secure context

## ExUI adaptation

Compose this pattern from public ExUI components; see [setup](../../exui/setup.md). This example is not an exported component or a complete TSX source file.

## About Shadcn Trace

### When to use

- Agent turns: reasoning, tool calls, subagents and the sources behind an answer
- Run logs that expand to output, from CI jobs and data builds to webhook deliveries
- Checklists of automated checks or setup steps with running, failed and pending states

### When not to use

- One short status line per step with no expanding detail or status color: use [Marker](../marker.md)
- Dated events or milestones joined by a connecting line: use [Timeline](../timeline.md)
- A complete run console with approvals, log views and an outcome report: use the Agent Activity blocks

### Agent notes

- Status is shown by color and motion only, so every `TraceTitle` must also say in words that a step is running, failed or not started
- A `TraceLine` on its own is a plain span; wrap it in a link or a Dialog, Sheet or Popover trigger to make it act
