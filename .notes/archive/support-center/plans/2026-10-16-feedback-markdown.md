# Feedback Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace feedback body textareas with the existing Tiptap GFM editor and preserve Markdown through submission without reinterpreting legacy records.

**Architecture:** Add an explicit optional Markdown discriminator to existing forms. Keep legacy normalization byte-for-byte stable; both formats retain content rule 1 and select DOM-free validation/composition from the frozen format marker. Bind a page-local editor adapter to RHF, with opt-in Markdown clipboard parsing and silent downgrade notices. No database migration is added because the project is unreleased and the existing JSON form already identifies the content format.

**Tech Stack:** React, RHF, Zod, existing Tiptap presets, OpenAPI, Fastify, PostgreSQL, Vitest.

**Spec:** `.notes/support-center/specs/2026-10-16-feedback-markdown-design.md`

## Global Constraints

- No top toolbar, source mode, inline image upload, downgrade notification, or plain-text paste suggestion.
- Existing title, large-file information, anonymity, attachment limits and workflow remain unchanged.
- Never reinterpret existing plain-text frozen submissions. No real ClickUp writes or deployment. Git delivery requires separate authorization.
- Contract first; generated artifacts are produced by `pnpm api:generate` only.
- Existing Bug field limits are 16 KiB each; combined user Markdown is at most 64 KiB.

### Task 1: Contract, shared content and frozen-record compatibility

**Ownership:** `api/`, `packages/common/`, `apps/server/`, `tests/contract/support.test.ts`, backend support tests, `pnpm-lock.yaml`, `.ai/databases/data-model.md`.

**Interfaces:** Add optional `contentFormat?: 'markdown'` on all feedback forms. Shared `analyzeRequest(text, format?)` and `composeBug(details, format?)` default to old plain-text handling; format is `'markdown' | undefined`. Validation reasons include empty, too_large, invalid. Both formats keep content_rule_version 1; format selection uses the frozen discriminator. Preserve form_version 2/3 and frozen target/anonymous rules.

- [x] Add failing shared tests proving `**bold**` stays formatted only for Markdown, GFM-only empty bodies fail, code containing HTML remains literal, actual HTML/unsafe URLs fail, and legacy escaping stays stable. Example: `expect(analyzeRequest('**bold**', 'markdown').markdown).toBe('**bold**')`.
- [x] Add the discriminator to the Contract, run lint/generate, then implement DOM-free GFM validation and composition using existing unified/remark dependencies and remark-gfm. Preserve user Markdown text instead of lossy reserialization. Validate URL schemes, HTML, node/depth and byte budgets.
- [x] Update prepare/stored normalization and content construction. Keep the existing INSERT content rule version, record invariant, DB constraint and readiness signature at 1; withdraw the initially proposed, unapplied version migration and update the data model accordingly.
- [x] Add backend HTTP + raw-handler tests for Markdown preservation and frozen replay; ensure old submissions still read/advance and Markdown vs plain changes conflict under the same key. Exercise real temporary PostgreSQL.
- [x] Run focused shared/backend/contract tests and report exact evidence and any blocked checks. Do not run package-manager mutations concurrently with the parent.

### Task 2: Markdown clipboard and feedback editor integration

**Ownership:** `packages/components/src/tiptap/`, `apps/web/src/pages/Support/feedback/`, `apps/web/package.json`; dependency installation coordinated with Task 1.

**Interfaces:** Add initialization-only `pasteMarkdown?: boolean` to the GFM preset and extension options, default false. Opt-in parsing affects plain text only, preserves code-block literal paste and uses the existing atomic guarded insertion. The page-local editor accepts controlled Markdown, field accessibility props, read-only state and RHF callbacks, reporting genuine conversion failures through RHF/Zod; normalization/downgrade notices are not shown. Legacy frozen fields use literal read-only text without editing-parser node limits.

- [x] Add failing real-editor tests for opted-in Markdown paste, default literal paste, code-block paste and history; use the existing gate to reject unsafe/oversized candidates without partial insertion.
- [x] Implement opt-in clipboard behavior and forward the fixed option through the preset/runtime.
- [x] Add a local feedback editor adapter within the existing lazy-loaded FeedbackModal using `useMarkdownPreset`, `useTiptapEditor`, native `EditorContent` and the existing shared content class. No new global styles or editor implementations.
- [x] Replace the five body textarea paths with RHF Controllers; preserve field labels/descriptions, draft switching, reset, recovery and lock. New forms send contentFormat markdown; legacy frozen forms display their literal content. Store conversion errors in RHF and validate them through Zod so invalid live content cannot submit an older exported value.
- [x] Update UI/schema tests to interact with real contenteditable nodes; cover formatted submission, kind draft switching, legacy read-only recovery, silent downgrade, and validation errors.
- [x] Run focused Tiptap and feedback tests.

### Task 3: Integrated verification, independent review and durable documentation

- [x] Run `pnpm api:lint`, `pnpm api:generate`, `pnpm typecheck`, `pnpm test`, `pnpm build` sequentially where build outputs are shared. Report unrelated/environment failures accurately.
- [x] Verify actual feedback UI in a browser for light/dark, narrow layout, Markdown paste, no toolbar, silent downgrade and frozen state. Use local mocked API responses only where live submission would write ClickUp.
- [x] Obtain independent code review of the complete diff, repair confirmed findings and rerun affected checks.
- [x] Use codebase-documenter to update evidence-backed feedback lifecycle knowledge and revise superseded plain-text-only spec/RFC statements. Do not distill unimplemented design speculation.
