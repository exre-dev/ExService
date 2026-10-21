# AsyncBoundary Implementation Plan

> **For agentic workers:** Execute this approved scope task by task. Use `superpowers:executing-plans` for sequential implementation and `superpowers:requesting-code-review` for independent review.

**Goal:** Replace large-page and large-content loading/error duplication with `AsyncBoundary`, following the approved `demo.html` interactions.

**Architecture:** The shared component combines an abortable Promise loader or externally owned state with Suspense and a descendant render error boundary. Private feedback renders delayed pending UI and inline error disclosure. Web owns page geometry, home URLs and module-reload recovery. Existing modal workflow remains outside the migration.

**Tech Stack:** React 19, TypeScript, installed ExUI public components, CSS Modules, Vitest, browser verification.

**Spec:** `.notes/loading-boundary/demo.html` and the approved conversation. The latest approval replaces the earlier Dialog proposal with inline Alert details.

## Global Constraints

- Public name: `AsyncBoundary`; `loader`, ordinary JSX or resolved-data render children, `resetKey`, `layout="page" | "section"`.
- Support externally owned loading/error state for existing `useContent` and session checks; do not start duplicate requests.
- Capture loader failures and descendant React render failures. Do not promise interception of arbitrary child event handlers or detached async tasks.
- Preserve 150ms pending feedback inside the new component. Remove the old Loading/PageLoading components, exports, tests, browser helper and documentation completely; no compatibility alias. Abort and ignore obsolete loader runs, including StrictMode effect replay.
- Error details are a text Link inside the description, expand below the content, and support collapse.
- Alert maximum border-box height is 240px; only its body scrolls. Header and full-report copy action remain visible.
- Error details are text, preserve actual errors, and do not serialize arbitrary application objects.
- Retry is the primary button. Optional home navigation is an outline button immediately after it.
- Web module-import retry reloads the current document to recover from native import caching. Ordinary loaders run again locally.
- No endpoint, dependency, lockfile, database, modal workflow, commit, push or deployment changes.

## Task 1: Shared boundary and feedback

**Files:** Create `packages/components/src/AsyncBoundary.tsx`, `AsyncBoundaryFeedback.tsx`, `AsyncBoundary.module.scss`, `AsyncBoundary.test.tsx`; update `packages/components/src/index.ts`.

**Interfaces:** Export generic `AsyncBoundaryProps<T>`. Loader receives `AbortSignal`; externally controlled mode receives `loading`, `error`, `onRetry`. Page fallback height uses an application-supplied CSS custom property. Successful children do not acquire an extra page landmark.

- [x] Add behavior tests before implementation: loader success/failure/retry, render failure/recovery, render-function failure, obsolete results, StrictMode cancellation, resetKey, controlled state, inline disclosure and full-copy behavior.
- [x] Run `pnpm exec vitest run packages/components/src/AsyncBoundary.test.tsx`; confirm missing feature assertion fails.
- [x] Implement the smallest shared controller, render boundary, feedback and styles that satisfy the tests.
- [x] Re-run the focused tests, then run component typecheck after the SDK prerequisites are available.

## Task 2: Web integration

**Files:** Update `apps/web/src/App.tsx`, `content/useContent.ts`, `pages/AboutUs/AboutBody.tsx`, `pages/AboutUs/AboutUs.tsx`, `pages/AboutUs/MemberModal.tsx`, `pages/Support/SupportErrors.tsx` and session waiting consumers; add `routes/PageAsyncBoundary.tsx`; remove superseded page waiting and content error wrappers.

**Interfaces:** App imports About and Support through stable module loader functions inside the new page boundary. `useContent` retains the rejected error. AboutBody preserves its embedded presentation for MemberModal; only page content adopts the new feedback. Parent page adapters provide document reload for MDX/module recovery.

- [x] Add/update regressions for retained errors, page/body recovery, route loading/auth ordering and excluded member modal presentation.
- [x] Run focused regressions and confirm expected failures before each integration change.
- [x] Connect route modules, page waiting and body content, and remove the superseded content wrapper.
- [x] Run Web/components Vitest coverage and all root typecheck stages; run `pnpm build` sequentially after dependency-producing checks.

## Task 3: Browser proof, documentation and independent review

- [x] Verify actual React loader and render failures, retry, disclosure collapse, 240px overflow, keyboard scrolling, copy feedback and full copied content in a real browser. Check light/dark and a narrow viewport.
- [x] Verify the Website About route and protected Support ordering separately from the isolated component fixture.
- [x] Use `codebase-documenter` to create `.ai/knowledge/components/async-boundary.md`, remove the old waiting-component note and update affected content architecture facts from verified implementation.
- [x] Request an independent read-only code review; repair confirmed correctness findings and rerun affected checks.
- [x] Run whitespace/format checks for touched paths and report actual test/browser evidence and any runtime limitations. Leave commits and delivery to a separate user request.
