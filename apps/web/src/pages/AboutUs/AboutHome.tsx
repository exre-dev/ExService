import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import type { MDXComponents } from 'mdx/types'
import { aboutImage, aboutRegistry } from '../../content/about/registry'
import type { AboutPage, AboutSection, ContentImageData } from '../../content/about/types'
import type { ContentState } from '../../content/useContent'
import { AboutBody } from './AboutBody'
import { AboutHomeHero } from './AboutHomeHero'
import styles from './AboutHome.module.scss'

type HomePage = Extract<AboutPage, { kind: 'home' }>
type EntryKey = Exclude<AboutSection, 'home'>
const entries = {
  communities: '走进我们的社区',
  team: '认识团队与贡献者',
  media: '探索音乐和影像',
  story: '回看 Exre 历程',
  donations: '查看捐赠信息',
}
const imageLabels = {
  team: '团队影像',
  media: '音乐和影像',
  story: '历程影像',
  donations: '捐赠图片',
}
const lineBreaks = (text: string) => text.replaceAll('\\n', '\n')

export function AboutHome({
  page,
  state,
  components,
  retry,
}: {
  page: HomePage
  state: ContentState
  components: MDXComponents
  retry: () => void
}) {
  const homeComponents = useMemo(() => ({ ...components, Callout: HomeCallout }), [components])
  return (
    <>
      <AboutHomeHero hero={page.hero} />
      <section
        id="about-content"
        className={styles.stories}
        tabIndex={-1}
        aria-label="进一步认识 Exre"
      >
        <EntryCard page={page} section="communities" />
        <article className={styles.belief} aria-label="我们的理念">
          <p className={styles.category}>我们的理念</p>
          <h2>{lineBreaks(page.introHeading)}</h2>
          <AboutBody state={state} components={homeComponents} retry={retry} />
        </article>
        <EntryCard page={page} section="team" />
        <EntryCard page={page} section="media" />
        <EntryCard page={page} section="story" />
        <EntryCard page={page} section="donations" />
      </section>
    </>
  )
}

function EntryCard({ page, section }: { page: HomePage; section: EntryKey }) {
  // Fixed public section pages are required by the About definition at build time.
  const target = aboutRegistry.pages.find(
    (item) =>
      (item.kind === 'section' ||
        item.kind === 'donations' ||
        item.kind === 'team' ||
        item.kind === 'media') &&
      item.section === section,
  )!
  const rawImage = section === 'communities' ? undefined : page.cardImages?.[section]
  const image = rawImage ? aboutImage(rawImage) : undefined
  const visual =
    section === 'communities' ? null : (
      <HomeImage key={image?.src ?? 'placeholder'} image={image} label={imageLabels[section]} />
    )
  const caption = (
    <div className={styles.caption}>
      <p className={styles.category}>{target.title}</p>
      <Link to={target.url} className={styles.captionLink}>
        <h2>{lineBreaks(page.entryHeadlines?.[section] ?? target.title)}</h2>
        <div className={styles.captionDescription}>
          <p className={styles.description}>
            {page.entryDescriptions?.[section] ?? target.description}
          </p>
          <span className={styles.entry}>
            {entries[section]}
            <ArrowUpRight aria-hidden="true" />
          </span>
        </div>
      </Link>
    </div>
  )
  return (
    <article className={`${styles.story} ${styles[section]}`} aria-label={target.title}>
      {section === 'team' || section === 'donations' ? (
        <>
          {caption}
          {visual}
        </>
      ) : (
        <>
          {visual}
          {caption}
        </>
      )}
    </article>
  )
}

function HomeImage({ image, label }: { image?: ContentImageData; label: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={styles.visual}>
      {image?.src && !failed ? (
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          style={
            image.position
              ? { objectPosition: `${image.position.x}% ${image.position.y}%` }
              : undefined
          }
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.placeholder}>{label} · 素材待补充</span>
      )}
    </div>
  )
}

function HomeCallout({
  title,
  kind,
  children,
}: {
  title: string
  kind: 'info' | 'note'
  children?: ReactNode
}) {
  return (
    <aside className={styles.note} data-kind={kind}>
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  )
}
