# About animation plans

| Plan                                                                     | Severity | Status | Dependencies                            |
| ------------------------------------------------------------------------ | -------- | ------ | --------------------------------------- |
| `001-hero-scroll-cue.md` — Separate Hero artwork and animated scroll cue | LOW      | DONE   | Existing background Hero implementation |

Plan 001 was executed in the existing isolated `feat/about-us` worktree. The mistakenly requested member/solution redesign was cancelled and is outside this work.

## Motion review

| Before                                     | After                                                               | Why                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Opacity floor .65 on RGB 115 against white | Floor .85 in `apps/web/src/pages/AboutUs/AboutHomeHero.module.scss` | Keep the functional arrow legible throughout its cycle; approximate minimum contrast increases from 2.5 to 3.5 |

**Approve.** This occasional marketing cue explains the downward reading direction. Its 2400ms CSS cycle changes only wrapper transform and opacity, uses `cubic-bezier(0.77, 0, 0.175, 1)`, and pauses offscreen, in background tabs, on hover and on keyboard focus. Reduced motion removes positional movement while preserving color/focus feedback. No remaining blocking motion findings were found in this scope.

## Verification

- About tests: 6 files, 34 tests passed; Web typecheck and build passed. Build reports the existing large shared chunk warning.
- Real browser: 1440×900, 375×812 and 320×568 retain the entire first-screen Hero, separate artwork and arrow, a 44px hit area and 16px bottom gap, without horizontal overflow or clipped text.
- Sampled cycle at 0/1200/2400ms: translateY -3/+3/-3px and opacity .85/1/.85. Hover, keyboard focus and offscreen pause were observed; reduced-motion mode has no arrow animation and activates the scroll immediately.
- At 200% root font size, text expands the Hero naturally without clipping. This checks enlarged typography, not a native browser zoom setting.
