<!-- Generated from resources/components/trace.md by scripts/exui-skill/sync-references.mjs. -->

> Pattern reference. Read [ExUI contracts](../exui/setup.md) before implementation; Base/Radix alternatives do not define ExUI exports.

# Shadcn Trace

> Open-source shadcn trace components for agent reasoning, tool calls and run steps that expand to their output.

- Type: shadcn/ui component, free
- Page: [local reference](./trace.md)
- Docs (Base UI): https://ui.shadcn.com/docs/components/base/trace.md
- Docs (Radix UI): https://ui.shadcn.com/docs/components/radix/trace.md
- Examples: 22

<!-- exui-capabilities:begin:skill -->

## ExUI capability notes

**ExUI adaptation**

### Trace status and disclosure

ExUI exports `Trace`, `TraceLine`, `TraceIcon`, `TraceTitle`, `TraceDescription`, `TraceCollapsible`, `TraceCollapsibleTrigger`, and `TraceCollapsibleContent` from `@exre/exui`. Compose a `TraceLine` inside each row or trigger; it is a plain span until a surrounding link or button gives it an action. `TraceIcon` is decorative, so put running, failed, or pending status in the `TraceTitle` words as well as the `TraceLine` status color.

Use `defaultOpen` for independent disclosure, or pass `open` with `onOpenChange` for controlled disclosure. Nested rows keep their own state. ExUI's Radix Luma recipe supplies row spacing and focus treatment; running shimmer, content expansion, and the disclosure arrow transition are limited to motion-safe environments.
<!-- exui-capabilities:end:skill -->

## When to use

- Agent turns: reasoning, tool calls, subagents and the sources behind an answer
- Run logs that expand to output, from CI jobs and data builds to webhook deliveries
- Checklists of automated checks or setup steps with running, failed and pending states

## When not to use

- One short status line per step with no expanding detail or status color: use [Marker](./marker.md)
- Dated events or milestones joined by a connecting line: use [Timeline](./timeline.md)
- A complete run console with approvals, log views and an outcome report: use the Agent Activity blocks

## Agent notes

- Status is shown by color and motion only, so every `TraceTitle` must also say in words that a step is running, failed or not started
- A `TraceLine` on its own is a plain span; wrap it in a link or a Dialog, Sheet or Popover trigger to make it act

## Examples

- [Agent Steps](./trace/c-trace-1.md): Agent steps. Best for a plain search line, a diff and test output that expand, a lint failure and a running fix, in one bare column.
- [Streaming Run](./trace/c-trace-2.md): Streaming agent run. Best for a run that streams its reasoning and resolves tool steps on a timer, with a Stop button and live rows that open themselves.
- [Chat Turn](./trace/c-trace-3.md): Chat turn with sources. Best for a chat transcript turn whose 2 SQL queries fold into one summary row above the answer, with cited dashboards below.
- [Subagents](./trace/c-trace-4.md): Parallel subagents. Best for a parent row over 3 subagents whose status is computed from its children, plus a retry for the failed one.
- [Change Approval](./trace/c-trace-5.md): Terraform change approval. Best for a human approval gate where planned resource rows switch from pending to running to applied in place after Apply.
- [Cited Sources](./trace/c-trace-6.md): Answer with citations. Best for inline citation buttons wired to a controlled sources row, focusing the cited link once its panel mounts.
- [Support Copilot](./trace/c-trace-7.md): Support copilot draft. Best for a drafted support reply in its own row after 3 order and policy lookups, with Insert and Regenerate below.
- [Install Summary](./trace/c-trace-8.md): CLI install summary. Best for a finished install summary with registry items, packages, created files as links, one kept file and a CSS diff.
- [CI Pipeline](./trace/c-trace-9.md): CI pipeline run. Best for a workflow run of 4 jobs where the failed test job opens to its log and a re-run replays test, build and deploy.
- [Request Spans](./trace/c-trace-10.md): Distributed trace spans. Best for spans nested under their parent, each opening to its OpenTelemetry attributes, with the slowest span marked by its share.
- [Error Breadcrumbs](./trace/c-trace-11.md): Error breadcrumbs. Best for an exception's timestamped user and network events, a response body in a Dialog and folded React stack lines.
- [Query Plan](./trace/c-trace-12.md): SQL query plan. Best for a recursive tree of plan nodes, each opening to its numbers and children, with the slowest node flagged by its share.
- [Data Pipeline](./trace/c-trace-13.md): Data pipeline run. Best for built models folded into one row, a failing data test open on its duplicate keys, and a skipped downstream model.
- [Webhook Retries](./trace/c-trace-14.md): Webhook delivery attempts. Best for a delivery log of failed and successful attempts, each opening to its response or payload, plus a Resend action.
- [CSV Import](./trace/c-trace-15.md): CSV import. Best for a spreadsheet upload whose last step counts up live while rejected rows sit in a Table with a download link.
- [Security Audit](./trace/c-trace-16.md): Dependency audit. Best for a list of 3 advisories with severity badges, each opening to its dependency chain and the one action that fixes it.
- [Review Findings](./trace/c-trace-17.md): AI review findings. Best for flagged lines that each open in a Sheet with a suggested diff, then read as applied or dismissed in place.
- [Eval Results](./trace/c-trace-18.md): Model eval results. Best for scored cases with a failures only switch, each failure opening to a compact expected, got and judge list.
- [Access Decision](./trace/c-trace-19.md): Access decision. Best for a permission decision as the parent row of its rules, recomputed from 2 Selects, with rules after the decider not reached.
- [Identity Review](./trace/c-trace-20.md): Identity verification. Best for an applicant review with automated document and screening checks, one rejection and a request for a new document.
- [Domain Setup](./trace/c-trace-21.md): Domain DNS setup. Best for a setup checklist with copyable DNS records, a lookup per record, then a pending go live step.
- [Transcode](./trace/c-trace-22.md): Media transcode. Best for a media pipeline with 3 renditions encoding in parallel under one row, followed by thumbnail and publish steps.
