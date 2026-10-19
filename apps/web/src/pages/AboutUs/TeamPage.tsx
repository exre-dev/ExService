import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, useMotionValue, type AnimationPlaybackControls } from 'framer-motion'
import type { MDXComponents } from 'mdx/types'
import type { AboutPage } from '../../content/about/types'
import type { ContentState } from '../../content/useContent'
import type { TeamDisplayConfig, TeamMember, TeamTheme } from '../../config/team'
import { AboutBody } from './AboutBody'
import { TeamShowcase } from './TeamShowcase'
import { TeamRecruitment } from './TeamRecruitment'
import { useTeamReducedMotion } from './TeamBackgrounds'
import styles from './TeamShowcase.module.scss'

const ease = [0.23, 1, 0.32, 1] as const
const emptyTheme: TeamTheme = {
  colorBack: '#0868de',
  accent: '#065ed1',
  colorFill: '#ffffff7d',
  colorStroke: '#ffffff',
}
export function TeamPage({
  page,
  state,
  components,
  config,
}: {
  page: Extract<AboutPage, { kind: 'team' }>
  state: ContentState & { retry: () => void }
  components: MDXComponents
  config: TeamDisplayConfig
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(config.teams[0]?.id)
  const selected = config.teams.find((member) => member.id === selectedId) ?? config.teams[0]
  const [displayed, setDisplayed] = useState<TeamMember | undefined>(selected)
  const reduced = useTeamReducedMotion()
  const colorBack = useMotionValue(selected?.theme.colorBack ?? emptyTheme.colorBack)
  const accent = useMotionValue(selected?.theme.accent ?? emptyTheme.accent)
  const colorFill = useMotionValue(selected?.theme.colorFill ?? emptyTheme.colorFill)
  const colorStroke = useMotionValue(selected?.theme.colorStroke ?? emptyTheme.colorStroke)
  const opacity = useMotionValue(1)
  const [theme, setTheme] = useState(selected?.theme ?? emptyTheme)
  const generation = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  const last = useRef(selected)
  const headline = page.showcase?.headline ?? page.title
  useEffect(() => {
    const read = () =>
      setTheme({
        colorBack: colorBack.get(),
        accent: accent.get(),
        colorFill: colorFill.get(),
        colorStroke: colorStroke.get(),
      })
    const unsubscribe = [colorBack, accent, colorFill, colorStroke].map((value) =>
      value.on('change', read),
    )
    return () => unsubscribe.forEach((stop) => stop())
  }, [colorBack, accent, colorFill, colorStroke])
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-site-header]')
    if (!header || !root.current) return
    const update = () =>
      root.current?.style.setProperty(
        '--team-header-offset',
        `${header.getBoundingClientRect().height}px`,
      )
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    const current = ++generation.current
    const controls: AnimationPlaybackControls[] = []
    const stop = () => controls.forEach((control) => control.stop())
    const settle = () => {
      stop()
      setDisplayed(selected)
      opacity.set(1)
      const next = selected?.theme ?? emptyTheme
      colorBack.set(next.colorBack)
      accent.set(next.accent)
      colorFill.set(next.colorFill)
      colorStroke.set(next.colorStroke)
      setTheme(next)
    }
    const sameId = last.current?.id === selected?.id
    last.current = selected
    setSelectedId(selected?.id)
    if (!selected || document.hidden || reduced || sameId) settle()
    else {
      const next = selected.theme
      controls.push(
        animate(colorBack, next.colorBack, { duration: 0.25, ease }),
        animate(accent, next.accent, { duration: 0.25, ease }),
        animate(colorFill, next.colorFill, { duration: 0.25, ease }),
        animate(colorStroke, next.colorStroke, { duration: 0.25, ease }),
      )
      controls.push(
        animate(opacity, 0, {
          duration: 0.08,
          ease,
          onComplete: () => {
            if (generation.current !== current) return
            setDisplayed(selected)
            controls.push(animate(opacity, 1, { duration: 0.16, ease }))
          },
        }),
      )
    }
    const visibility = () => {
      if (document.hidden) {
        ++generation.current
        settle()
      }
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      ++generation.current
      stop()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [selected, reduced, colorBack, accent, colorFill, colorStroke, opacity])
  return (
    <div ref={root} className={styles.page}>
      <section className={styles.chapter} aria-labelledby="team-heading">
        <header className={styles.introduction}>
          <p className={styles.eyebrow}>{page.eyebrow}</p>
          <h1 id="team-heading" tabIndex={-1}>
            {headline.split(/(Exre)/).map((part, index) =>
              part === 'Exre' ? (
                <span key={index} style={{ color: theme.accent }}>
                  {part}
                </span>
              ) : (
                part
              ),
            )}
          </h1>
          <p className={styles.lead}>{page.showcase?.lead ?? page.description}</p>
          <div className={styles.note}>
            <AboutBody state={state} components={components} retry={state.retry} />
          </div>
        </header>
        {selected && displayed ? (
          <TeamShowcase
            members={config.teams}
            selectedId={selected.id}
            member={displayed}
            theme={theme}
            opacity={opacity}
            onSelect={setSelectedId}
          />
        ) : (
          <p className={styles.empty}>成员资料仍在整理中</p>
        )}
      </section>
      <TeamRecruitment content={page.recruitment} url={config.teamRecruitment.url} theme={theme} />
    </div>
  )
}
