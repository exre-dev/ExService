import { ArrowUpRight, Video } from 'lucide-react'
import { ContentImage } from '@workspace/components'
import { aboutImage, aboutRegistry } from '../../content/about/registry'
import { RelatedContent, type OpenMember } from './AboutBody'
import styles from './MediaPage.module.scss'

export function MediaList({ openMember }: { openMember: OpenMember }) {
  const videos = aboutRegistry.media.filter((item) => item.type === 'video')
  if (!videos.length) return <p className={styles.empty}>影像资料仍在整理中。</p>
  return (
    <div className={styles.videoGrid}>
      {videos.map((item) => {
        const body = (
          <>
            <div className={styles.cover}>
              {item.cover ? (
                <ContentImage image={aboutImage(item.cover)} />
              ) : (
                <div className={styles.coverPlaceholder}>
                  <Video aria-hidden="true" />
                  <span>封面待补充</span>
                </div>
              )}
            </div>
            <div className={styles.cardBody}>
              <h3>
                {item.title}
                {item.sourceUrl && <ArrowUpRight aria-hidden="true" />}
              </h3>
              <p>{item.creator}</p>
              <p>{item.usage}</p>
              {!item.sourceUrl && <p>来源待补充</p>}
            </div>
          </>
        )
        return (
          <article key={item.id} id={`media-${item.id}`} className={styles.videoCard} tabIndex={-1}>
            {item.sourceUrl ? (
              <a
                className={styles.videoLink}
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {body}
              </a>
            ) : (
              body
            )}
            <RelatedContent related={item.related} openMember={openMember} />
          </article>
        )
      })}
    </div>
  )
}
