# 001 — Separate the Hero artwork and animate the scroll cue

- **Status**: DONE
- **Commit**: d502ef9
- **Severity**: LOW
- **Category**: Purpose, accessibility, performance, missed opportunities
- **Estimated scope**: Hero component and its CSS Module; related browser checks and durable layout documentation

## Problem

The user requests a shorter background, visible breathing room below it, and an animated arrow without a ring at the bottom of the first viewport. The first viewport must still exclude the stories below.

`apps/web/src/pages/AboutUs/AboutHomeHero.tsx` currently places the scroll link inside the rounded background surface. `apps/web/src/pages/AboutUs/AboutHomeHero.module.scss:37-39` currently provides a ring and only hover movement:

```scss
.scrollCue {
  display: grid;
  place-items: center;
  justify-self: center;
  width: 3rem;
  height: 3rem;
  margin: 0 0 1.5rem;
  border: 1px solid currentColor;
  border-radius: var(--exui-radius-full);
  color: inherit;
  text-decoration: none;
}
.scrollCue svg {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 150ms ease-out;
}
.scrollCue:hover svg {
  transform: translateY(0.1875rem);
}
```

## Target

Treat the Hero as one viewport containing two rows: a rounded image surface and a separate scroll link on the page background. Keep the existing image, shader settings, overlay, text, link name and scroll/focus behavior.

```scss
.hero {
  display: grid;
  grid-template-rows: minmax(min-content, 1fr) auto;
  gap: 1rem;
  min-height: calc(100svh - var(--site-header-height, 4rem));
  box-sizing: border-box;
  padding: 1.5rem 2% 1rem;
}
.surface {
  // Keep its existing positioning, isolation, image/overlay, theme and radius.
  // Remove flex: 1 and grid-template-rows: 1fr auto.
  min-height: 0;
  display: grid;
}
.scrollCue {
  display: grid;
  place-items: center;
  justify-self: center;
  width: 2.75rem;
  height: 2.75rem;
  margin: 0;
  border: 0;
  border-radius: 0;
  color: var(--exui-text-secondary);
  text-decoration: none;
  transition: color 150ms ease;
}
.cueMotion {
  display: block;
  animation: scrollHint 2400ms cubic-bezier(0.77, 0, 0.175, 1) infinite;
  animation-play-state: paused;
}
.scrollCue[data-motion='active'] .cueMotion {
  animation-play-state: running;
}
.scrollCue svg {
  display: block;
  width: 1.5rem;
  height: 1.5rem;
}
@keyframes scrollHint {
  0%,
  100% {
    transform: translateY(-3px);
    opacity: 0.85;
  }
  50% {
    transform: translateY(3px);
    opacity: 1;
  }
}
.scrollCue:focus-visible {
  color: var(--exui-text-primary);
  outline: 2px solid var(--exui-border-focused);
  outline-offset: 4px;
}
.scrollCue:focus-visible .cueMotion {
  animation-play-state: paused;
}
@media (hover: hover) and (pointer: fine) {
  .scrollCue:hover {
    color: var(--exui-text-primary);
  }
  .scrollCue:hover .cueMotion {
    animation-play-state: paused;
  }
}
@media (max-width: 39.99rem) {
  .hero {
    padding: 0.75rem 0.5rem 1rem;
    gap: 0.75rem;
  }
  // Retain current mobile text rules; remove the old cue margin-bottom rule.
}
@media (prefers-reduced-motion: reduce) {
  .cueMotion {
    animation: none;
    transform: none;
    opacity: 1;
  }
}
```

The 2400ms cycle is a deliberate marketing scroll hint, not an entrance or interaction delay. It uses the on-screen movement curve `cubic-bezier(0.77, 0, 0.175, 1)` from the motion audit catalog. The 6px total travel is a restrained design choice; no spring, scale or bounce is required.

Execution refinements: the first grid row uses `min-content` so enlarged text can expand the Hero without clipping. The opacity floor was raised from .65 to .85 after a real light-theme sample measured the arrow color as RGB 115 on white; its faintest composited color is now approximately RGB 136, retaining visibility throughout the cycle.

## Repo conventions to follow

- React and CSS Modules; existing ExUI theme, color, border and radius tokens; Lucide `ArrowDown`.
- Existing unused Icon Hero in `apps/web/src/pages/AboutUs/AboutHero.module.scss:61-68` demonstrates a 2400ms scroll hint and reduced-motion handling. Do not import or modify that old component.
- No shared motion token exists for this local effect. Keep its single curve in this CSS Module rather than introducing a parallel token layer.
- `AboutHomeHero.tsx` already preserves modifier-click behavior, smooth scrolling, reduced-motion immediate scrolling, and focus transfer. Keep that handler.
- `AboutUs.tsx` initializes home reading position independently of its delayed MDX body. Preserve that regression repair.

## Steps

1. In `AboutHomeHero.tsx`, move the existing scroll link after the closing `.surface` div, so it remains inside the Hero header but outside the image. Wrap `ArrowDown` in `<span className={styles.cueMotion}>`. Preserve `href`, `onClick` and `aria-label`.
2. Apply the CSS target above. Remove the old SVG hover transform, ring, cue bottom margins, and `.surface` two-row layout. Keep the content centered within the shorter background. Natural content growth on unusually short viewports or zoom must remain possible; do not clip text to force a height.
3. Add an anchor ref and one effect for animation visibility. Use `IntersectionObserver` with threshold `0.001`; derive visibility from `isIntersecting`, positive `intersectionRect.height`, and ratio at least `0.001`. Exclude the shared sticky header with a negative top root margin equal to its measured height. On visibility changes and `document.visibilitychange`, update a boolean to visible AND not `document.hidden`. Output `data-motion={active ? 'active' : 'paused'}`. Start paused; disconnect the observer and remove the listener at cleanup. If IntersectionObserver is unavailable, leave the arrow static and usable. Do not introduce a JS animation frame loop.
4. Update only the verified Hero layout and scroll-hint statements in `.ai/architectures/web/content-rendering.md` after implementation, retaining unrelated edits.

## Boundaries

- No other About section, data schema, member content, route, join page, dependency, server, database or Outline changes belong to this plan.
- Preserve all existing dirty/untracked work. Do not overwrite the old Icon Hero or change `useReadingPosition.ts`.
- No commit, deployment, package installation or global styling changes.
- Reconcile current source with the quoted baseline before executing. Report overlapping new edits rather than overwriting them.

## Verification

- **Mechanical**: `pnpm exec vitest run apps/web/src/pages/AboutUs --maxWorkers 2`, `pnpm --filter @workspace/web typecheck`, and `pnpm --filter @workspace/web build` must exit 0. Report build warnings separately. Keep the delayed-MDX scroll regression passing. Do not add tests that merely inspect CSS strings.
- **Geometry**: at 1440×900 and 375×812, the image bottom must be above the cue hit area; the cue hit area bottom is 16px above the viewport edge. The stories start at or below the viewport bottom and no horizontal overflow appears. At 320×568, inspect text and arrow visibility; at 200% zoom allow natural growth rather than overlap.
- **Feel check**: inspect normal and 10% animation playback. The arrow slowly moves 6px peak-to-peak without layout movement, a ring, scaling or spring bounce. It stays still while keyboard-focused and supports Enter activation. Inspect both light and dark themes on the page background.
- **Accessibility and lifecycle**: reduced-motion mode has a static arrow plus visible focus/color feedback; scrolling it offscreen or hiding the tab pauses the cycle, returning resumes it. Mobile tapping must not leave false hover styling.
- **Done when**: all three requested changes are visible, existing scrolling/focus/recovery behavior remains correct, and the animation is paused when not useful.
