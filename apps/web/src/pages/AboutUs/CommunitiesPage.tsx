import { useState } from 'react'
import { Link } from 'react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@exre/exui'
import { ArrowRight } from 'lucide-react'
import type { AboutPage, ContentImageData } from '../../content/about/types'
import { aboutImage } from '../../content/about/registry'
import type { ShaderTheme } from '../../config/shader-theme'
import { TeamDotBackground } from './TeamBackgrounds'
import styles from './CommunitiesPage.module.scss'

type Community = Extract<AboutPage, { kind: 'community' }>
const fallbackTheme: ShaderTheme = {
  colorBack: '#1b1d20',
  accent: '#1b1d20',
  colorFill: '#ffffff7d',
  colorStroke: '#ffffff',
}

// The same local community artwork is already used by the Join pages.
const communityImages: Record<string, ContentImageData> = {
  'rifling-911': {
    src: '/images/heros/join/rifling-911/2024.6.12.png',
    alt: 'Rifling-911 社区影像',
    width: 1920,
    height: 871,
  },
  caep: { src: '/images/heros/join/caep/hero.png', alt: 'CAEP 社区影像', width: 1920, height: 550 },
}

function CommunityImage({ community }: { community: Community }) {
  const [failed, setFailed] = useState(false)
  const image = community.cover ? aboutImage(community.cover) : communityImages[community.slug]
  if (!image || failed) return null
  return (
    <div className={styles.image}>
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export function CommunitiesPage({
  page,
  communities,
}: {
  page: AboutPage
  communities: Community[]
}) {
  const items = [...communities].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
  const [selected, setSelected] = useState(items[0]?.slug)
  const active = items.some((item) => item.slug === selected) ? selected : items[0]?.slug
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle} tabIndex={-1}>
        {page.title}
      </h1>
      {items.length ? (
        <Tabs
          value={active}
          onValueChange={setSelected}
          activationMode="automatic"
          className={styles.showcase}
        >
          <TabsList className={styles.selector} aria-label="选择社区">
            {items.map((item) => (
              <TabsTrigger key={item.id} value={item.slug} className={styles.trigger}>
                {item.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {items.map((item) => (
            <TabsContent
              key={item.id}
              value={item.slug}
              className={`${styles.panel} dark`}
              style={{ backgroundColor: (item.theme ?? fallbackTheme).colorBack }}
            >
              <div className={styles.background}>
                <TeamDotBackground theme={item.theme ?? fallbackTheme} />
              </div>
              <div className={styles.details}>
                <p className={styles.eyebrow}>{page.eyebrow ?? 'OUR COMMUNITIES'}</p>
                <h2>{item.title}</h2>
                <p className={styles.summary}>{item.description}</p>
                <Link to={item.url} className={styles.documentLink}>
                  查看社区文档{' '}
                  <span className={styles.arrow}>
                    <ArrowRight aria-hidden="true" />
                  </span>
                </Link>
              </div>
              <CommunityImage
                key={`${item.id}:${item.cover?.src ?? communityImages[item.slug]?.src}`}
                community={item}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className={styles.empty}>内容仍在整理中。</p>
      )}
    </div>
  )
}
