# Complaints and suggestions implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. No commits or delivery operations are authorized.

**Goal:** Implement the approved two-type community feedback Modal with complaint-only anonymity and independent recovery.

**Execution:** Implementation and independent reviews complete. Root typecheck/build and final 76-test focused regression passed. The complete test command was executed; initial Website migration-count failures were repaired and rerun, and one runtime mutex case passed unchanged on isolated retry. All 12 remaining Outline stages passed with exit code 0. Detailed evidence and acceptance limits: `.notes/support-center/acceptance/2026-10-15-complaints-and-suggestions.md`.

**Architecture:** Extend the existing support domain and state machine. New community form kinds use fixed ClickUp routing, v3 storage and separate frontend pointers; old six v2 kinds retain their behavior.

**Tech Stack:** OpenAPI, generated TypeScript Client, Fastify, PostgreSQL/Drizzle, React Hook Form/Zod, ExUI.

**Spec:** `.notes/support-center/specs/2026-10-15-complaints-and-suggestions-design.md`.

**RFC:** `.notes/support-center/rfcs/complaints-and-suggestions-rfc.md`.

## Global constraints

- Only complaint accepts an anonymous boolean; default false; no outgoing nickname or UUID when true.
- Both community kinds use Feedback 1003, list 1100500000004310, 待处理, tags 投诉/反馈 and unprefixed titles.
- Required title/content, optional files (5 × 20 MiB, 100 MiB total), 16 KiB optional large-file information.
- Preserve old v2 rows, frozen payloads and development browser pointer; no data deletion or implicit migration.
- Preserve unrelated dirty work. No commits, pushes, deployments or test task/attachment writes.

## Task 1: Contract, support domain and incremental storage

**Files:** `api/schemas/support.yaml`, `api/paths/support.yaml`, `api/openapi.yaml`; generated outputs through generator; `apps/server/src/domains/support/`; `apps/server/src/db/schema.ts`, `apps/server/src/db/support-signatures.ts`, `apps/server/drizzle/`; support/contract/database/type tests and helpers.

**Interfaces:** Produce `FeedbackArea = 'development' | 'community'`; `SupportServices.options(area?: FeedbackArea)`; new suggestion/complaint union members exactly as RFC. Other operations retain signatures.

- [x] Add failing API/runtime tests accepting suggestion and complaint, rejecting anonymous on other kinds and rejecting non-booleans on complaint.
- [x] Update Contract first, run `pnpm api:lint` and `pnpm api:generate`, notify frontend implementer that generated types are ready.
- [x] Implement normalization, fixed target selection, area-isolated metadata, Tag availability and anonymous payload/remote checks.
- [x] Add incremental constraint migration with v2 old kinds/v3 community kinds, update signatures and prove old rows survive in isolated PostgreSQL.
- [x] Validate anonymous and named prepare/advance, cross-user rejection, idempotency privacy conflict, missing Tag isolation, community wrong-category Tag rejection, old v2 recovery including unrelated 投诉/反馈 Tags, and real HTTP/raw handler behavior.
- [x] Run scoped backend tests and server typecheck; hand off file list, red/green evidence and any limitations for independent review.

Representative boundary assertion:

```ts
expect(taskInput(anonymousComplaint, markdown, nickname, userId).custom_fields).not.toContainEqual(
  expect.objectContaining({ id: TARGET.user }),
)
```

## Task 2: Community Modal and independent browser flow

**Files:** `apps/web/src/pages/Support/feedback/` and their tests; `apps/web/src/pages/Support/SupportHome.tsx`, `SupportRoutes.test.tsx`. Shared upload component only if an unavoidable public prop adjustment is needed, report before overlap.

**Interfaces:** Consume Task 1 generated forms and options query. `FeedbackModal({trigger, area = 'development'})`; `getFeedbackOptions(area = 'development')`; append area as optional sixth FeedbackFlow constructor parameter, preserving delay as fifth.

- [x] Add failing UI/schema/flow tests for two community cards, complaint-only anonymous default false, separate draft privacy values and distinct recovery pointers.
- [x] Refactor choice/type config by area and wire both homepage entries to FeedbackModal; add Send/Danger icons.
- [x] Extend RHF draft conversion and Zod for new kinds; only complaint serializes anonymous. Add footer Switch and account association explanation, disabled when locked.
- [x] Keep existing close confirmation, background Hover, skeletons, optional upload and large-file behavior; no bottom close button.
- [x] Namespace Flow pointer and reject wrong-area submissions/snapshots before accept/advance; preserve development key and existing delay tests.
- [x] Run scoped frontend tests and web typecheck, report red/green evidence and exact affected paths for review.

Representative pointer assertions:

```ts
expect(development.storageKey).toBe('exwebsite.feedback.v2')
expect(community.storageKey).toBe('exwebsite.feedback.community.v1')
```

## Task 3: Preparation, review and final verification

**Files:** RFC/Spec, `.ai/databases/data-model.md`, `.ai/architectures/support-center/feedback-lifecycle.md`, scoped acceptance evidence under `.notes/support-center/acceptance/`.

- [x] Only after user-authorized preparation, GET current community tags, create missing 投诉/反馈 once, GET and record safe metadata verification.
- [x] Independently review each task for Spec compliance and code quality; repair verified findings and rerun affected checks.
- [x] Sequentially run root typecheck/build when SDK generation shares artifacts; execute complete `pnpm test` after candidate stabilizes.
- [x] Verify real browser community cards/forms, complaint-only anonymity, both themes and narrow viewport without creating remote test tasks.
- [x] Update durable docs to verified behavior, record migration/runtime/external acceptance boundaries and report final result without commit.
