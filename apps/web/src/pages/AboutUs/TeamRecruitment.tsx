import { ArrowUpRight, Check } from 'lucide-react'
import { Link } from 'react-router'
import type { AboutPage } from '../../content/about/types'
import type { TeamTheme } from '../../config/team'
import { TeamMeshBackground } from './TeamBackgrounds'
import styles from './TeamRecruitment.module.scss'

export function TeamRecruitment({
  content,
  url,
  theme,
}: {
  content: Extract<AboutPage, { kind: 'team' }>['recruitment']
  url?: string
  theme: TeamTheme
}) {
  const label = (
    <>
      <span>{content.buttonLabel}</span>
      <ArrowUpRight aria-hidden="true" />
    </>
  )
  return (
    <section id="join" tabIndex={-1} aria-labelledby="team-join-title" className={styles.chapter}>
      <div className={styles.copy}>
        <div className={styles.brand}>
          <strong>Exre</strong>
          <span>/ DEV TEAM</span>
        </div>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h2 id="team-join-title">{content.title}</h2>
        <p className={styles.description}>{content.description}</p>
        <ul className={styles.highlights}>
          {content.highlights.map((highlight, index) => (
            <li key={index}>
              <Check aria-hidden="true" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.entryRegion}>
        <div className={styles.background} aria-hidden="true">
          <TeamMeshBackground theme={theme} />
        </div>
        <div className={`${styles.entry} ex-glass`}>
          <p className={styles.eyebrow}>{content.entryEyebrow}</p>
          <h3>{content.entryTitle}</h3>
          <p className={styles.description}>{content.entryDescription}</p>
          {url ? (
            url.startsWith('/') ? (
              <Link className={styles.button} to={url}>
                {label}
              </Link>
            ) : (
              <a
                className={styles.button}
                href={url}
                target={url.startsWith('https://') ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                {label}
              </a>
            )
          ) : (
            <>
              <button className={styles.button} type="button" disabled>
                {label}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
