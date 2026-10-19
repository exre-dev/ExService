import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from 'react'
import { ArrowDown } from 'lucide-react'
import type { AboutPage } from '../../content/about/types'
import { getJoinHeroImages } from '../../join/hero-images'
import styles from './AboutHomeHero.module.scss'

const HalftoneDots = lazy(() =>
  import('@paper-design/shaders-react').then((module) => ({ default: module.HalftoneDots })),
)
const heroImage = getJoinHeroImages('rifling-911')[0]
const lineBreaks = (text: string) => text.replaceAll('\\n', '\n')

export function AboutHomeHero({ hero }: { hero: Extract<AboutPage, { kind: 'home' }>['hero'] }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)
  const cueRef = useRef<HTMLAnchorElement>(null)
  const [cueActive, setCueActive] = useState(false)

  useEffect(() => {
    const cue = cueRef.current
    if (!cue || typeof IntersectionObserver === 'undefined') return
    let visible = false
    const update = () => setCueActive(visible && !document.hidden)
    const headerHeight = Math.ceil(
      document.querySelector('[data-site-header]')?.getBoundingClientRect().height ?? 0,
    )
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(
          entry?.isIntersecting &&
          entry.intersectionRect.height > 0 &&
          entry.intersectionRatio >= 0.001,
        )
        update()
      },
      { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0.001 },
    )
    observer.observe(cue)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  function enhance(loaded: HTMLImageElement) {
    if (typeof WebGL2RenderingContext === 'undefined') return
    // Probe once before mounting Paper's asynchronous WebGL initializer.
    // Its initializer throws when a browser disables WebGL; the photo remains usable.
    const probe = document.createElement('canvas')
    try {
      const context = probe.getContext('webgl2')
      if (!context) return
      context.getExtension('WEBGL_lose_context')?.loseContext()
      setImage(loaded)
    } catch {
      /* Keep the original photo. */
    }
  }

  function explore(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    const content = document.getElementById('about-content')
    if (!content) return
    event.preventDefault()
    content.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
    content.focus({ preventScroll: true })
  }

  return (
    <header className={styles.hero}>
      <div className={styles.surface}>
        <div className={styles.artwork} aria-hidden="true">
          {heroImage && !failed && (
            <img
              src={heroImage}
              alt=""
              fetchPriority="high"
              onLoad={(event) => enhance(event.currentTarget)}
              onError={() => {
                setFailed(true)
                setImage(null)
              }}
            />
          )}
          {image && (
            <Suspense fallback={null}>
              <HalftoneDots
                className={styles.halftone}
                image={image}
                colorBack="#f2f1e8"
                colorFront="#2b2b2b"
                originalColors
                type="gooey"
                grid="hex"
                inverted={false}
                size={0.5}
                radius={1.25}
                contrast={0.4}
                grainMixer={0.2}
                grainOverlay={0.2}
                grainSize={0.5}
                fit="cover"
                speed={0}
                maxPixelCount={2_000_000}
              />
            </Suspense>
          )}
        </div>
        <div className={styles.content}>
          {hero.eyebrow && <p className={styles.eyebrow}>{hero.eyebrow}</p>}
          <h1 tabIndex={-1}>{lineBreaks(hero.headline)}</h1>
          {hero.lead && <p className={styles.lead}>{lineBreaks(hero.lead)}</p>}
          <p className={styles.summary}>{hero.summary}</p>
        </div>
      </div>
      <a
        ref={cueRef}
        href="#about-content"
        className={styles.scrollCue}
        onClick={explore}
        aria-label="向下滚动，了解 Exre"
        data-motion={cueActive ? 'active' : 'paused'}
      >
        <span className={styles.cueMotion}>
          <ArrowDown aria-hidden="true" />
        </span>
      </a>
    </header>
  )
}
