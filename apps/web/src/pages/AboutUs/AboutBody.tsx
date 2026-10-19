import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@exre/exui'
import { ContentImage, ContentProse } from '@workspace/components'
import type { MDXComponents } from 'mdx/types'
import { createMdxComponents } from '../../content/mdx'
import { aboutImage, aboutTarget, aboutRegistry } from '../../content/about/registry'
import type { ContentImageData, RelatedRefs } from '../../content/about/types'
import type { ContentState } from '../../content/useContent'
import styles from './AboutUs.module.scss'

export type OpenMember = (slug: string, trigger: HTMLElement) => void
export function aboutMdxComponents(openMember: OpenMember): MDXComponents {
  return createMdxComponents({
    a: ({ href, children, ...props }: ComponentProps<'a'>) =>
      href?.startsWith('/') || href?.startsWith('#') ? (
        <Link {...props} to={href}>
          {children}
        </Link>
      ) : (
        <a {...props} href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    ContentImage: ({ image }: { image: ContentImageData }) => (
      <ContentImage image={aboutImage(image)} />
    ),
    AboutLink: ({ target, children }: { target: string; children?: ReactNode }) => (
      <Link to={aboutTarget(target)}>{children}</Link>
    ),
    MemberButton: ({ slug, children }: { slug: string; children?: ReactNode }) => (
      <Button variant="outline" onClick={(event) => openMember(slug, event.currentTarget)}>
        {children ?? aboutRegistry.members.find((member) => member.slug === slug)?.title}
      </Button>
    ),
    Timeline: ({ children }: { children?: ReactNode }) => (
      <div className={styles.timeline}>{children}</div>
    ),
    Milestone: ({
      id,
      title,
      dateLabel,
      image,
      related,
      children,
    }: {
      id: string
      title: string
      dateLabel: string
      image?: ContentImageData
      related?: RelatedRefs
      children?: ReactNode
    }) => (
      <section id={`milestone-${id}`} className={styles.milestone}>
        <p className={styles.eyebrow}>{dateLabel}</p>
        <h2>{title}</h2>
        {children}
        {image && <ContentImage image={aboutImage(image)} />}
        <RelatedContent related={related} openMember={openMember} />
      </section>
    ),
  })
}
export function AboutBody({
  state,
  components,
  retry,
}: {
  state: ContentState
  components: MDXComponents
  retry: () => void
}) {
  if (state.status === 'loading')
    return (
      <p role="status" className={styles.loading}>
        正在加载内容…
      </p>
    )
  if (state.status === 'error')
    return (
      <div role="alert" className={styles.loading}>
        <p>内容暂时无法加载</p>
        <Button variant="outline" onClick={retry}>
          重试
        </Button>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          重新加载当前页面
        </Button>
        <Link to="/aboutus">返回概览</Link>
      </div>
    )
  return (
    <div className={styles.body}>
      <ContentProse>
        <state.module.default components={components} />
      </ContentProse>
    </div>
  )
}
export function RelatedContent({
  related,
  openMember,
}: {
  related?: RelatedRefs
  openMember: OpenMember
}) {
  if (!related || !Object.values(related).some((values) => values?.length)) return null
  const links: { key: string; to: string; title: string }[] = []
  for (const slug of related.communities ?? [])
    links.push({
      key: `c:${slug}`,
      to: `/aboutus/communities/${slug}`,
      title:
        aboutRegistry.pages.find((page) => page.kind === 'community' && page.slug === slug)
          ?.title ?? slug,
    })
  for (const id of related.media ?? [])
    links.push({
      key: `m:${id}`,
      to: `/aboutus/media#media-${id}`,
      title: aboutRegistry.media.find((item) => item.id === id)?.title ?? id,
    })
  for (const id of related.milestones ?? [])
    links.push({ key: `s:${id}`, to: `/aboutus/story#milestone-${id}`, title: '查看关联历程' })
  return (
    <aside className={styles.related} aria-label="相关内容">
      <h2>继续了解</h2>
      <div>
        {links.map((link) => (
          <Link key={link.key} to={link.to}>
            {link.title}
          </Link>
        ))}
        {(related.members ?? []).map((slug) => (
          <Button
            key={slug}
            variant="ghost"
            onClick={(event) => openMember(slug, event.currentTarget)}
          >
            {aboutRegistry.members.find((member) => member.slug === slug)?.title}
          </Button>
        ))}
      </div>
    </aside>
  )
}
