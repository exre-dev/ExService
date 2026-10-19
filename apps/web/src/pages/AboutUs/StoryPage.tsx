import { useMemo } from 'react'
import type { MDXComponents } from 'mdx/types'
import type { AboutPage } from '../../content/about/types'
import type { ContentState } from '../../content/useContent'
import { AboutBody, RelatedContent, type OpenMember } from './AboutBody'
import { StoryChapter, StoryTimeline, StoryMilestone } from './StoryTimeline'
import styles from './StoryTimeline.module.scss'

export function StoryPage({
  page,
  state,
  components,
  retry,
  openMember,
}: {
  page: AboutPage
  state: ContentState
  components: MDXComponents
  retry: () => void
  openMember: OpenMember
}) {
  const storyComponents = useMemo<MDXComponents>(
    () => ({
      ...components,
      Timeline: StoryTimeline,
      StoryChapter,
      Milestone: (props) => (
        <StoryMilestone {...props}>
          <>
            {props.children}
            <RelatedContent related={props.related} openMember={openMember} />
          </>
        </StoryMilestone>
      ),
    }),
    [components, openMember],
  )
  if (state.status !== 'ready')
    return (
      <div className={styles.pending}>
        <h1 tabIndex={-1}>{page.title}</h1>
        <AboutBody state={state} components={storyComponents} retry={retry} />
      </div>
    )
  return (
    <div className={styles.body}>
      <state.module.default components={storyComponents} />
    </div>
  )
}
