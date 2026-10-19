# Motion

## Existing components own their motion

Preserve the installed component's transitions and overlay mechanics. Do not retime package internals to match an upstream style table. ExUI's Dialog already disables its overlay/content animation under reduced motion; preserve that adapter behavior.

## Custom consuming code

| Use                    | Starting point                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Hover colors           | `transition-colors`                                                                          |
| Reveal after an action | 200ms, `cubic-bezier(0.22,1,0.36,1)`                                                         |
| Large surface feedback | At most 300ms, same curve                                                                    |
| Custom press feedback  | Transform, with a reduced-motion path                                                        |
| Drag/reorder           | Existing Sortable/Kanban behavior; a custom spring can use `visualDuration: 0.25, bounce: 0` |

CSS is sufficient for hover, press and simple reveals. Add a direct `motion` dependency only when the application actually needs `motion/react` for exit, drag, input-following springs or scroll-linked values; ExUI's bundled implementation dependency is not a public import for the application.

Keep operational screens stable. At most one entrance per view is a useful default; if it is a stagger, limit it to the first six items with at most 50ms between them. Do not stagger table or virtualized rows.

## Effects and performance

Animate transform and opacity. Keep blur, backdrop-filter, border radius and shadow static; a hover lift can transform a surface over a static shadow or fade a separate shadow layer. Avoid `transition-all` in custom code, permanent `will-change`, per-frame React state and offscreen script loops.

Use motion values, transforms or directly updated styles for continuous input. Pause decorative loops offscreen and when the document is hidden. Avoid adding movement to surfaces that already pay for [Glass](../references/exui/glass.md).

## Reduced motion

Custom movement becomes a short fade or instant state change. Resting content stays visible. Add `motion-reduce:` paths for CSS; if the app uses Motion, `MotionConfig reducedMotion="user"` does not cover CSS animations. Smooth scrolling is conditional on the user's motion preference. Auto-moving content that lasts more than five seconds needs a Pause control and should not autoplay under reduced motion.

Check focus visibility and loading feedback after suppressing motion. Do not copy upstream claims that every overlay keeps movement under reduced motion into ExUI's Dialog contract.
