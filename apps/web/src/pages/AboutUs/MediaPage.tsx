import type { MDXComponents } from 'mdx/types'
import type { MouseEvent } from 'react'
import { ArrowDown } from 'lucide-react'
import type { AboutPage } from '../../content/about/types'
import type { ContentState } from '../../content/useContent'
import { AboutBody, type OpenMember } from './AboutBody'
import { MediaBackground } from './MediaBackground'
import { MediaList } from './MediaList'
import styles from './MediaPage.module.scss'

type MediaPageData = Extract<AboutPage, { kind: 'media' }>
export function MediaPage({
  page,
  state,
  components,
  openMember,
}: {
  page: MediaPageData
  state: ContentState & { retry: () => void }
  components: MDXComponents
  openMember: OpenMember
}) {
  function explore(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    const target = document.getElementById('about-media-music')
    if (!target) return
    event.preventDefault()
    const instant =
      event.detail === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ block: 'start', behavior: instant ? 'instant' : 'smooth' })
    target.focus({ preventScroll: true })
  }
  return (
    <>
      <header className={styles.hero}>
        <MediaBackground key={page.backgroundVideoUrl} src={page.backgroundVideoUrl} />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{page.eyebrow}</p>
          <h1 tabIndex={-1}>{page.title}</h1>
          <p className={styles.lead}>{page.description}</p>
          <div className={styles.intro}>
            <AboutBody state={state} components={components} retry={state.retry} />
          </div>
        </div>
        <a
          className={styles.scrollCue}
          href="#about-media-music"
          onClick={explore}
          aria-label="探索音乐和影像"
        >
          <ArrowDown aria-hidden="true" />
        </a>
      </header>
      <div className={styles.chapters}>
        <section
          id="about-media-music"
          aria-labelledby="about-media-music-title"
          className={styles.music}
          tabIndex={-1}
        >
          <div className={styles.chapterCopy}>
            <p className={styles.eyebrow}>ON REPEAT</p>
            <h2 id="about-media-music-title">{page.playlist.title}</h2>
            <p>{page.playlist.description}</p>
          </div>
          <div className={styles.player}>
            <div className={styles.playerFrame}>
              <iframe
                title={`Apple Music — ${page.playlist.title}`}
                src={page.playlist.embedUrl}
                allow="autoplay *; encrypted-media *;"
                frameBorder="0"
                height="640"
                loading="lazy"
                sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
              />
            </div>
          </div>
        </section>
        <section className={styles.videos} aria-labelledby="about-media-videos-title">
          <div className={styles.chapterCopy}>
            <p className={styles.eyebrow}>SELECTED VIDEOS</p>
            <h2 id="about-media-videos-title">{page.videos.title}</h2>
            <p>{page.videos.description}</p>
          </div>
          <MediaList openMember={openMember} />
        </section>
      </div>
    </>
  )
}
