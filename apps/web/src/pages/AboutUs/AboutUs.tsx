import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { ContentImage } from '@workspace/components'
import { NotFound } from '../NotFound'
import { aboutImage, aboutRegistry, aboutStore } from '../../content/about/registry'
import type { AboutPage } from '../../content/about/types'
import { useContent } from '../../content/useContent'
import { AboutNavigation } from './AboutNavigation'
import { AboutHome } from './AboutHome'
import { CommunitiesPage } from './CommunitiesPage'
import { TeamPage } from './TeamPage'
import { StoryPage } from './StoryPage'
import { teamConfig } from '../../config/team-config'
import { Donations } from './Donations'
import { AboutBody, aboutMdxComponents, RelatedContent, type OpenMember } from './AboutBody'
import { MediaPage } from './MediaPage'
import { MemberModal } from './MemberModal'
import { useReadingPosition } from './useReadingPosition'
import styles from './AboutUs.module.scss'
import mediaStyles from './MediaPage.module.scss'

const statuses = {
  unknown: '状态待补充',
  active: '活跃社区',
  archived: '历史记录',
  planned: '筹备中',
}
export function AboutUs() {
  const location = useLocation()
  const canonical = location.pathname.replace(/\/+$/, '')
  const page = aboutRegistry.pages.find((item) => item.url === canonical)
  if (!page) return <NotFound />
  if (canonical !== location.pathname)
    return <Navigate replace to={`${canonical}${location.search}${location.hash}`} />
  return <AboutPageView page={page} />
}
function AboutPageView({ page }: { page: AboutPage }) {
  const location = useLocation()
  const [selected, setSelected] = useState<{
    slug: string
    trigger: HTMLElement
    path: string
  } | null>(null)
  const openMember = useCallback<OpenMember>(
    (slug, trigger) => {
      if (aboutRegistry.members.some((member) => member.slug === slug))
        setSelected({ slug, trigger, path: location.pathname })
    },
    [location.pathname],
  )
  useEffect(() => {
    setSelected(null)
  }, [location.pathname])
  const components = useMemo(() => aboutMdxComponents(openMember), [openMember])
  const state = useContent(aboutStore, page.id)
  const home = page.kind === 'home'
  const media = page.kind === 'media'
  const donations = page.kind === 'donations'
  const communities = page.kind === 'section' && page.section === 'communities'
  // The home layout and scroll target exist before its belief body loads.
  const main = useReadingPosition(
    home || media || donations || communities || state.status !== 'loading',
    page.title,
    page.description,
    'h1',
    { focusHashTarget: donations || media || page.kind === 'team' || page.section === 'story' },
  )
  return (
    <div
      className={
        home
          ? styles.home
          : media
            ? mediaStyles.page
            : communities
              ? `${styles.about} ${styles.communities}`
              : styles.about
      }
    >
      {!home &&
        (media ? (
          <div className={mediaStyles.navigation}>
            <AboutNavigation page={page} />
          </div>
        ) : (
          <AboutNavigation page={page} />
        ))}
      <main
        ref={main}
        className={
          home
            ? styles.homeMain
            : media
              ? mediaStyles.main
              : donations || communities || page.section === 'story' || page.kind === 'team'
                ? styles.teamMain
                : styles.main
        }
      >
        {page.kind === 'home' ? (
          <AboutHome page={page} state={state} components={components} retry={state.retry} />
        ) : communities ? (
          <CommunitiesPage
            page={page}
            communities={aboutRegistry.pages.filter(
              (item): item is Extract<AboutPage, { kind: 'community' }> =>
                item.kind === 'community',
            )}
          />
        ) : page.kind === 'donations' ? (
          <Donations page={page}>
            <AboutBody state={state} components={components} retry={state.retry} />
          </Donations>
        ) : page.kind === 'media' ? (
          <MediaPage page={page} state={state} components={components} openMember={openMember} />
        ) : page.kind === 'team' ? (
          <TeamPage page={page} state={state} components={components} config={teamConfig} />
        ) : page.section === 'story' ? (
          <StoryPage
            page={page}
            state={state}
            components={components}
            retry={state.retry}
            openMember={openMember}
          />
        ) : (
          <>
            <header className={styles.pageHeader}>
              <p className={styles.eyebrow}>{page.eyebrow}</p>
              <h1 tabIndex={-1}>{page.title}</h1>
              <p className={styles.summary}>{page.description}</p>
            </header>
            <section className={styles.reading}>
              {page.kind === 'community' && (
                <>
                  <p className={styles.status}>{statuses[page.status]}</p>
                  {page.cover && <ContentImage image={aboutImage(page.cover)} />}
                </>
              )}
              <AboutBody state={state} components={components} retry={state.retry} />
            </section>
            {page.kind === 'community' && (
              <div className={styles.reading}>
                <RelatedContent related={page.related} openMember={openMember} />
                {page.joinUrl &&
                  (page.joinUrl.startsWith('/') ? (
                    <Link to={page.joinUrl}>了解加入方式</Link>
                  ) : (
                    <a href={page.joinUrl} target="_blank" rel="noopener noreferrer">
                      了解加入方式
                    </a>
                  ))}
              </div>
            )}
          </>
        )}
      </main>
      {selected && selected.path === location.pathname && (
        <MemberModal
          key={selected.slug}
          slug={selected.slug}
          trigger={selected.trigger}
          components={components}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
